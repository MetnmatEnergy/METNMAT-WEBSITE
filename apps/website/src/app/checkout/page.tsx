"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Loader2, ShieldCheck, FileText, Check, HelpCircle, Truck } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { formatINR, inclGST, usdFor, lineUsdValue } from "@/frontend/lib/catalog";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";
import { site } from "@/frontend/lib/site";
import { COUNTRIES, dialFor, isIndiaName } from "@/frontend/lib/countries";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/** Load Razorpay checkout.js once. */
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

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
          <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" aria-hidden />
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

/** Full-country dropdown. Value is the country name (kept in sync with the order). */
function CountrySelect({
  id,
  label,
  required,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} required={required}>{label}</Label>
      <select id={id} className={field} autoComplete="country-name" value={value} onChange={(e) => onChange(e.target.value)}>
        {COUNTRIES.map((c) => (
          <option key={c.iso2} value={c.name}>
            {c.name} ({c.dial})
          </option>
        ))}
      </select>
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
  const { cartLines, cartCount, clearCart, ready } = useStore();
  const { money, currency, usdRate } = useCurrency();
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Set<string>>(() => new Set());
  const [paying, setPaying] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);

  // Display GST-inclusive totals (catalog stores base prices excl. GST).
  const subtotalIncl = cartLines.reduce((n, l) => n + inclGST(l.unitPrice) * l.qty, 0);
  const usdSubtotal =
    currency === "USD"
      ? cartLines.reduce((n, l) => n + lineUsdValue(l.product, l.unitPrice, l.qty, usdRate), 0)
      : undefined;
  const hasQuoteOnly = cartLines.some((l) => !l.product.price);
  const isIndia = isIndiaName(form.country);
  const dialCode = dialFor(form.country) || "+91";

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

  async function handlePay() {
    setPayError(null);
    if (!validate()) return;
    setPaying(true);
    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      const phoneDigits = form.phone.replace(/\D/g, "");
      const fullPhone = `${dialCode} ${form.phone.trim()}`.trim();
      // 1) Server creates the Razorpay order from CMS prices.
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          items: cartLines.map((l) => ({ slug: l.slug, qty: l.qty })),
          displayCurrency: currency,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean; error?: string; keyId?: string; razorpayOrderId?: string;
        amount?: number; currency?: string; orderNumber?: string; total?: number; totalUsdApprox?: number;
      };
      if (!res.ok || !data.ok) {
        setPayError(data.error || "Could not start the payment. Please try again.");
        setPaying(false);
        return;
      }

      // Safety net: the server recomputes the total from LIVE CMS prices. If it
      // differs from what the customer just saw (a price changed since these
      // items were added), never silently charge the new amount — stop and ask
      // them to review. With MOQ/qty clamped identically client+server, the only
      // cause of a mismatch is a genuine price change.
      if (typeof data.total === "number" && data.total !== Math.round(subtotalIncl)) {
        setPayError(
          `Prices changed since you added these items — the order total is now ${formatINR(
            data.total
          )} (charged in INR). Please review your cart and try again.`
        );
        setPaying(false);
        return;
      }

      // 2) Open the Razorpay modal.
      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) {
        setPayError("Could not load the secure payment window. Check your connection and try again.");
        setPaying(false);
        return;
      }
      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency,
        name: site.legalName,
        description: `Order ${data.orderNumber}`,
        prefill: { name: fullName, email: form.email, contact: `${dialCode}${phoneDigits}` },
        notes: { orderNumber: data.orderNumber ?? "" },
        theme: { color: "#d81f26" },
        // International customers see the USD equivalent inside the modal
        // (Razorpay's display-currency feature; the charge remains INR).
        ...(currency === "USD" && data.totalUsdApprox
          ? { display_currency: "USD", display_amount: data.totalUsdApprox.toFixed(2) }
          : {}),
        modal: {
          ondismiss: () => {
            setPaying(false);
            setPayError("Payment was cancelled — your cart is unchanged.");
          },
        },
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // 3) Verify the signature server-side before trusting anything.
          try {
            const v = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const vd = (await v.json()) as { ok: boolean; orderNumber?: string; error?: string };
            if (v.ok && vd.ok) {
              clearCart();
              router.push(`/checkout/success?order=${encodeURIComponent(vd.orderNumber ?? "")}`);
            } else {
              setPaying(false);
              setPayError(vd.error || "Payment verification failed. If you were charged, contact us.");
            }
          } catch {
            setPaying(false);
            setPayError("Could not verify the payment. If you were charged, contact us with your payment ID.");
          }
        },
      });
      rzp.open();
    } catch {
      setPaying(false);
      setPayError("Something went wrong. Please try again.");
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
                    Phone<span className="text-brand"> *</span>
                  </label>
                  <InfoHint text="Your country's dialing code fills in automatically — just type your local number." />
                </div>
                <div
                  className={cx(
                    "flex items-stretch overflow-hidden rounded-lg border bg-surface transition-colors focus-within:ring-2 focus-within:ring-ring/30",
                    errors.phone
                      ? "border-brand"
                      : phoneValid
                        ? "border-emerald-500/60"
                        : "border-input focus-within:border-brand"
                  )}
                >
                  <span
                    className="flex shrink-0 select-none items-center border-r border-input bg-background/40 px-3 text-sm font-medium text-foreground"
                    aria-hidden
                  >
                    {dialCode}
                  </span>
                  <input
                    id="f-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                    placeholder={isIndia ? "10-digit mobile number" : "Local phone number"}
                    value={form.phone}
                    aria-required="true"
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={errors.phone ? "f-phone-err" : undefined}
                    onChange={(e) => upd("phone")(e.target.value.replace(/[^\d\s-]/g, ""))}
                    onBlur={blur("phone")}
                  />
                  {phoneValid && !errors.phone && (
                    <Check className="mr-3 h-4 w-4 shrink-0 self-center text-emerald-500" aria-hidden />
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
                  k="city" label="City" required autoComplete="address-level2"
                  value={form.city} error={errors.city} valid={validTick("city")}
                  onChange={upd("city")} onBlur={blur("city")}
                />
                <TextField
                  k="state" label={isIndia ? "State" : "State / Province"} required={isIndia} autoComplete="address-level1"
                  value={form.state} error={errors.state} valid={validTick("state")}
                  onChange={upd("state")} onBlur={blur("state")}
                />
                <TextField
                  k="pincode" label={isIndia ? "PIN code" : "Postal / ZIP code"} required
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
                        k="bCity" label="City" required autoComplete="off"
                        value={form.bCity} error={errors.bCity} valid={validTick("bCity")}
                        onChange={upd("bCity")} onBlur={blur("bCity")}
                      />
                      <TextField
                        k="bState" label={isIndiaName(form.bCountry) ? "State" : "State / Province"} required={isIndiaName(form.bCountry)} autoComplete="off"
                        value={form.bState} error={errors.bState} valid={validTick("bState")}
                        onChange={upd("bState")} onBlur={blur("bState")}
                      />
                      <TextField
                        k="bPincode" label={isIndiaName(form.bCountry) ? "PIN code" : "Postal / ZIP"} required autoComplete="off"
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
                netbanking &amp; wallets. International Visa/Mastercard &amp; PayPal accepted.
                You&apos;ll be charged {formatINR(subtotalIncl)} (incl. GST)
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
            <h2 className="font-display text-lg font-semibold">Your order</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {cartLines.map((l) => (
                <li key={l.slug} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {l.product.name} × {l.qty}
                  </span>
                  <span className="font-medium tabular-nums">
                    {l.product.price
                      ? money(inclGST(l.unitPrice) * l.qty, usdFor(l.product, inclGST(l.unitPrice) * l.qty))
                      : "On request"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (incl. GST)</span>
                <span className="font-semibold tabular-nums">{money(subtotalIncl, usdSubtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Includes GST</p>
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
              disabled={paying || hasQuoteOnly}
              className="mt-5 w-full"
              size="lg"
            >
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {paying ? "Opening secure payment…" : `Pay ${money(subtotalIncl, usdSubtotal)}`}
            </Button>
            {currency === "USD" && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Charged in INR as <span className="font-semibold">{formatINR(subtotalIncl)}</span> —
                your bank converts to your currency. Dollar prices are indicative.
              </p>
            )}
            <Button href="/quote" variant="outline" className="mt-2 w-full">
              <FileText className="h-4 w-4" /> Request quote instead
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-brand" />
              Secured by Razorpay · GST invoice with every order
            </p>
            <Link href="/cart" className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground">
              ← Back to cart
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
}
