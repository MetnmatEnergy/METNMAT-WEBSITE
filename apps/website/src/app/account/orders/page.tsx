import { Package } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

export default function OrdersPage() {
  // TODO(feature): list real orders from the API once orders exist.
  const orders: { id: string; date: string; total: string; status: string }[] = [];

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center">
        <Package className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 font-display text-lg font-semibold">No orders yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your orders and tracking will show up here.
        </p>
        <Button href="/shop" className="mt-5">Start shopping</Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Order</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border" />
      </table>
    </div>
  );
}
