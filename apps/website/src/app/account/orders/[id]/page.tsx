import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Package, XCircle, FileText } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { ReorderButton } from "@/frontend/components/commerce/reorder-button";
import { formatINR } from "@/frontend/lib/catalog";
import { getCurrentCustomer, getCustomerOrder } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

const STEPS = ["Order placed", "Payment confirmed", "Shipped", "Delivered"];
const STAGE: Record<string, number> = { pending: 0, paid: 1, shipped: 2, delivered: 3 };
const STATUS_STYLE: Record<string, string> = {
  paid: "text-emerald-600 bg-emerald-500/10",
  shipped: "text-indigo-600 bg-indigo-500/10",
  delivered: "text-emerald-600 bg-emerald-500/10",
  pending: "text-amber-600 bg-amber-500/10",
  failed: "text-brand bg-brand/10",
  cancelled: "text-muted-foreground bg-muted",
  refunded: "text-purple-600 bg-purple-500/10",
};
const HALTED = new Set(["cancelled", "failed", "refunded"]);

function fmtDate(iso?: string) {
  return iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderNumber = decodeURIComponent(id);
  const customer = await getCurrentCustomer();
  const order = await getCustomerOrder(customer?.email, orderNumber);

  const back = (
    <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to orders
    </Link>
  );

  if (!order) {
    return (
      <div className="space-y-6">
        {back}
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-semibold">Order not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We couldn&apos;t find this order on your account.
          </p>
          <Button href="/account/orders" className="mt-5">Back to orders</Button>
        </div>
      </div>
    );
  }

  const status = (order.status || "pending").toLowerCase();
  const halted = HALTED.has(status);
  const stage = STAGE[status] ?? 0;

  return (
    <div className="space-y-6">
      {back}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{order.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">Placed {fmtDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {["paid", "shipped", "delivered"].includes(status) && (
            <a
              href={`/api/orders/${encodeURIComponent(order.orderNumber || "")}/invoice`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              <FileText className="h-4 w-4" /> Invoice
            </a>
          )}
          {(order.items ?? []).some((it) => it.slug) && (
            <ReorderButton items={(order.items ?? []).map((it) => ({ slug: it.slug, qty: it.qty }))} />
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[status] || "bg-muted text-muted-foreground"}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Tracking */}
      <Card>
        <h3 className="font-display font-semibold">Tracking</h3>
        {halted ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <XCircle className="h-5 w-5 text-brand" />
            <span>
              This order is <span className="font-medium capitalize">{status}</span>.{" "}
              {status === "refunded" ? "A replacement may apply — see our policy." : "Contact support if you need help."}
            </span>
          </div>
        ) : (
          <ol className="mt-5 space-y-4">
            {STEPS.map((s, i) => {
              const done = i <= stage;
              return (
                <li key={s} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-brand" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                  <span className={done ? "font-medium" : "text-muted-foreground"}>{s}</span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* Items */}
      <Card>
        <h3 className="font-display font-semibold">Items</h3>
        <div className="mt-4 divide-y divide-border">
          {(order.items ?? []).map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{it.productName}</span>
                <span className="text-muted-foreground"> × {it.qty}</span>
                {it.sku && <span className="ml-2 text-xs text-muted-foreground">{it.sku}</span>}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{formatINR(it.lineTotal || 0)}</span>
            </div>
          ))}
        </div>
        <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal (incl. GST)</dt><dd className="tabular-nums">{formatINR(order.subtotal || order.total || 0)}</dd></div>
          {order.gstAmount ? (
            <div className="flex justify-between text-muted-foreground"><dt>of which GST</dt><dd className="tabular-nums">{formatINR(order.gstAmount)}</dd></div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(order.total || 0)}</dd></div>
        </dl>
      </Card>

      {/* Shipping + payment */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="font-display font-semibold">Shipping address</h3>
          <address className="mt-3 text-sm not-italic text-muted-foreground">
            <span className="block font-medium text-foreground/90">{order.name}</span>
            {order.addressLine1 && <span className="block">{order.addressLine1}</span>}
            {order.addressLine2 && <span className="block">{order.addressLine2}</span>}
            <span className="block">{[order.city, order.state, order.pincode].filter(Boolean).join(", ")}</span>
            {order.country && <span className="block">{order.country}</span>}
            {order.phone && <span className="mt-1 block">{order.phone}</span>}
          </address>
        </Card>
        <Card>
          <h3 className="font-display font-semibold">Payment</h3>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p>Charged in INR via Razorpay.</p>
            {order.paidAt && <p>Paid on {fmtDate(order.paidAt)}.</p>}
            {order.razorpayPaymentId && <p className="break-all text-xs">Ref: {order.razorpayPaymentId}</p>}
            {order.gstin && <p>GSTIN: {order.gstin}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
