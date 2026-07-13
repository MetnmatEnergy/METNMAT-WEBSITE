import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Package, ArrowRight, Mail, LifeBuoy, AlertCircle } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { formatINR } from "@/frontend/lib/catalog";
import { getOrderByNumber, getCurrentCustomer } from "@/backend/lib/customer";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

/**
 * Post-payment confirmation. The order number arrives via the query string, but
 * we DO NOT trust it: the order is looked up server-side and "Payment successful"
 * is shown ONLY when its status is genuinely `paid`. Personal/shipping details
 * are revealed only to the signed-in owner of the order.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;

  const [order, me] = await Promise.all([
    orderNumber ? getOrderByNumber(orderNumber) : Promise.resolve(null),
    getCurrentCustomer(),
  ]);

  // Any post-payment status confirms the purchase — a buyer revisiting this
  // page after staff mark the order shipped/delivered must not see an alarming
  // "couldn't confirm" (refunded is also post-payment, but success copy would
  // mislead there; those buyers get the not-confirmed branch's support links).
  const paid = order?.status === "paid" || order?.status === "shipped" || order?.status === "delivered";
  // Ownership mirrors ownerClause(): the ACCOUNT LINK on the order is always
  // proof (the buyer was signed in when they placed it — covers unverified
  // accounts seeing their own fresh purchase), while an EMAIL match alone
  // requires a VERIFIED email — registration doesn't verify, so an unverified
  // account matching a guest order's email must not unlock the address/items.
  const isOwner =
    (!!me?.id && !!order?.customer && me.id === order.customer) ||
    (!!me?.email &&
      !!me?.emailVerified &&
      !!order?.email &&
      me.email.toLowerCase() === order.email.toLowerCase());

  // ── Not a confirmed paid order: never claim success ───────────────────────────
  if (!paid) {
    return (
      <Container className="py-16">
        <div className="mx-auto max-w-lg text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
            <AlertCircle className="h-10 w-10 text-amber-500" />
          </span>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            We couldn&apos;t confirm this order
          </h1>
          <p className="mt-3 text-muted-foreground">
            {orderNumber
              ? "If your payment went through, a confirmation email is on its way — it can take a moment to reflect here. If you were charged but don't receive it, contact us with your payment ID."
              : "No order reference was provided. If you just paid, check your email for the confirmation."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/shop">
              Continue shopping <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              href={orderNumber ? `/support?order=${encodeURIComponent(orderNumber)}` : "/support"}
              variant="outline"
            >
              <LifeBuoy className="h-4 w-4" /> Contact support
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
          Payment successful — order confirmed!
        </h1>
        <p className="mt-3 text-lg">
          Order number{" "}
          <span className="rounded-lg bg-surface px-3 py-1 font-display font-bold tabular-nums text-brand">
            {order!.orderNumber}
          </span>
        </p>

        {/* Order summary — owner-only (the order number is enough for a guest;
            full contents could otherwise be read by guessing an order number). */}
        {isOwner && order!.items && order!.items.length > 0 && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-surface p-5 text-left">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Order summary
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {order!.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {it.productName} × {it.qty}
                  </span>
                  <span className="font-medium tabular-nums">{formatINR(it.lineTotal ?? 0)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
              <span className="font-semibold">Total paid (incl. GST)</span>
              <span className="font-display font-bold tabular-nums">{formatINR(order!.total ?? 0)}</span>
            </div>
            {isOwner && (order!.addressLine1 || order!.city) && (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                Shipping to:{" "}
                {[order!.addressLine1, order!.addressLine2, order!.city, order!.state, order!.pincode, order!.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="mx-auto mt-6 max-w-md space-y-3 text-left text-sm text-muted-foreground">
          <p className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            A confirmation email with your order details is on its way to your inbox.
          </p>
          <p className="flex items-start gap-3">
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            Our team will process your order and share dispatch details. A GST invoice
            accompanies every shipment.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/shop">
            Continue shopping <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            href={`/support?order=${encodeURIComponent(order!.orderNumber ?? "")}`}
            variant="outline"
          >
            <LifeBuoy className="h-4 w-4" /> Need help with this order?
          </Button>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Questions about your order? Reply to the confirmation email,{" "}
          <Link
            href={`/support?order=${encodeURIComponent(order!.orderNumber ?? "")}`}
            className="text-brand underline underline-offset-2"
          >
            raise a support ticket
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="text-brand underline underline-offset-2">
            reach our team
          </Link>{" "}
          — quote your order number.
        </p>
      </div>
    </Container>
  );
}
