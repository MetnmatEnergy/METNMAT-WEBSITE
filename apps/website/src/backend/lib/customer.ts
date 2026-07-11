import { cookies } from "next/headers";

/**
 * Customer session helpers. The website holds the customer's Payload JWT in an
 * httpOnly cookie and talks to the CMS `customers` auth collection on their
 * behalf. Order/RFQ history is read server-side with the shared internal key
 * (so customers never need direct read access to those collections).
 */
const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const INTERNAL = process.env.INTERNAL_API_KEY || "";
export const CUSTOMER_COOKIE = "mm-customer";

export type Address = {
  id?: string;
  label?: string;
  name?: string;
  phone?: string;
  line1?: string;
  line2?: string; // locality
  landmark?: string;
  altPhone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  addressType?: "home" | "work" | "";
  isDefault?: boolean;
};

export type Customer = {
  id: string;
  /** Permanent METNMAT member id (MNM-U-YY-000000), assigned on signup. */
  userCode?: string;
  /** Customer-chosen profile picture: an emoji preset or a data-URI photo. */
  avatar?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  gstin?: string;
  /** Self-selected audience role: student | phd | faculty | scientist | procurement | industry | other. */
  role?: string;
  /**
   * How they sign in. "google" means the account was created via Google and has
   * NO password the customer chose (the CMS seeded a random one) — that's the
   * signal to offer "set a password". "linked" = password + Google both work.
   */
  authProvider?: "local" | "google" | "linked";
  /**
   * True when the email is PROVEN to belong to this person (Google sign-in
   * asserts it). Guest orders are matched to accounts by email alone, so only a
   * verified email may claim them — otherwise anyone could register with a guest
   * buyer's address and read their orders and invoices.
   */
  emailVerified?: boolean;
  addresses?: Address[];
};

export const cookieOptions = (maxAgeSec = 60 * 60 * 24 * 7) => ({
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: maxAgeSec,
});

export async function getCustomerToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CUSTOMER_COOKIE)?.value || null;
}

/**
 * The signed-in customer, or null. Safe (never throws).
 *
 * A null here signs the customer OUT (the account layout redirects to /login), so
 * only an *authoritative* answer may return null. A CMS hiccup — a 5xx, a Cloud
 * Run cold start, a dropped connection — is transient: retry once with a short
 * backoff rather than throwing the customer back to the sign-in page. Payload's
 * /me answers 200 with `{user: null}` for a bad or expired token, which IS
 * authoritative and correctly falls through to null.
 */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const token = await getCustomerToken();
  if (!token) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 150));
    try {
      const res = await fetch(`${CMS}/api/customers/me`, {
        headers: { Authorization: `JWT ${token}` },
        cache: "no-store",
      });
      // Authoritative: the token was rejected, or accepted and answered.
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { user?: Customer | null };
        return data?.user ?? null;
      }
      if (res.status === 401 || res.status === 403) return null;
      // Anything else (5xx, 429, 502 from a cold start) — transient, retry.
    } catch {
      // Network error — transient, retry.
    }
  }
  return null;
}

/** PATCH the current customer's own record (profile / addresses). */
export async function patchCurrentCustomer(patch: Record<string, unknown>): Promise<Customer | null> {
  const token = await getCustomerToken();
  const me = await getCurrentCustomer();
  if (!token || !me?.id) return null;
  try {
    const res = await fetch(`${CMS}/api/customers/${me.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { doc?: Customer };
    return data?.doc ?? null;
  } catch {
    return null;
  }
}

type OrderDoc = {
  id?: string;
  orderNumber?: string;
  status?: string;
  total?: number;
  createdAt?: string;
  items?: { productName?: string; qty?: number }[];
};

// ── Commerce settings (staff-controlled order behaviour) ─────────────────────

export type CommerceSettings = {
  /** Auto-cancel orders whose payment failed / never completed. */
  autoCancelUnpaidOrders: boolean;
  /** Grace period before the auto-cancel, in hours. */
  autoCancelAfterHours: number;
};

let commerceCache: { at: number; value: CommerceSettings } | null = null;

/**
 * The CMS "Commerce & Pricing" global — staff control order auto-cancellation
 * here. Cached for 60s per server instance (this is read on every account
 * order view). Fails CLOSED: if the CMS can't be reached we do NOT auto-cancel
 * anything (and couldn't PATCH anyway).
 */
export async function getCommerceSettings(): Promise<CommerceSettings> {
  if (commerceCache && Date.now() - commerceCache.at < 60_000) return commerceCache.value;
  try {
    const res = await fetch(`${CMS}/api/globals/commerce`, { cache: "no-store" });
    if (!res.ok) return { autoCancelUnpaidOrders: false, autoCancelAfterHours: 24 };
    const g = (await res.json()) as { autoCancelUnpaidOrders?: boolean; autoCancelAfterHours?: number };
    const value: CommerceSettings = {
      autoCancelUnpaidOrders: g.autoCancelUnpaidOrders !== false,
      autoCancelAfterHours: Math.max(1, Number(g.autoCancelAfterHours) || 24),
    };
    commerceCache = { at: Date.now(), value };
    return value;
  } catch {
    return { autoCancelUnpaidOrders: false, autoCancelAfterHours: 24 };
  }
}

/**
 * Lazy auto-cancel sweep, run when a customer views their orders: any of THEIR
 * orders still pending/failed past the staff-configured grace period becomes
 * "cancelled" (both are legal transitions; the CMS workflow hook stamps
 * cancelledAt). Scoped to the orders just fetched — this touches nobody else's
 * data — and the very-late-capture race is covered by the webhook's
 * captured-after-terminal ops alert. Returns the orders with fresh statuses.
 */
async function sweepStaleUnpaid<T extends { id?: string; status?: string; createdAt?: string }>(
  orders: T[]
): Promise<T[]> {
  const stale = orders.filter((o) => o.id && (o.status === "pending" || o.status === "failed") && o.createdAt);
  if (!stale.length) return orders;
  const settings = await getCommerceSettings();
  if (!settings.autoCancelUnpaidOrders) return orders;
  const cutoff = Date.now() - settings.autoCancelAfterHours * 3_600_000;
  const toCancel = new Set(
    stale.filter((o) => new Date(o.createdAt as string).getTime() < cutoff).map((o) => o.id as string)
  );
  if (!toCancel.size) return orders;

  const now = new Date().toISOString();
  const cancelled = new Set<string>();
  await Promise.all(
    [...toCancel].map(async (id) => {
      try {
        const res = await fetch(`${CMS}/api/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL },
          body: JSON.stringify({ status: "cancelled" }),
        });
        if (res.ok) cancelled.add(id);
      } catch {
        /* transient — the next view retries */
      }
    })
  );
  if (!cancelled.size) return orders;
  return orders.map((o) =>
    o.id && cancelled.has(o.id) ? { ...o, status: "cancelled", cancelledAt: now } : o
  );
}

export type FullOrder = {
  id?: string;
  orderNumber?: string;
  status?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gstin?: string;
  businessName?: string;
  /** Billing address (mirrors shipping when billingSameAsShipping). */
  billingSameAsShipping?: boolean;
  billingName?: string;
  billingLine1?: string;
  billingLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPincode?: string;
  billingCountry?: string;
  items?: { productName?: string; slug?: string; sku?: string; size?: string; qty?: number; unitPrice?: number; lineTotal?: number; hsnSac?: string }[];
  subtotal?: number;
  gstAmount?: number;
  total?: number;
  razorpayPaymentId?: string;
  paidAt?: string;
  createdAt?: string;
  /** Terminal-transition timestamps, stamped by the CMS workflow hook. */
  failedAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  /** Sequential GST invoice serial, minted when the order first turned paid. */
  invoiceNumber?: string;
  invoiceDate?: string;
  displayCurrency?: "INR" | "USD";
  totalUsdApprox?: number;
};

/**
 * The where-clause that decides which orders a signed-in customer OWNS.
 *
 * Orders placed while signed in carry a `customer` relationship — those are
 * always theirs. GUEST orders are matched by bare email equality, and that match
 * is only safe when the email is PROVEN owned (`emailVerified`): registration
 * has no email verification, so without this gate anyone could register with a
 * guest buyer's address and read their order history and GST invoices.
 */
function ownerClause(customer: Customer, prefix: string): string {
  const emailLc = (customer.email ?? "").toLowerCase();
  if (customer.emailVerified && emailLc) {
    return (
      `${prefix}[or][0][customer][equals]=${encodeURIComponent(customer.id)}` +
      `&${prefix}[or][1][email][equals]=${encodeURIComponent(emailLc)}`
    );
  }
  return `${prefix}[customer][equals]=${encodeURIComponent(customer.id)}`;
}

/** Result of an owner-scoped order fetch: a CMS failure must render as an error,
 *  never as a cheerful "no orders yet" empty state. */
export type OrdersResult = { ok: true; orders: OrderDoc[] } | { ok: false };
export type OrderResult = { ok: true; order: FullOrder | null } | { ok: false };

/** A single order, scoped to the signed-in customer (owner-only). */
export async function getCustomerOrder(
  customer: Customer | null | undefined,
  orderNumber: string
): Promise<OrderResult> {
  if (!customer?.id || !orderNumber) return { ok: true, order: null };
  try {
    const qs =
      `where[and][0][orderNumber][equals]=${encodeURIComponent(orderNumber)}` +
      `&${ownerClause(customer, "where[and][1]")}` +
      `&limit=1&depth=0`;
    const res = await fetch(`${CMS}/api/orders?${qs}`, {
      headers: { "x-internal-key": INTERNAL },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { docs?: FullOrder[] };
    const doc = data?.docs?.[0] ?? null;
    if (!doc) return { ok: true, order: null };
    const [swept] = await sweepStaleUnpaid([doc]);
    return { ok: true, order: swept };
  } catch {
    return { ok: false };
  }
}

/**
 * An order by its number (server-side, internal key). Used by the post-payment
 * success page to CONFIRM the order is real and paid before showing success —
 * the page must never claim "payment successful" purely from a URL parameter.
 */
export async function getOrderByNumber(orderNumber: string): Promise<FullOrder | null> {
  if (!orderNumber) return null;
  try {
    const res = await fetch(
      `${CMS}/api/orders?where[orderNumber][equals]=${encodeURIComponent(orderNumber)}&limit=1&depth=0`,
      { headers: { "x-internal-key": INTERNAL }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { docs?: FullOrder[] };
    return data?.docs?.[0] ?? null;
  } catch {
    return null;
  }
}

/** The signed-in customer's orders (account-linked always; guest orders only
 *  when the email is verified — see ownerClause). */
export async function getCustomerOrders(customer: Customer | null | undefined): Promise<OrdersResult> {
  if (!customer?.id) return { ok: true, orders: [] };
  try {
    const res = await fetch(
      `${CMS}/api/orders?${ownerClause(customer, "where")}&sort=-createdAt&limit=50&depth=0`,
      { headers: { "x-internal-key": INTERNAL }, cache: "no-store" }
    );
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { docs?: OrderDoc[] };
    const orders = await sweepStaleUnpaid(data?.docs ?? []);
    return { ok: true, orders };
  } catch {
    return { ok: false };
  }
}

export type ShipmentDoc = {
  status?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
};

/** Shipments for an order the caller has ALREADY authorised (owner-scoped fetch
 *  first) — this helper does no access check of its own. */
export async function getOrderShipments(orderId?: string): Promise<ShipmentDoc[]> {
  if (!orderId) return [];
  try {
    const res = await fetch(
      `${CMS}/api/shipments?where[order][equals]=${encodeURIComponent(orderId)}&sort=-createdAt&limit=5&depth=0`,
      { headers: { "x-internal-key": INTERNAL }, cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { docs?: ShipmentDoc[] };
    return data?.docs ?? [];
  } catch {
    return [];
  }
}

type EnquiryDoc = {
  id?: string;
  productName?: string;
  status?: string;
  message?: string;
  createdAt?: string;
};

/** RFQ / customization enquiries for this email. */
export async function getCustomerEnquiries(email?: string): Promise<EnquiryDoc[]> {
  if (!email) return [];
  try {
    const res = await fetch(
      `${CMS}/api/enquiries?where[email][equals]=${encodeURIComponent(email)}&sort=-createdAt&limit=50&depth=0`,
      { headers: { "x-internal-key": INTERNAL }, cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { docs?: EnquiryDoc[] };
    return data?.docs ?? [];
  } catch {
    return [];
  }
}
