"use client";

import {
  basePriceRange,
  honouredPriceTiers,
  inclGST,
  isQuoteOnly,
  usdFor,
  type Product,
} from "@/frontend/lib/catalog";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";
import { cn } from "@/frontend/lib/utils";

/**
 * Price display with MRP strike-through + discount badge.
 * Currency-aware: ₹ for Indian visitors, $ for international (display only —
 * payment is charged in INR). All values shown GST-inclusive.
 */
export function PriceBlock({
  product,
  size = "md",
  className,
}: {
  product: Product;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { money } = useCurrency();
  /*
   * Products.productType states the rule in its own field description:
   * "Quote only / Discontinued = enquiry-only: no Buy button, no price shown,
   * no purchase Offer in SEO data." The Buy button and the SEO Offer were
   * suppressed; the PRICE was not, because this block only ever checked
   * `price > 0`. A retired product keeps its price — retiring is a productType
   * change — so the ordinary case showed a figure the CMS says to withhold,
   * with an MRP strike-through and a discount badge beside it.
   *
   * inclGST(0) is 0 and formatINR(0) already reads "On request", so the
   * suppressed state needs no new wording.
   */
  const quoteOnly = isQuoteOnly(product);
  const discount =
    product.mrp && product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-display font-bold",
          size === "lg" && "text-3xl",
          size === "md" && "text-xl",
          size === "sm" && "text-base"
        )}
      >
        {quoteOnly
          ? money(0, undefined)
          : money(inclGST(product.price), usdFor(product, inclGST(product.price)))}
      </span>
      {!quoteOnly && product.mrp && product.price > 0 && (
        <span className="text-sm text-muted-foreground line-through">
          {money(inclGST(product.mrp), usdFor(product, inclGST(product.mrp)))}
        </span>
      )}
      {!quoteOnly && discount > 0 && (
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{discount}% off</span>
      )}
      {!quoteOnly && product.price > 0 && (
        <span className="text-xs text-muted-foreground">/ {product.unit} · incl. GST</span>
      )}
    </div>
  );
}

/** B2B bulk pricing tiers table. */
export function PriceTiers({ product }: { product: Product }) {
  const { money } = useCurrency();
  /*
   * The rows the checkout will actually honour, ascending — not the raw stored
   * array. Mapping `product.priceTiers` directly printed rows in whatever order
   * they were typed, so a price list written deepest-first ("100+, then 25+")
   * made the base row claim `moq–99` for a price that stopped applying at 25.
   * It also printed tiers the pricer ignores — a zero/negative price, or one
   * above the base — advertising a bulk rate nothing would charge.
   * See honouredPriceTiers in lib/catalog.
   */
  // "No price shown" covers this table too — it is nothing but prices, and it
  // sat beside an "On request" base row on an item the checkout refuses to sell.
  if (isQuoteOnly(product)) return null;
  const rows = honouredPriceTiers(product);
  if (!rows.length) return null;
  // Null when every order already qualifies for a tier — printing a base row
  // then advertises a price nothing can be charged, and renders "1-0 unit".
  const baseRange = basePriceRange(product);
  return (
    <div className="rounded-xl border border-border">
      <p className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Bulk pricing · incl. GST
      </p>
      <table className="w-full text-sm">
        <tbody>
          {baseRange ? (
            <tr className="border-b border-border">
              <td className="px-4 py-2 text-muted-foreground">
                {baseRange.from}–{baseRange.to} {product.unit}
              </td>
              <td className="px-4 py-2 text-right font-medium">{money(inclGST(product.price), usdFor(product, inclGST(product.price)))}</td>
            </tr>
          ) : null}
          {rows.map((t, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-muted-foreground">
                {t.minQty}+ {product.unit}
              </td>
              <td className="px-4 py-2 text-right font-medium">{money(inclGST(t.price), usdFor(product, inclGST(t.price)))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
