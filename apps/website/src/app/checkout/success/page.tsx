import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Package, ArrowRight, Mail, LifeBuoy } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

/**
 * Post-payment confirmation. Server component — the order number arrives via
 * the query string after server-side signature verification succeeded.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
          Payment successful — order confirmed!
        </h1>
        {order && (
          <p className="mt-3 text-lg">
            Order number{" "}
            <span className="rounded-lg bg-surface px-3 py-1 font-display font-bold tabular-nums text-brand">
              {order}
            </span>
          </p>
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
            href={order ? `/support?order=${encodeURIComponent(order)}` : "/support"}
            variant="outline"
          >
            <LifeBuoy className="h-4 w-4" /> Need help with this order?
          </Button>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Questions about your order? Reply to the confirmation email,{" "}
          <Link
            href={order ? `/support?order=${encodeURIComponent(order)}` : "/support"}
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
