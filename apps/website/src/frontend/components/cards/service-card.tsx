import Link from "next/link";
import {
  FlaskConical,
  Rocket,
  Lightbulb,
  Gauge,
  Target,
  Flame,
  Cpu,
  Microscope,
  Factory,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import type { Service } from "@/frontend/lib/placeholder";

const ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  lightbulb: Lightbulb,
  gauge: Gauge,
  target: Target,
  flame: Flame,
  cpu: Cpu,
  microscope: Microscope,
  factory: Factory,
};

export function ServiceCard({ service }: { service: Service }) {
  const Icon = (service.icon && ICONS[service.icon]) || FlaskConical;
  return (
    <Card className="group flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold group-hover:text-brand">
        {service.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{service.summary}</p>
      <Link
        href={`/services#${service.slug}`}
        className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-foreground/90 group-hover:text-brand"
      >
        Learn more <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </Link>
    </Card>
  );
}
