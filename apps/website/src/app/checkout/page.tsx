"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Loader2, ShieldCheck, FileText } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { formatINR, inclGST, usdFor, lineUsdValue } from "@/frontend/lib/catalog";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";

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

type Form = {
  name: string;
  email: string;
  phone: string;
  company: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  region: "IN" | "INTL";
  country: string;
  gstin: string;
  businessName: string;
};

const EMPTY: Form = {
  name: "", email: "", phone: "", company: "",
  line1: "", line2: "", city: "", state: "", pincode: "",
  region: "IN", country: "",
  gstin: "", businessName: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { cartLines, cartCount, clearCart, ready } = useStore();
  const { money, currency, usdRate } = useCurrency();
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Form, string>>>({});
  const [paying, setPaying] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);

  // Display GST-inclusive totals (catalog stores base prices excl. GST).
  const subtotalIncl = cartLines.reduce((n, l) => n + inclGST(l.unitPrice) * l.qty, 0);
  const usdSubtotal =
    currency === "USD"
      ? cartLines.reduce((n, l) => n + lineUsdValue(l.product, l.unitPrice, l.qty, usdRate), 0)
      : undefined;
  const hasQuoteOnly = cartLines.some((l) => !l.product.price);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const isIndia = form.region === "IN";

  function validate(): boolean {
    const er: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) er.name = "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = "Please enter a valid email.";
    const digits = form.phone.replace(/\D/g, "");
    if (isIndia ? !/^\d{10}$/.test(digits.slice(-10)) : digits.length < 8 || digits.length > 15) {
      er.phone = "Please enter a valid phone number.";
    }
    if (!form.line1.trim()) er.line1 = "Address is required for shipping.";
    if (!form.city.trim()) er.city = "Required.";
    if (isIndia && !form.state.trim()) er.state = "Required.";
    if (isIndia ? !/^\d{6}$/.test(form.pincode.trim()) : !form.pincode.trim()) {
      er.pincode = isIndia ? "6-digit PIN." : "Required.";
    }
    if (!isIndia && !form.country.trim()) er.country = "Please enter your country.";
    setErrors(er);
    const first = Object.keys(er)[0];
    if (first) document.getElementById(`f-${first}`)?.focus();
    return Object.keys(er).length === 0;
  }

  async function handlePay() {
    setPayError(null);
    if (!validate()) return;
    setPaying(true);
    try {
      // 1) Server creates the Razorpay order from CMS prices.
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone, company: form.company },
          address: {
            line1: form.line1, line2: form.line2, city: form.city,
            state: form.state, pincode: form.pincode,
            country: isIndia ? "India" : form.country.trim(),
          },
          gstin: form.gstin,
          businessName: form.businessName,
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
        name: "METNMAT Research & Innovations",
        description: `Order ${data.orderNumber}`,
        prefill: { name: form.name, email: form.email, contact: form.phone },
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

  return (
    <Container className="py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Step n={1} title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="f-name" required>Full name</Label>
                <input id="f-name" className={field} autoComplete="name" value={form.name} onChange={set("name")} />
                {errors.name && <p className="mt-1 text-xs text-brand" role="alert">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="f-email" required>Email</Label>
                <input id="f-email" className={field} type="email" autoComplete="email" value={form.email} onChange={set("email")} />
                {errors.email && <p className="mt-1 text-xs text-brand" role="alert">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="f-phone" required>Phone</Label>
                <input id="f-phone" className={field} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
                {errors.phone && <p className="mt-1 text-xs text-brand" role="alert">{errors.phone}</p>}
              </div>
              <div>
                <Label htmlFor="f-company">Company (optional)</Label>
                <input id="f-company" className={field} autoComplete="organization" value={form.company} onChange={set("company")} />
              </div>
            </div>
          </Step>

          <Step n={2} title="Shipping address">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="f-region" required>Shipping to</Label>
                <select
                  id="f-region"
                  className={field}
                  value={form.region}
                  onChange={(e) => {
                    const region = e.target.value as Form["region"];
                    setForm((f) => ({ ...f, region, country: region === "IN" ? "" : f.country }));
                    setErrors((er) => ({ ...er, pincode: undefined, state: undefined, country: undefined }));
                    // Note: currency is decided by geo-IP + live rates only —
                    // the shipping destination never overrides it.
                  }}
                >
                  <option value="IN">India</option>
                  <option value="INTL">International (worldwide shipping)</option>
                </select>
              </div>
              {!isIndia && (
                <div>
                  <Label htmlFor="f-country" required>Country</Label>
                  <input id="f-country" className={field} autoComplete="country-name" placeholder="e.g. United States, Germany, UAE" value={form.country} onChange={set("country")} />
                  {errors.country && <p className="mt-1 text-xs text-brand" role="alert">{errors.country}</p>}
                </div>
              )}
              <div>
                <Label htmlFor="f-line1" required>Address line 1</Label>
                <input id="f-line1" className={field} autoComplete="address-line1" value={form.line1} onChange={set("line1")} />
                {errors.line1 && <p className="mt-1 text-xs text-brand" role="alert">{errors.line1}</p>}
              </div>
              <div>
                <Label htmlFor="f-line2">Address line 2 (optional)</Label>
                <input id="f-line2" className={field} autoComplete="address-line2" value={form.line2} onChange={set("line2")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="f-city" required>City</Label>
                  <input id="f-city" className={field} autoComplete="address-level2" value={form.city} onChange={set("city")} />
                  {errors.city && <p className="mt-1 text-xs text-brand" role="alert">{errors.city}</p>}
                </div>
                <div>
                  <Label htmlFor="f-state" required={isIndia}>{isIndia ? "State" : "State / Province"}</Label>
                  <input id="f-state" className={field} autoComplete="address-level1" value={form.state} onChange={set("state")} />
                  {errors.state && <p className="mt-1 text-xs text-brand" role="alert">{errors.state}</p>}
                </div>
                <div>
                  <Label htmlFor="f-pincode" required>{isIndia ? "PIN code" : "Postal / ZIP code"}</Label>
                  <input id="f-pincode" className={field} inputMode={isIndia ? "numeric" : "text"} autoComplete="postal-code" value={form.pincode} onChange={set("pincode")} />
                  {errors.pincode && <p className="mt-1 text-xs text-brand" role="alert">{errors.pincode}</p>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                We ship across India &amp; worldwide. International payments are charged in INR
                (your bank converts to your currency).
              </p>
            </div>
          </Step>

          <Step n={3} title="GST details (optional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="f-gstin">GSTIN</Label>
                <input id="f-gstin" className={field} value={form.gstin} onChange={set("gstin")} placeholder="For GST input credit on your invoice" />
              </div>
              <div>
                <Label htmlFor="f-businessName">Business name</Label>
                <input id="f-businessName" className={field} value={form.businessName} onChange={set("businessName")} />
              </div>
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
