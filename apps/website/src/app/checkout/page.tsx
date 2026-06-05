"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { formatINR } from "@/frontend/lib/catalog";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

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

export default function CheckoutPage() {
  const { cartLines, cartSubtotal, cartCount } = useStore();

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
        {/* Steps — UI only. TODO(feature): wire address, GST, payment (Razorpay/Stripe), orders. */}
        <div className="space-y-5">
          <Step n={1} title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <input className={field} placeholder="Full name" />
              <input className={field} placeholder="Email" type="email" />
              <input className={field} placeholder="Phone" />
              <input className={field} placeholder="Company (optional)" />
            </div>
          </Step>

          <Step n={2} title="Shipping address">
            <div className="grid gap-4">
              <input className={field} placeholder="Address line 1" />
              <input className={field} placeholder="Address line 2 (optional)" />
              <div className="grid gap-4 sm:grid-cols-3">
                <input className={field} placeholder="City" />
                <input className={field} placeholder="State" />
                <input className={field} placeholder="PIN code" />
              </div>
              <select className={field} defaultValue="IN">
                <option value="IN">India</option>
                <option value="INTL">International</option>
              </select>
            </div>
          </Step>

          <Step n={3} title="GST details (optional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <input className={field} placeholder="GSTIN" />
              <input className={field} placeholder="Business name" />
            </div>
          </Step>

          <Step n={4} title="Payment">
            {/* TODO(feature): Razorpay (INR) + Stripe/PayPal (international). */}
            <div className="space-y-2">
              {["Razorpay (UPI / Cards / Netbanking)", "Stripe / PayPal (International)", "Bank transfer (B2B)"].map(
                (m, i) => (
                  <label key={m} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm">
                    <input type="radio" name="pay" defaultChecked={i === 0} className="accent-brand" />
                    {m}
                  </label>
                )
              )}
            </div>
          </Step>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-semibold">Your order</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {cartLines.map((l) => (
                <li key={l.slug} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {l.product.name} × {l.qty}
                  </span>
                  <span className="font-medium">
                    {l.product.price ? formatINR(l.lineTotal) : "On request"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">Subtotal (excl. GST)</span>
              <span className="font-semibold">{formatINR(cartSubtotal)}</span>
            </div>
            <Button type="button" className="mt-5 w-full" size="lg">
              <Lock className="h-4 w-4" /> Place order
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Demo checkout — payment is not yet connected.
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
