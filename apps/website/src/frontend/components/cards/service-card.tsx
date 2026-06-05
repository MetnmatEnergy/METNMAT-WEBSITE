import Link from "next/link";
import { FlaskConical, ArrowUpRight } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import type { Service } from "@/frontend/lib/placeholder";

export function ServiceCard({ service }: { service: Service }) {
  return (
    <Card className="group flex flex-col hover:border-brand/40">
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
          {/* TODO(content): per-service icon. */}
          <FlaskConical className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-brand" />
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold">{service.title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{service.summary}</p>
      <Link
        href={`/services#${service.slug}`}
        className="mt-5 text-sm font-medium text-foreground/90 group-hover:text-brand"
      >
        Learn more →
      </Link>
    </Card>
  );
}
