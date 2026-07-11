import Link from "next/link";
import { Package, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { formatINR } from "@/frontend/lib/catalog";
import { getCurrentCustomer, getCustomerOrders } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  paid: "text-emerald-600 bg-emerald-500/10",
  shipped: "text-indigo-600 bg-indigo-500/10",
  delivered: "text-emerald-600 bg-emerald-500/10",
  pending: "text-amber-600 bg-amber-500/10",
  failed: "text-brand bg-brand/10",
  cancelled: "text-muted-foreground bg-muted",
  refunded: "text-purple-600 bg-purple-500/10",
};

/** Honest customer-facing labels — "pending" reads like it's in hand; it isn't. */
const STATUS_LABEL: Record<string, string> = {
  pending: "Payment incomplete",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  failed: "Payment failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function OrdersPage() {
  const customer = await getCurrentCustomer();
  const result = await getCustomerOrders(customer);

  // A CMS hiccup must not masquerade as "you have no orders".
  if (!result.ok) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center">
        <RefreshCw className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 font-display text-lg font-semibold">We couldn&apos;t load your orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong on our side — your orders are safe. Please refresh in a moment.
        </p>
      </div>
    );
  }
  const orders = result.orders;

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center">
        <Package className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 font-display text-lg font-semibold">No orders yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your orders and tracking will show up here.</p>
        <Button href="/shop" className="mt-5">Start shopping</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o, i) => {
        const date = o.createdAt
          ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "—";
        const itemCount = (o.items ?? []).reduce((n, it) => n + (it.qty || 0), 0);
        const status = (o.status || "pending").toLowerCase();
        const href = o.orderNumber ? `/account/orders/${encodeURIComponent(o.orderNumber)}` : "#";
        return (
          <Link
            key={i}
            href={href}
            className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand/40 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold">{o.orderNumber || "Order"}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] || "bg-muted text-muted-foreground"}`}>
                    {STATUS_LABEL[status] || status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {date} · {itemCount} item{itemCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{formatINR(o.total || 0)}</div>
                  <p className="text-xs text-muted-foreground">incl. GST</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            {(o.items ?? []).length > 0 && (
              <p className="mt-3 truncate border-t border-border pt-3 text-sm text-muted-foreground">
                {(o.items ?? []).map((it) => `${it.productName}${it.qty ? ` ×${it.qty}` : ""}`).join(", ")}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
