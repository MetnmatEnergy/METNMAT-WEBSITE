import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";

// TODO(feature): fetch the real order + tracking by id.
const steps = ["Order placed", "Packed", "Shipped", "Out for delivery", "Delivered"];

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold">Order #{id}</h2>
        <p className="text-sm text-muted-foreground">Placeholder order — wire to real data.</p>
      </div>

      {/* Tracking timeline */}
      <Card>
        <h3 className="font-display font-semibold">Tracking</h3>
        <ol className="mt-5 space-y-4">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm">
              <CheckCircle2 className={i === 0 ? "h-5 w-5 text-brand" : "h-5 w-5 text-muted-foreground/40"} />
              <span className={i === 0 ? "font-medium" : "text-muted-foreground"}>{s}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
