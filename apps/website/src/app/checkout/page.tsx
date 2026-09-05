"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Loader2, ShieldCheck, FileText, Check, HelpCircle, Truck, Package } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { formatINR, inclGSTForProduct, usdFor, lineUsdValue, soleGstRate, type Product } from "@/frontend/lib/catalog";
import { getTracker } from "@/frontend/lib/analytics/collector";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";
import { site } from "@/frontend/lib/site";
import { countryByName, dialFor, isIndiaName } from "@/frontend/lib/countries";
import { CountryPicker } from "@/frontend/components/commerce/country-picker";
import { ProductImage } from "@/frontend/components/commerce/product-image";
import {
  createPaymentScriptLoader,
  canReuseOrder,
  isBusy,
  isTimeout,
  postJson,
  CREATE_ORDER_TIMEOUT_MS,
  RESOLVE_TIMEOUT_MS,
  VERIFY_TIMEOUT_MS,
  WATCHDOG_MS,
  PAY_BUSY_LABEL,
  type PayStatus,
  type CachedOrder,
} from "@/frontend/lib/pay-flow";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (event: string, handler: (payload: RazorpayFailure) => void) => void;
    };
  }
}

type RazorpayFailure = { error?: { description?: string; reason?: string } };

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * The one loader for the payment script. Module-level so concurrent clicks and
 * repeat visits to checkout share a single in-flight load. See pay-flow.ts for
 * the freeze this replaced.
 */
const loadRazorpay = createPaymentScriptLoader({
  src: RAZORPAY_SRC,
  getDocument: () => (typeof document === "undefined" ? undefined : document),
  isReady: () => typeof window !== "undefined" && Boolean(window.Razorpay),
});

/** Analytics session id, best-effort — storage can throw in private mode. */
function readAnalyticsSid(): string | undefined {
  try {
    return localStorage.getItem("mm-sid") || undefined;
  } catch {
    return undefined;
  }
}

type CreateOrderResponse = {
  ok: boolean;
  error?: string;
  keyId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  orderNumber?: string;
  total?: number;
  totalUsdApprox?: number;
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="flex items-center gap-3 font-display text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-brand-foreground">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-muted-foreground">
      {children}
      {required && <span className="text-brand"> *</span>}
    </label>
  );
}

/** A small inline "?" help affordance (mirrors the reference checkout's tooltips). */
function InfoHint({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      role="note"
      aria-label={text}
      title={text}
      className="inline-flex cursor-help items-center text-muted-foreground/70 transition-colors hover:text-muted-foreground focus:text-muted-foreground"
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * One labelled text input with inline validation: red border + message on
 * error, a green tick once it's valid. Errors are wired to the input via
 * aria-describedby so screen readers announce them.
 */
function TextField({
  k,
  label,
  required,
  hint,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  value,
  error,
  valid,
  onChange,
  onBlur,
}: {
  k: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  placeholder?: string;
  value: string;
  error?: string;
  valid?: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const id = `f-${k}`;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="text-brand"> *</span>}
        </label>
        {hint && <InfoHint text={hint} />}
      </div>
      <div className="relative">
        <input
          id={id}
          className={cx(field, error && "border-brand focus:border-brand", valid && !error && "border-emerald-500/60 pr-10")}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {valid && !error && (
          <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700 dark:text-emerald-400" aria-hidden />
        )}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-brand" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Searchable full-country field. Value is the country name (kept in sync with
 *  the order); type to filter ~200 countries by name or dialing code. */
function CountrySelect({
  id,
  label,
  required,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} required={required}>{label}</Label>
      <CountryPicker id={id} variant="full" value={value} onChange={onChange} ariaLabel={label} invalid={invalid} />
    </div>
  );
}

function CheckRow({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-brand accent-brand focus:ring-2 focus:ring-ring/30"
      />
      <span className="text-foreground">{children}</span>
    </label>
  );
}

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // local number only — the dialing code comes from the country
  company: string;
  // shipping
  country: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  // billing
  billingSame: boolean;
  bName: string;
  bLine1: string;
  bLine2: string;
  bCity: string;
  bState: string;
  bPincode: string;
  bCountry: string;
  // gst (B2B, optional)
  gstin: string;
  businessName: string;
  // extras
  deliveryNotes: string;
  marketingOptIn: boolean;
};

const EMPTY: Form = {
  firstName: "", lastName: "", email: "", phone: "", company: "",
  country: "India",
  line1: "", line2: "", city: "", state: "", pincode: "",
  billingSame: true,
  bName: "", bLine1: "", bLine2: "", bCity: "", bState: "", bPincode: "", bCountry: "India",
  gstin: "", businessName: "",
  deliveryNotes: "", marketingOptIn: true,
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Pure per-field validator. Returns an error message, or undefined when valid. */
function fieldError(k: string, f: Form): string | undefined {
  const t = (s: string) => s.trim();
  const isIN = isIndiaName(f.country);
  switch (k) {
    case "firstName": return t(f.firstName) ? undefined : "Enter your first name.";
    case "lastName": return t(f.lastName) ? undefined : "Enter your last name.";
    case "email": return /^\S+@\S+\.\S+$/.test(f.email) ? undefined : "Enter a valid email address.";
    case "phone": {
      const d = f.phone.replace(/\D/g, "");
      if (isIN) return /^\d{10}$/.test(d) ? undefined : "Enter a 10-digit mobile number.";
      return d.length >= 6 && d.length <= 14 ? undefined : "Enter a valid phone number.";
    }
    case "line1": return t(f.line1) ? undefined : "Address is required for shipping.";
    case "city": return t(f.city) ? undefined : "Required.";
    case "state": return !isIN || t(f.state) ? undefined : "Required.";
    case "pincode":
      return isIN
        ? (/^\d{6}$/.test(t(f.pincode)) ? undefined : "Enter a 6-digit PIN code.")
        : (t(f.pincode) ? undefined : "Required.");
    case "gstin": {
      const g = t(f.gstin).toUpperCase();
      return !g || GSTIN_RE.test(g) ? undefined : "Enter a valid 15-character GSTIN.";
    }
    // Billing (only checked when not "same as shipping").
    case "bName": return t(f.bName) ? undefined : "Enter the billing name.";
    case "bLine1": return t(f.bLine1) ? undefined : "Billing address is required.";
    case "bCity": return t(f.bCity) ? undefined : "Required.";
    case "bState": return !isIndiaName(f.bCountry) || t(f.bState) ? undefined : "Required.";
    case "bPincode":
      return isIndiaName(f.bCountry)
        ? (/^\d{6}$/.test(t(f.bPincode)) ? undefined : "Enter a 6-digit PIN code.")
        : (t(f.bPincode) ? undefined : "Required.");
    default: return undefined;
  }
}

/** The fields that must validate before payment, given the current form shape. */
function requiredKeys(f: Form): string[] {
  const keys = ["firstName", "lastName", "email", "phone", "line1", "city", "pincode"];
  if (isIndiaName(f.country)) keys.push("state");
  if (f.gstin.trim()) keys.push("gstin"); // validate format only when provided
  if (!f.billingSame) {
    keys.push("bName", "bLine1", "bCity", "bPincode");
    if (isIndiaName(f.bCountry)) keys.push("bState");
  }
  return keys;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cartLines, cartCount, clearCart, addToCart, ready } = useStore();
  const { money, currency, usdRate, setRegion } = useCurrency();
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Set<string>>(() => new Set());
  const [payStatus, setPayStatus] = React.useState<PayStatus>("idle");
  const [payError, setPayError] = React.useState<string | null>(null);
  /**
   * Synchronous re-entry lock. `disabled` is driven by state, and two clicks
   * dispatched in the same tick both read the pre-update value, so the button
   * alone does not stop a double submit.
   */
  const payingRef = React.useRef(false);
  /** The order already created for an identical request — see handlePay. */
  const orderCacheRef = React.useRef<CachedOrder<CreateOrderResponse> | null>(null);

  const busy = isBusy(payStatus);

  // Display GST-inclusive totals (catalog stores base prices excl. GST).
  const subtotalIncl = cartLines.reduce((n, l) => n + inclGSTForProduct(l.product, l.unitPrice) * l.qty, 0);
  const subtotalExcl = cartLines.reduce((n, l) => n + l.unitPrice * l.qty, 0);
  const gstAmount = subtotalIncl - subtotalExcl;
  // Naming a percentage is only honest when the cart HAS one. Mixed rates get
  // the amount without a rate rather than a number that matches no line.
  const cartGstRate = soleGstRate(cartLines);
  const itemCount = cartLines.reduce((n, l) => n + l.qty, 0);
  const usdSubtotal =
    currency === "USD"
      ? cartLines.reduce((n, l) => n + lineUsdValue(l.product, l.unitPrice, l.qty, usdRate), 0)
      : undefined;
  const hasQuoteOnly = cartLines.some((l) => !l.product.price);
  const isIndia = isIndiaName(form.country);
  const dialCode = dialFor(form.country) || "+91";

  // checkout_start — fire once when the cart has hydrated with items, so the
  // funnel (product view → add to cart → checkout start → purchase/failed) is
  // complete. value = GST-inclusive cart total.
  const checkoutTracked = React.useRef(false);
  React.useEffect(() => {
    if (checkoutTracked.current || !ready || cartCount === 0) return;
    checkoutTracked.current = true;
    getTracker().track("checkout_start", { meta: { value: Math.round(subtotalIncl), items: itemCount } });
  }, [ready, cartCount, subtotalIncl, itemCount]);

  // Prefill from the signed-in customer's saved profile + default address
  // (checkout is gated, so one always exists). Runs once on mount, before the
  // customer types — and never overwrites a field they've already filled.
  const prefilled = React.useRef(false);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/me", { cache: "no-store" });
        if (!res.ok) return;
        const { customer } = (await res.json()) as {
          customer: null | {
            name?: string; email?: string; phone?: string; company?: string; gstin?: string;
            addresses?: Array<{
              line1?: string; line2?: string; city?: string; state?: string;
              pincode?: string; country?: string; isDefault?: boolean;
            }>;
          };
        };
        if (!customer || cancelled || prefilled.current) return;
        prefilled.current = true;
        setForm((f) => {
          const n = { ...f };
          const parts = String(customer.name ?? "").trim().split(/\s+/).filter(Boolean);
          if (!n.firstName && parts[0]) n.firstName = parts[0];
          if (!n.lastName && parts.length > 1) n.lastName = parts.slice(1).join(" ");
          if (!n.email && customer.email) n.email = customer.email;
          if (!n.company && customer.company) n.company = customer.company;
          if (!n.businessName && customer.company) n.businessName = customer.company;
          if (!n.gstin && customer.gstin) n.gstin = String(customer.gstin).toUpperCase();
          const addrs = customer.addresses ?? [];
          const def = addrs.find((a) => a.isDefault) ?? addrs[0];
          if (def) {
            if (def.country && countryByName(def.country)) n.country = def.country;
            if (!n.line1 && def.line1) n.line1 = def.line1;
            if (!n.line2 && def.line2) n.line2 = def.line2;
            if (!n.city && def.city) n.city = def.city;
            if (!n.state && def.state) n.state = def.state;
            if (!n.pincode && def.pincode) n.pincode = def.pincode;
          }
          if (!n.phone && customer.phone) {
            const dial = dialFor(n.country).replace(/\D/g, "");
            let digits = String(customer.phone).replace(/\D/g, "");
            if (dial && digits.startsWith(dial)) digits = digits.slice(dial.length);
            n.phone = digits;
          }
          return n;
        });
      } catch {
        /* ignore — the form just stays blank */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Update a string field; live-clear its error once it becomes valid. */
  const upd = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => {
      const key = k as string;
      if (!er[key]) return er;
      const next = fieldError(key, { ...form, [k]: v });
      const rest = { ...er };
      delete rest[key];
      return next ? { ...rest, [key]: next } : rest;
    });
  };

  /** Validate a single field on blur. */
  const blur = (k: string) => () => {
    setTouched((s) => (s.has(k) ? s : new Set(s).add(k)));
    const e = fieldError(k, form);
    setErrors((er) => {
      const rest = { ...er };
      delete rest[k];
      return e ? { ...rest, [k]: e } : rest;
    });
  };

  /** Show a green tick once a field has been interacted with and is valid. */
  const validTick = (k: string) =>
    touched.has(k) && String(form[k as keyof Form] ?? "").trim() !== "" && !fieldError(k, form);

  /** Selecting a shipping country re-evaluates phone/PIN/state rules. */
  function setCountry(name: string) {
    setForm((f) => ({ ...f, country: name }));
    // ...and the shopping region. Choosing where the order ships is a far
    // stronger signal than the IP the region was first guessed from, and seeing
    // dollar prices while shipping to Chennai reads as a mistake. Safe to do
    // here because setCountry only runs on an explicit selection — syncing from
    // the form value on mount would instead overwrite the visitor's region with
    // the field default.
    //
    // Display only: the charge is recomputed server-side in INR either way.
    setRegion(isIndiaName(name) ? "IN" : "INTL");
    setErrors((er) => {
      const rest = { ...er };
      delete rest.pincode;
      delete rest.state;
      delete rest.phone; // dialing-code/length rule depends on country
      return rest;
    });
  }

  function setBCountry(name: string) {
    setForm((f) => ({ ...f, bCountry: name }));
    setErrors((er) => {
      const rest = { ...er };
      delete rest.bState;
      delete rest.bPincode;
      return rest;
    });
  }

  function setBillingSame(v: boolean) {
    setForm((f) => ({ ...f, billingSame: v }));
    if (v) {
      setErrors((er) => {
        const n = { ...er };
        for (const k of ["bName", "bLine1", "bCity", "bState", "bPincode"]) delete n[k];
        return n;
      });
    }
  }

  function validate(): boolean {
    const er: Record<string, string> = {};
    for (const k of requiredKeys(form)) {
      const e = fieldError(k, form);
      if (e) er[k] = e;
    }
    setErrors(er);
    setTouched(new Set(requiredKeys(form)));
    const first = Object.keys(er)[0];
    if (first) document.getElementById(`f-${first}`)?.focus();
    return Object.keys(er).length === 0;
  }

  /**
   * Leave the pay flow in a terminal state.
   *
   * Every exit routes through here, including the ones that run long after
   * handlePay returned (the provider's dismiss and result callbacks), so the
   * button can never be left disabled with nothing in flight.
   */
  const finishPay = React.useCallback((status: PayStatus, message: string | null) => {
    // Stay locked on success: we are navigating away, and a second charge must
    // not be startable during the transition.
    payingRef.current = status === "success";
    setPayStatus(status);
    setPayError(message);
  }, []);

  /**
   * Backstop. Each hop already has its own timeout, so this should never fire —
   * it exists because "the Pay button is stuck" must not be reachable by any
   * path, including one nobody predicted.
   *
   * Deliberately not armed during awaiting_payment: the customer is inside the
   * provider's window typing card details and may legitimately take minutes.
   */
  React.useEffect(() => {
    const ms = WATCHDOG_MS[payStatus];
    if (!ms) return;
    const t = setTimeout(() => {
      finishPay(
        "error",
        payStatus === "verifying"
          ? "We couldn't confirm your payment in time. Do not pay again — contact us with your payment ID and we'll finish the order."
          : "The payment couldn't be started in time. Please check your connection and try again."
      );
    }, ms);
    return () => clearTimeout(t);
  }, [payStatus, finishPay]);

  async function handlePay() {
    if (payingRef.current) return;

    setPayError(null);
    if (!validate()) return;

    payingRef.current = true;
    setPayStatus("submitting");

    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      const phoneDigits = form.phone.replace(/\D/g, "");
      const fullPhone = `${dialCode} ${form.phone.trim()}`.trim();

      const orderRequest = {
        customer: { name: fullName, email: form.email, phone: fullPhone, company: form.company },
        address: {
          line1: form.line1, line2: form.line2, city: form.city,
          state: form.state, pincode: form.pincode, country: form.country,
        },
        gstin: form.gstin.trim().toUpperCase(),
        businessName: form.businessName,
        billingSameAsShipping: form.billingSame,
        billing: form.billingSame
          ? undefined
          : {
              name: form.bName.trim(), line1: form.bLine1.trim(), line2: form.bLine2.trim(),
              city: form.bCity.trim(), state: form.bState.trim(),
              pincode: form.bPincode.trim(), country: form.bCountry.trim(),
            },
        deliveryNotes: form.deliveryNotes.trim(),
        marketingOptIn: form.marketingOptIn,
        items: cartLines.map((l) => ({ slug: l.slug, qty: l.qty, size: l.size })),
        displayCurrency: currency,
      };

      /*
       * Reuse the order already created for an IDENTICAL request.
       *
       * Every Pay click minted a fresh Razorpay order AND a fresh pending Order
       * row in the CMS, so cancelling the payment window and pressing Pay again
       * left an abandoned order behind each time — one customer, one payment,
       * and a trail of pending rows for staff to reconcile.
       *
       * The fingerprint covers the whole request, so changing the cart or the
       * address correctly starts a NEW order rather than reusing one bound to a
       * stale address. It expires too, so an order abandoned for a quarter of an
       * hour is not resurrected at a price that may since have moved.
       */
      const fingerprint = JSON.stringify(orderRequest);
      const cached = orderCacheRef.current;
      let data: CreateOrderResponse | null = canReuseOrder(cached, fingerprint, Date.now())
        ? (cached as CachedOrder<CreateOrderResponse>).data
        : null;

      if (!data) {
        const res = await postJson(
          "/api/checkout/create-order",
          { ...orderRequest, analyticsSid: readAnalyticsSid() },
          CREATE_ORDER_TIMEOUT_MS
        );
        const parsed = (await res.json().catch(() => ({ ok: false }))) as CreateOrderResponse;
        if (!res.ok || !parsed.ok) {
          finishPay("error", parsed.error || "Could not start the payment. Please try again.");
          return;
        }

        // Safety net: the server recomputes the total from LIVE CMS prices. If it
        // differs from what the customer just saw (a price changed since these
        // items were added), never silently charge the new amount — refresh the
        // stale cart snapshots to TODAY's catalog so the page shows the new total,
        // then let them confirm with another click. Without the refresh this was a
        // dead end: the cart could only ever re-show the old price.
        if (typeof parsed.total === "number" && parsed.total !== Math.round(subtotalIncl)) {
          orderCacheRef.current = null;
          try {
            const slugs = Array.from(new Set(cartLines.map((l) => l.slug)));
            const rres = await postJson("/api/products/resolve", { slugs }, RESOLVE_TIMEOUT_MS);
            const rdata = (await rres.json()) as { products?: Product[] };
            const bySlug = new Map((rdata.products ?? []).map((pr) => [pr.slug, pr]));
            const lines = cartLines.map((l) => ({ slug: l.slug, qty: l.qty, size: l.size }));
            clearCart();
            for (const l of lines) {
              const pr = bySlug.get(l.slug);
              if (pr && pr.price) addToCart(pr, l.qty, l.size);
            }
          } catch {
            /* refresh failed — the message below still explains the situation */
          }
          finishPay(
            "error",
            `Prices were updated since you added these items — the total is now ${formatINR(
              parsed.total
            )} (charged in INR). The amounts above now show the current prices; please review and press Pay again.`
          );
          return;
        }

        data = parsed;
        orderCacheRef.current = { fingerprint, at: Date.now(), data };
      }

      const order = data;

      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) {
        finishPay(
          "error",
          "Could not load the secure payment window. Check your connection and try again."
        );
        return;
      }

      /*
       * Razorpay reports a failed attempt WITHOUT closing its window, so the
       * customer can correct their card and retry inside it. Record the reason
       * and let ondismiss surface it; a later success simply overtakes it.
       */
      let lastFailure: string | null = null;

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.razorpayOrderId,
        amount: order.amount,
        currency: order.currency,
        name: site.legalName,
        description: `Order ${order.orderNumber}`,
        prefill: { name: fullName, email: form.email, contact: `${dialCode}${phoneDigits}` },
        notes: { orderNumber: order.orderNumber ?? "" },
        theme: { color: "#d81f26" },
        // International customers see the USD equivalent inside the modal
        // (Razorpay's display-currency feature; the charge remains INR).
        ...(currency === "USD" && order.totalUsdApprox
          ? { display_currency: "USD", display_amount: order.totalUsdApprox.toFixed(2) }
          : {}),
        modal: {
          ondismiss: () => {
            finishPay("error", lastFailure ?? "Payment was cancelled — your cart is unchanged.");
            getTracker().track("payment_failed", {
              meta: { reason: lastFailure ? "failed" : "dismissed", value: order.total ?? 0 },
            });
          },
        },
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // The money has moved. Nothing below may report success unless the
          // server verifies the signature and says so.
          setPayStatus("verifying");
          try {
            const v = await postJson("/api/checkout/verify", resp, VERIFY_TIMEOUT_MS);
            const vd = (await v.json().catch(() => ({ ok: false }))) as {
              ok: boolean;
              orderNumber?: string;
              error?: string;
            };
            if (v.ok && vd.ok) {
              // Client-side purchase moment (analytics only; the CMS `paidAt`
              // remains the authoritative revenue record).
              getTracker().track("purchase", {
                meta: { order: vd.orderNumber ?? "", total: order.total ?? 0 },
              });
              // Drop the cached order so a back-navigation cannot reopen a
              // payment window for something already paid.
              orderCacheRef.current = null;
              finishPay("success", null);
              clearCart();
              router.push(`/checkout/success?order=${encodeURIComponent(vd.orderNumber ?? "")}`);
            } else {
              finishPay(
                "error",
                vd.error || "Payment verification failed. If you were charged, contact us."
              );
              getTracker().track("payment_failed", {
                meta: { reason: "verify_failed", value: order.total ?? 0 },
              });
            }
          } catch (err) {
            finishPay(
              "error",
              isTimeout(err)
                ? "Your payment may have gone through but we couldn't confirm it in time. Do not pay again — contact us with your payment ID and we'll complete the order."
                : "Could not verify the payment. If you were charged, contact us with your payment ID."
            );
            getTracker().track("payment_failed", {
              meta: { reason: "verify_error", value: order.total ?? 0 },
            });
          }
        },
      });

      if (typeof rzp.on === "function") {
        rzp.on("payment.failed", (e: RazorpayFailure) => {
          const why = e?.error?.description?.trim();
          lastFailure = why
            ? `Payment failed: ${why}`
            : "The payment didn't go through — no money was taken.";
        });
      }

      setPayStatus("awaiting_payment");
      rzp.open();
    } catch (err) {
      finishPay(
        "error",
        isTimeout(err)
          ? "The payment took too long to start. Please check your connection and try again."
          : "Something went wrong. Please try again."
      );
    }
  }

  // Wait for the cart to hydrate from localStorage before deciding it's empty —
  // otherwise a returning customer briefly sees a false "empty cart" on refresh.
  if (!ready) {
    return (
      <Container className="py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </Container>
    );
  }

  if (cartCount === 0) {
    return (
      <Container className="py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Add items before checking out.</p>
        <Button href="/shop" className="mt-6">Go to shop</Button>
      </Container>
    );
  }

  const phoneValid = validTick("phone");

  return (
    <Container className="py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Step n={1} title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                k="firstName" label="First name" required autoComplete="given-name"
                value={form.firstName} error={errors.firstName} valid={validTick("firstName")}
                onChange={upd("firstName")} onBlur={blur("firstName")}
              />
              <TextField
                k="lastName" label="Last name" required autoComplete="family-name"
                value={form.lastName} error={errors.lastName} valid={validTick("lastName")}
                onChange={upd("lastName")} onBlur={blur("lastName")}
              />
              <TextField
                k="email" label="Email" required type="email" autoComplete="email"
                hint="We'll email your order confirmation and GST invoice here."
                value={form.email} error={errors.email} valid={validTick("email")}
                onChange={upd("email")} onBlur={blur("email")}
              />

              {/* Phone with auto dialing-code prefix (filled from the selected country). */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <label htmlFor="f-phone" className="block text-xs font-medium text-muted-foreground">
                    Phone / landline<span className="text-brand"> *</span>
                  </label>
                  <InfoHint text="Your country's dialing code fills in automatically — just type your local number." />
                </div>
                <div
                  className={cx(
                    "flex items-stretch rounded-lg border bg-surface transition-colors focus-within:ring-2 focus-within:ring-ring/30",
                    errors.phone
                      ? "border-brand"
                      : phoneValid
                        ? "border-emerald-500/60"
                        : "border-input focus-within:border-brand"
                  )}
                >
                  {/* Searchable dial-code picker. Value is the country NAME
                      (US/Canada share +1) written to form.country via setCountry —
                      the same source the Country/region select reads, so the two
                      stay in sync both ways. */}
                  <CountryPicker
                    variant="compact"
                    value={form.country}
                    onChange={setCountry}
                    ariaLabel="Country dialing code"
                  />
                  <input
                    id="f-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                    placeholder={isIndia ? "10-digit mobile / landline" : "Local phone number"}
                    value={form.phone}
                    aria-required="true"
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={errors.phone ? "f-phone-err" : undefined}
                    onChange={(e) => upd("phone")(e.target.value.replace(/[^\d\s-]/g, ""))}
                    onBlur={blur("phone")}
                  />
                  {phoneValid && !errors.phone && (
                    <Check className="mr-3 h-4 w-4 shrink-0 self-center text-emerald-700 dark:text-emerald-400" aria-hidden />
                  )}
                </div>
                {errors.phone && (
                  <p id="f-phone-err" className="mt-1 text-xs text-brand" role="alert">
                    {errors.phone}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <TextField
                  k="company" label="Company (optional)" autoComplete="organization"
                  value={form.company} onChange={upd("company")} onBlur={blur("company")}
                />
              </div>
            </div>
            <div className="mt-4">
              <CheckRow id="f-marketingOptIn" checked={form.marketingOptIn} onChange={(v) => setForm((f) => ({ ...f, marketingOptIn: v }))}>
                Email me about new products, offers &amp; technical updates. You can unsubscribe anytime.
              </CheckRow>
            </div>
          </Step>

          <Step n={2} title="Shipping address">
            <div className="grid gap-4">
              <CountrySelect id="f-country" label="Country / region" required value={form.country} onChange={setCountry} />
              <TextField
                k="line1" label="Address line 1" required autoComplete="address-line1"
                value={form.line1} error={errors.line1} valid={validTick("line1")}
                onChange={upd("line1")} onBlur={blur("line1")}
              />
              <TextField
                k="line2" label="Address line 2 (optional)" autoComplete="address-line2"
                value={form.line2} onChange={upd("line2")} onBlur={blur("line2")}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  k="city" label="Town / City" required autoComplete="address-level2"
                  value={form.city} error={errors.city} valid={validTick("city")}
                  onChange={upd("city")} onBlur={blur("city")}
                />
                <TextField
                  k="state" label={isIndia ? "State" : "State / Province"} required={isIndia} autoComplete="address-level1"
                  value={form.state} error={errors.state} valid={validTick("state")}
                  onChange={upd("state")} onBlur={blur("state")}
                />
                <TextField
                  k="pincode" label={isIndia ? "PIN code / ZIP code" : "Postal / ZIP code"} required
                  inputMode={isIndia ? "numeric" : "text"} autoComplete="postal-code"
                  value={form.pincode} error={errors.pincode} valid={validTick("pincode")}
                  onChange={upd("pincode")} onBlur={blur("pincode")}
                />
              </div>
              <TextField
                k="deliveryNotes" label="Delivery instructions (optional)" autoComplete="off"
                placeholder="Landmark, gate/security info, preferred time…"
                value={form.deliveryNotes} onChange={upd("deliveryNotes")} onBlur={blur("deliveryNotes")}
              />
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                <span>
                  Tip: give a <span className="font-medium text-foreground">daytime / work address</span> —
                  our courier delivers during business hours. We ship across India &amp; worldwide;
                  international payments are charged in INR (your bank converts to your currency).
                </span>
              </p>

              {/* Billing address (defaults to same as shipping). */}
              <div className="mt-2 border-t border-border pt-4">
                <CheckRow id="f-billingSame" checked={form.billingSame} onChange={setBillingSame}>
                  My billing address is the same as my shipping address
                </CheckRow>

                {!form.billingSame && (
                  <div className="mt-4 grid gap-4 rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Billing address</p>
                    <TextField
                      k="bName" label="Billing name" required autoComplete="off"
                      value={form.bName} error={errors.bName} valid={validTick("bName")}
                      onChange={upd("bName")} onBlur={blur("bName")}
                    />
                    <TextField
                      k="bLine1" label="Address line 1" required autoComplete="off"
                      value={form.bLine1} error={errors.bLine1} valid={validTick("bLine1")}
                      onChange={upd("bLine1")} onBlur={blur("bLine1")}
                    />
                    <TextField
                      k="bLine2" label="Address line 2 (optional)" autoComplete="off"
                      value={form.bLine2} onChange={upd("bLine2")} onBlur={blur("bLine2")}
                    />
                    <CountrySelect id="f-bCountry" label="Country" required value={form.bCountry} onChange={setBCountry} />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <TextField
                        k="bCity" label="Town / City" required autoComplete="off"
                        value={form.bCity} error={errors.bCity} valid={validTick("bCity")}
                        onChange={upd("bCity")} onBlur={blur("bCity")}
                      />
                      <TextField
                        k="bState" label={isIndiaName(form.bCountry) ? "State" : "State / Province"} required={isIndiaName(form.bCountry)} autoComplete="off"
                        value={form.bState} error={errors.bState} valid={validTick("bState")}
                        onChange={upd("bState")} onBlur={blur("bState")}
                      />
                      <TextField
                        k="bPincode" label={isIndiaName(form.bCountry) ? "PIN code / ZIP code" : "Postal / ZIP code"} required autoComplete="off"
                        value={form.bPincode} error={errors.bPincode} valid={validTick("bPincode")}
                        onChange={upd("bPincode")} onBlur={blur("bPincode")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Step>

          <Step n={3} title="GST details (optional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                k="gstin" label="GSTIN" autoComplete="off"
                hint="15-character GST number — adds your business to the invoice for input-tax credit."
                placeholder="e.g. 27ABCDE1234F1Z5"
                value={form.gstin} error={errors.gstin} valid={validTick("gstin")}
                onChange={(v) => upd("gstin")(v.toUpperCase())} onBlur={blur("gstin")}
              />
              <TextField
                k="businessName" label="Business name" autoComplete="organization"
                value={form.businessName} onChange={upd("businessName")} onBlur={blur("businessName")}
              />
            </div>
          </Step>

          <Step n={4} title="Payment">
            <div className="flex items-center gap-3 rounded-lg border border-brand/40 bg-brand/5 px-4 py-3 text-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-brand" />
              <span>
                <span className="font-semibold">Razorpay secure checkout</span> — UPI, cards,
                netbanking &amp; wallets; the payment window shows the exact methods available
                for your card and region. You&apos;ll be charged {formatINR(subtotalIncl)} (incl. GST)
                {currency === "USD" ? <> — about {money(subtotalIncl)}</> : null}.
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Prefer a proforma invoice / bank transfer (B2B)?{" "}
              <Link href="/quote" className="text-brand underline underline-offset-2">Request a quote</Link> instead.
            </p>
          </Step>
        </div>

        {/* Order summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Your order</h2>
              <span className="text-xs text-muted-foreground">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {cartLines.map((l) => (
                <li key={l.key} className="flex items-center gap-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
                    {l.product.imageUrl ? (
                      // Was object-cover — cropped the edges off the product.
                      <ProductImage
                        src={l.product.imageUrl}
                        srcSet={l.product.imageSrcSet}
                        alt={l.product.name}
                        sizes="96px"
                        className="aspect-square h-full w-full"
                        imageClassName="p-0.5"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package className="h-4 w-4" aria-hidden />
                      </span>
                    )}
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                      {l.qty}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{l.product.name}</p>
                    {l.size ? <p className="truncate text-xs text-muted-foreground">{l.size}</p> : null}
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {l.product.price
                      ? money(inclGSTForProduct(l.product, l.unitPrice) * l.qty, usdFor(l.product, inclGSTForProduct(l.product, l.unitPrice) * l.qty))
                      : "On request"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums text-foreground">{money(subtotalExcl)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{cartGstRate === null ? "GST" : `GST (${cartGstRate}%)`}</span>
                <span className="tabular-nums text-foreground">{money(gstAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span className="text-right text-xs">Arranged separately — we&apos;ll confirm freight for your location</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-2.5">
                <span className="font-semibold">Total</span>
                <span className="font-display text-lg font-bold tabular-nums">{money(subtotalIncl, usdSubtotal)}</span>
              </div>
            </div>

            {hasQuoteOnly && (
              <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400" role="alert">
                Some items are quote-only and can&apos;t be paid online — request a quote for them, or
                remove them to continue.
              </p>
            )}
            {payError && (
              <p className="mt-4 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand" role="alert">
                {payError}
              </p>
            )}

            <Button
              type="button"
              onClick={handlePay}
              disabled={busy || hasQuoteOnly}
              aria-busy={busy}
              className="mt-5 w-full"
              size="lg"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {PAY_BUSY_LABEL[payStatus] ?? `Pay ${money(subtotalIncl, usdSubtotal)}`}
            </Button>
            {payStatus === "awaiting_payment" && (
              // The provider's window is a third-party iframe we do not control.
              // If it fails to appear, or the customer closes it in a way that
              // does not reach ondismiss, this is the way back — cheaper and far
              // more honest than guessing at the window's state from out here.
              <button
                type="button"
                onClick={() => finishPay("idle", null)}
                className="mt-2 w-full text-center text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                Payment window didn&apos;t open? Cancel and try again
              </button>
            )}
            <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              By placing this order you agree to our{" "}
              <Link href="/terms" className="underline hover:text-foreground">Terms</Link>,{" "}
              <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link> and{" "}
              <Link href="/replacement-policy" className="underline hover:text-foreground">Replacement Policy</Link>.
            </p>
            {currency === "USD" && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Charged in INR as <span className="font-semibold">{formatINR(subtotalIncl)}</span> —
                your bank converts to your currency. Dollar prices are indicative.
              </p>
            )}
            <Button href="/quote" variant="outline" className="mt-2 w-full">
              <FileText className="h-4 w-4" /> Request quote instead
            </Button>
            <div className="mt-3 space-y-1.5 text-center">
              <p className="text-xs text-muted-foreground">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-brand" />
                Secured by Razorpay · GST invoice with every order
              </p>
              <p className="text-[11px] text-muted-foreground">
                Accepts UPI · Visa · Mastercard · Netbanking · Wallets
              </p>
            </div>
            <Link href="/cart" className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground">
              ← Back to cart
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
}
