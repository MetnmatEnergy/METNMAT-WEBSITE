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
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  isDefault?: boolean;
};

export type Customer = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  gstin?: string;
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

/** The signed-in customer, or null. Safe (never throws). */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const token = await getCustomerToken();
  if (!token) return null;
  try {
    const res = await fetch(`${CMS}/api/customers/me`, {
      headers: { Authorization: `JWT ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: Customer | null };
    return data?.user ?? null;
  } catch {
    return null;
  }
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
  orderNumber?: string;
  status?: string;
  total?: number;
  createdAt?: string;
  items?: { productName?: string; qty?: number }[];
};

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
  items?: { productName?: string; sku?: string; qty?: number; unitPrice?: number; lineTotal?: number }[];
  subtotal?: number;
  gstAmount?: number;
  total?: number;
  razorpayPaymentId?: string;
  paidAt?: string;
  createdAt?: string;
};

/** A single order, scoped to the signed-in customer's email (owner-only). */
export async function getCustomerOrder(email: string | undefined, orderNumber: string): Promise<FullOrder | null> {
  if (!email || !orderNumber) return null;
  try {
    const qs =
      `where[and][0][email][equals]=${encodeURIComponent(email)}` +
      `&where[and][1][orderNumber][equals]=${encodeURIComponent(orderNumber)}` +
      `&limit=1&depth=0`;
    const res = await fetch(`${CMS}/api/orders?${qs}`, {
      headers: { "x-internal-key": INTERNAL },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { docs?: FullOrder[] };
    return data?.docs?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Orders for this email (server-side, internal key). Catches guest orders too. */
export async function getCustomerOrders(email?: string): Promise<OrderDoc[]> {
  if (!email) return [];
  try {
    const res = await fetch(
      `${CMS}/api/orders?where[email][equals]=${encodeURIComponent(email)}&sort=-createdAt&limit=50&depth=0`,
      { headers: { "x-internal-key": INTERNAL }, cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { docs?: OrderDoc[] };
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
