import Link from "next/link";
import { ArrowLeft, Package, XCircle, FileText, Truck, RefreshCw, ExternalLink } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { OrderTracking, type OrderTrackingStep } from "@/frontend/components/ui/order-tracking";
import { ReorderButton } from "@/frontend/components/commerce/reorder-button";
import { formatINR } from "@/frontend/lib/catalog";
import {
  getCurrentCustomer,
  getCustomerOrder,
  getOrderShipments,
  getCommerceSettings,
  type FullOrder,
  type ShipmentDoc,
} from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

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
const STATUS_LABEL: Record<string, string> = {
  pending: "Payment incomplete",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  failed: "Payment failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
const HALTED = new Set(["cancelled", "failed", "refunded"]);

function fmtDate(iso?: string) {
  return iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

function fmtDateTime(iso?: string) {
  return iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : undefined;
}

/**
 * Build the tracking timeline from what staff actually record in the CMS:
 * order.createdAt / paidAt, shipment dispatchedAt / deliveredAt (Shipments
 * record), and the terminal timestamps the workflow hook stamps (failedAt /
 * cancelledAt / refundedAt). Completed steps show their real timestamp; future
 * steps show "Pending"; a completed legacy step with no recorded time shows no
 * timestamp rather than a fake one. Terminal states end the bar with a red ✕
 * step at the point the order actually stopped.
 */
function buildTrackingSteps(order: FullOrder, shipment?: ShipmentDoc): OrderTrackingStep[] {
  const status = (order.status || "pending").toLowerCase();
  const placed: OrderTrackingStep = {
    name: "Order placed",
    isCompleted: true,
    timestamp: fmtDateTime(order.createdAt),
  };
  const paidStep = (done: boolean): OrderTrackingStep => ({
    name: "Payment confirmed",
    isCompleted: done,
    timestamp: done ? fmtDateTime(order.paidAt) : "Pending",
  });

  if (status === "failed") {
    return [placed, { name: "Payment failed", isCompleted: false, isError: true, timestamp: fmtDateTime(order.failedAt) }];
  }
  if (status === "cancelled") {
    const steps: OrderTrackingStep[] = [placed];
    if (order.paidAt) steps.push(paidStep(true));
    else if (order.failedAt)
      steps.push({ name: "Payment failed", isCompleted: false, isError: true, timestamp: fmtDateTime(order.failedAt) });
    steps.push({ name: "Order cancelled", isCompleted: false, isError: true, timestamp: fmtDateTime(order.cancelledAt) });
    return steps;
  }
  if (status === "refunded") {
    const steps: OrderTrackingStep[] = [placed, paidStep(true)];
    if (shipment?.dispatchedAt)
      steps.push({ name: "Shipped", isCompleted: true, timestamp: fmtDateTime(shipment.dispatchedAt) });
    steps.push({ name: "Refunded", isCompleted: false, isError: true, timestamp: fmtDateTime(order.refundedAt) });
    return steps;
  }

  const stage = STAGE[status] ?? 0;
  const at = (done: boolean, iso?: string) => (done ? fmtDateTime(iso) : "Pending");
  return [
    placed,
    paidStep(stage >= 1),
    { name: "Shipped", isCompleted: stage >= 2, timestamp: at(stage >= 2, shipment?.dispatchedAt) },
    { name: "Delivered", isCompleted: stage >= 3, timestamp: at(stage >= 3, shipment?.deliveredAt) },
  ];
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderNumber = decodeURIComponent(id);
  const customer = await getCurrentCustomer();
  const result = await getCustomerOrder(customer, orderNumber);

  const back = (
    <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to orders
    </Link>
  );

  // A CMS hiccup must read as an error, not as "this order doesn't exist".
  if (!result.ok) {
    return (
      <div className="space-y-6">
        {back}
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <RefreshCw className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-semibold">We couldn&apos;t load this order</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong on our side — please refresh in a moment.
          </p>
        </div>
      </div>
    );
  }
  const order = result.order;

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

  // Real tracking (carrier / number / link / timestamps) from the Shipments
  // records staff maintain in the CMS. Fetched from "paid" onwards so a
  // pre-created shipment (carrier booked, awaiting pickup) already shows.
  const shipments = ["paid", "shipped", "delivered"].includes(status)
    ? await getOrderShipments(order.id)
    : [];
  const shipment = shipments[0];
  const trackingSteps = buildTrackingSteps(order, shipment);

  // Staff-configured auto-cancel policy — quoted in the pending banner so the
  // customer knows exactly what happens to an unpaid order.
  const autoCancel =
    status === "pending"
      ? await getCommerceSettings()
      : { autoCancelUnpaidOrders: false, autoCancelAfterHours: 24 };

  const showBilling =
    order.billingSameAsShipping === false && Boolean(order.billingLine1 || order.billingCity);

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
            <ReorderButton items={(order.items ?? []).map((it) => ({ slug: it.slug, qty: it.qty, size: it.size }))} />
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status] || "bg-muted text-muted-foreground"}`}>
            {STATUS_LABEL[status] || status}
          </span>
        </div>
      </div>

      {/* Payment-incomplete orders: say exactly where things stand. */}
      {status === "pending" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">This order&apos;s payment was not completed.</p>
            <p className="mt-0.5 text-muted-foreground">
              If you were charged, it will be confirmed automatically within a few minutes — otherwise you can
              re-order the same items with the Reorder button.
              {autoCancel.autoCancelUnpaidOrders
                ? ` Unpaid orders are cancelled automatically after ${autoCancel.autoCancelAfterHours} hour${autoCancel.autoCancelAfterHours === 1 ? "" : "s"}.`
                : ""}
            </p>
          </div>
        </div>
      )}

      {/* Tracking — the timeline always shows, including where a halted order
          actually stopped (red ✕ step with its real timestamp). */}
      <Card>
        <h3 className="font-display font-semibold">Tracking</h3>
        <OrderTracking steps={trackingSteps} className="mt-5" />
        {halted && (
          <p className="mt-2 max-w-md rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {status === "refunded"
              ? "The payment has been reversed to your original payment method — banks typically take 5–7 working days to show it."
              : status === "cancelled" && order.failedAt
                ? "This order was cancelled because the payment wasn't completed. Nothing was charged — you can re-order the items any time."
                : "This order was cancelled. If you have any questions, our support team can help."}
          </p>
        )}
        {!halted && shipment && (
          <div className="mt-5 max-w-md rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Truck className="h-4 w-4 text-brand" />
              {shipment.carrier || "Courier"}
              {shipment.trackingNumber ? (
                <span className="font-mono text-xs text-muted-foreground">· {shipment.trackingNumber}</span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {shipment.dispatchedAt && <span>Dispatched {fmtDate(shipment.dispatchedAt)}</span>}
              {shipment.deliveredAt && <span>Delivered {fmtDate(shipment.deliveredAt)}</span>}
            </div>
            {shipment.trackingUrl && (
              <a
                href={shipment.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                Track shipment <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
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
                {it.size && <span className="text-muted-foreground"> · {it.size}</span>}
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
          {order.displayCurrency === "USD" && order.totalUsdApprox ? (
            <div className="flex justify-between text-xs text-muted-foreground"><dt>Approx. at purchase</dt><dd className="tabular-nums">≈ ${order.totalUsdApprox.toFixed(2)} USD (charged in INR)</dd></div>
          ) : null}
        </dl>
      </Card>

      {/* Shipping + payment (+ billing when it differs) */}
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
            {order.invoiceNumber && <p>Invoice no. {order.invoiceNumber}</p>}
            {order.razorpayPaymentId && <p className="break-all text-xs">Ref: {order.razorpayPaymentId}</p>}
            {order.gstin && <p>GSTIN: {order.gstin}</p>}
          </div>
        </Card>
        {showBilling && (
          <Card>
            <h3 className="font-display font-semibold">Billing address</h3>
            <address className="mt-3 text-sm not-italic text-muted-foreground">
              <span className="block font-medium text-foreground/90">{order.businessName || order.billingName || order.name}</span>
              {order.billingLine1 && <span className="block">{order.billingLine1}</span>}
              {order.billingLine2 && <span className="block">{order.billingLine2}</span>}
              <span className="block">{[order.billingCity, order.billingState, order.billingPincode].filter(Boolean).join(", ")}</span>
              {order.billingCountry && <span className="block">{order.billingCountry}</span>}
            </address>
          </Card>
        )}
      </div>
    </div>
  );
}
