import Link from "next/link";
import { Package, FileText, MapPin } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";

export default function AccountDashboard() {
  const cards = [
    { href: "/account/orders", icon: Package, title: "Orders", desc: "Track and reorder" },
    { href: "/account/rfq", icon: FileText, title: "RFQs / Quotes", desc: "Your quote requests" },
    { href: "/account/addresses", icon: MapPin, title: "Addresses", desc: "Shipping & billing" },
  ];
  return (
    <div className="space-y-8">
      {/* TODO(content): greet the signed-in user once auth exists. */}
      <p className="text-muted-foreground">Welcome back. Here&apos;s a quick overview.</p>
      <div className="grid gap-5 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="hover:border-brand/40">
              <c.icon className="h-6 w-6 text-brand" />
              <h2 className="mt-4 font-display text-lg font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
