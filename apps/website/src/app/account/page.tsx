import Link from "next/link";
import { Package, FileText, MapPin } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { getCurrentCustomer, getCustomerOrders, getCustomerEnquiries } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export default async function AccountDashboard() {
  const customer = await getCurrentCustomer();
  const [ordersResult, rfqs] = await Promise.all([
    getCustomerOrders(customer),
    getCustomerEnquiries(customer),
  ]);
  const orderCount = ordersResult.ok ? ordersResult.orders.length : 0;
  const addressCount = customer?.addresses?.length ?? 0;
  const firstName = (customer?.name || "").split(" ")[0];

  const cards = [
    { href: "/account/orders", icon: Package, title: "Orders", desc: "Track and reorder", count: orderCount },
    { href: "/account/rfq", icon: FileText, title: "RFQs / Quotes", desc: "Your quote requests", count: rfqs.length },
    { href: "/account/addresses", icon: MapPin, title: "Addresses", desc: "Shipping & billing", count: addressCount },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {firstName ? `Welcome back, ${firstName}.` : "Welcome back."} Here&apos;s a quick overview.
        </p>
        {customer?.userCode ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Member ID</span>
            <span className="font-mono font-semibold tracking-wide text-foreground">{customer.userCode}</span>
          </div>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-colors hover:border-brand/40">
              <div className="flex items-start justify-between">
                <c.icon className="h-6 w-6 text-brand" />
                <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-sm font-semibold tabular-nums">
                  {c.count}
                </span>
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
