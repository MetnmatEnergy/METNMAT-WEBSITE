"use client";

import * as React from "react";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";
import { RegionDialog } from "@/frontend/components/commerce/region-dialog";
import { REGION_GLYPH, REGION_LABEL, currencyForRegion } from "@/frontend/lib/region";

/**
 * The region indicator: "🇮🇳 India · INR — Change region".
 *
 * Deliberately not a gate. The shop renders immediately with a region already
 * resolved from the request IP, and this states what was chosen and offers to
 * change it. Blocking the catalogue behind a region prompt would cost every
 * first-time visitor a click before seeing a product, on the page the business
 * runs on.
 *
 * Renders nothing until the region is settled, so it cannot flicker from one
 * label to another while resolution is still in flight.
 */
export function RegionBar({ className }: { className?: string }) {
  const { region, regionResolved } = useCurrency();
  const [open, setOpen] = React.useState(false);

  if (!regionResolved) {
    // Reserve nothing: the bar is one line and appearing is less jarring than
    // a placeholder that changes shape.
    return null;
  }

  return (
    <>
      <div
        className={
          "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground " +
          (className ?? "")
        }
      >
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>{REGION_GLYPH[region]}</span>
          <span>
            {REGION_LABEL[region]} · {currencyForRegion(region)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Change region
        </button>
      </div>
      <RegionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
