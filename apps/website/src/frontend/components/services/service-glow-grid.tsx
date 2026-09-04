"use client";

import Link from "next/link";
import { GlowingEffect } from "@/frontend/components/ui/glowing-effect";
import { bentoRows, bentoSpan, serviceIcon } from "@/frontend/lib/service-icons";
import { cn } from "@/frontend/lib/utils";

/**
 * The services showcase — a bento grid whose cards light along the edge nearest
 * the cursor.
 *
 * Replaces the GSAP fanned card deck. The fan looked striking and read poorly:
 * every card but the front one was clipped, the titles ran off the edge
 * mid-word ("Product & Pro…", "…cterization"), and reaching the eighth service
 * meant paging through a carousel. This shows all eight at once, each with the
 * sentence that explains it, and every card is a link to that service's detail.
 *
 * Copy is real. `title` and `summary` come from the CMS; the fuller `detail`
 * sentence comes from SERVICE_DETAILS, the same slug-keyed map the detail deck
 * already uses. Nothing here is written for the layout.
 */

export type ServiceGridItem = {
  slug: string;
  title: string;
  /** The CMS icon select value. */
  icon?: string;
  /** The explanatory sentence — SERVICE_DETAILS.detail, or the CMS summary. */
  description: string;
};

export function ServiceGlowGrid({ items }: { items: ServiceGridItem[] }) {
  if (!items.length) return null;

  // Rows are computed from the count so a ninth service cannot strand a card.
  const rows = bentoRows(items.length);
  let cursor = 0;
  const laidOut = rows.flatMap((size) =>
    items.slice(cursor, (cursor += size)).map((item) => ({ item, size })),
  );

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {laidOut.map(({ item, size }) => (
        <GridItem key={item.slug} item={item} size={size} />
      ))}
    </ul>
  );
}

function GridItem({ item, size }: { item: ServiceGridItem; size: number }) {
  const Icon = serviceIcon(item.icon);

  return (
    <li className={cn("list-none", bentoSpan(size), size === 1 && "sm:col-span-2")}>
      {/* The whole card is the link: a small "read more" target on a card this
          size is a worse click target than the card itself. */}
      <Link
        href={`/services#${item.slug}`}
        className="group relative block h-full rounded-2xl border border-border bg-surface p-2 transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background md:rounded-3xl md:p-3"
      >
        <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} />

        <div className="relative flex h-full min-h-[13rem] flex-col justify-between gap-6 overflow-hidden rounded-xl p-5 md:p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-brand/10 text-brand transition-colors group-hover:border-brand/40">
            <Icon className="h-5 w-5" aria-hidden />
          </span>

          <div className="space-y-2">
            <h3 className="font-display text-xl font-semibold tracking-tight text-balance md:text-2xl">
              {item.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              {item.description}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
