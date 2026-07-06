import Link from "next/link";
import {
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

/**
 * Modern service detail grid (replaced the page-turn flip-book). Pure server
 * markup — no client JS. Cards carry id={slug} so the showcase deep links
 * (/services#slug) keep landing here.
 */

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

// METNMAT's standing delivery promises — shown on every service.
const DELIVERY_POINTS = ["Lab → industrial scale", "Turnkey delivery", "GST invoice"] as const;

export type ServiceCard = {
  slug: string;
  title: string;
  summary: string;
  icon?: string;
  href: string;
  cta?: string;
};

export function ServiceGrid({ items }: { items: ServiceCard[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((s, i) => {
        const Icon = (s.icon && ICONS[s.icon]) || Rocket;
        return (
          <article
            key={s.slug}
            id={s.slug}
            className="group relative flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-1 -top-2 font-display text-6xl font-bold text-foreground/[0.04] transition-colors duration-200 group-hover:text-brand/10"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold leading-snug">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
            <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
              {DELIVERY_POINTS.map((d) => (
                <li key={d} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-brand" /> {d}
                </li>
              ))}
            </ul>
            <Link
              href={s.href}
              className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              {s.cta ?? "Get a quote"}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
