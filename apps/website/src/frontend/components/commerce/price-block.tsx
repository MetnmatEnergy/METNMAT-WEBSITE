import { formatINR, type Product } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

/** Price display with MRP strike-through + discount badge. */
export function PriceBlock({
  product,
  size = "md",
  className,
}: {
  product: Product;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
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
        {formatINR(product.price)}
      </span>
      {product.mrp && product.price > 0 && (
        <span className="text-sm text-muted-foreground line-through">
          {formatINR(product.mrp)}
        </span>
      )}
      {discount > 0 && (
        <span className="text-sm font-semibold text-emerald-500">{discount}% off</span>
      )}
      {product.price > 0 && (
        <span className="text-xs text-muted-foreground">/ {product.unit} · excl. GST</span>
      )}
    </div>
  );
}

/** B2B bulk pricing tiers table. */
export function PriceTiers({ product }: { product: Product }) {
  if (!product.priceTiers.length) return null;
  return (
    <div className="rounded-xl border border-border">
      <p className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Bulk pricing
      </p>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-border">
            <td className="px-4 py-2 text-muted-foreground">
              {product.moq}–{(product.priceTiers[0]?.minQty ?? product.moq) - 1} {product.unit}
            </td>
            <td className="px-4 py-2 text-right font-medium">{formatINR(product.price)}</td>
          </tr>
          {product.priceTiers.map((t, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-muted-foreground">
                {t.minQty}+ {product.unit}
              </td>
              <td className="px-4 py-2 text-right font-medium">{formatINR(t.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
