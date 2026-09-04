"use client";

import { basePriceRange, honouredPriceTiers, inclGST, usdFor, type Product } from "@/frontend/lib/catalog";
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
        {money(inclGST(product.price), usdFor(product, inclGST(product.price)))}
      </span>
      {product.mrp && product.price > 0 && (
        <span className="text-sm text-muted-foreground line-through">
          {money(inclGST(product.mrp), usdFor(product, inclGST(product.mrp)))}
        </span>
      )}
      {discount > 0 && (
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{discount}% off</span>
      )}
      {product.price > 0 && (
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
