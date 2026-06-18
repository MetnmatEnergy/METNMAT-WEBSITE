"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Category } from "@/frontend/lib/catalog";

/**
 * Faceted filter rail (PLP). Category links route to other categories; brand,
 * price and availability are real filters written to the URL query string so the
 * listing page can filter against them server-side.
 */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-5 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

const priceInput =
  "h-9 w-full rounded-lg border border-input bg-surface px-2.5 text-sm outline-none focus:border-brand [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";

export function FilterSidebar({
  activeCategory,
  categories = [],
  brands = [],
  priceMin = 0,
  priceMax = 0,
}: {
  activeCategory?: string;
  categories?: Category[];
  brands?: string[];
  priceMin?: number;
  priceMax?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tops = categories.filter((c) => !c.parent);

  const selectedBrands = (searchParams.get("brand") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const inStockOnly = searchParams.get("stock") === "1";
  const curMin = searchParams.get("min") || "";
  const curMax = searchParams.get("max") || "";

  const update = (mut: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mut(params);
    params.delete("page"); // any filter change returns to page 1
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const toggleBrand = (b: string) =>
    update((p) => {
      const set = new Set(selectedBrands);
      if (set.has(b)) set.delete(b);
      else set.add(b);
      if (set.size) p.set("brand", Array.from(set).join(","));
      else p.delete("brand");
    });

  const toggleStock = () =>
    update((p) => (inStockOnly ? p.delete("stock") : p.set("stock", "1")));

  const [min, setMin] = React.useState(curMin);
  const [max, setMax] = React.useState(curMax);
  React.useEffect(() => {
    setMin(curMin);
    setMax(curMax);
  }, [curMin, curMax]);

  const applyPrice = () =>
    update((p) => {
      if (min) p.set("min", min);
      else p.delete("min");
      if (max) p.set("max", max);
      else p.delete("max");
    });

  const anyFilter = selectedBrands.length > 0 || inStockOnly || !!curMin || !!curMax;
  const clearAll = () =>
    update((p) => {
      p.delete("brand");
      p.delete("stock");
      p.delete("min");
      p.delete("max");
    });

  return (
    <aside className="space-y-1">
      {anyFilter && (
        <button
          type="button"
          onClick={clearAll}
          className="mb-1 text-xs font-medium text-brand hover:underline"
        >
          Clear all filters
        </button>
      )}

      <Group title="Category">
        <ul className="space-y-1 text-sm">
          {tops.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/shop/c/${c.slug}`}
                className={
                  c.slug === activeCategory
                    ? "font-medium text-brand"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </Group>

      {brands.length > 0 && (
        <Group title="Brand">
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {brands.map((b) => (
              <label
                key={b}
                className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b)}
                  onChange={() => toggleBrand(b)}
                  className="h-4 w-4 rounded border-border accent-brand"
                />
                <span className="flex-1">{b}</span>
              </label>
            ))}
          </div>
        </Group>
      )}

      {priceMax > 0 && (
        <Group title="Price (₹, incl. GST)">
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={min}
              onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
              placeholder={String(priceMin)}
              aria-label="Minimum price"
              className={priceInput}
            />
            <span className="text-muted-foreground">–</span>
            <input
              inputMode="numeric"
              value={max}
              onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))}
              placeholder={String(priceMax)}
              aria-label="Maximum price"
              className={priceInput}
            />
          </div>
          <button
            type="button"
            onClick={applyPrice}
            className="mt-2 w-full rounded-lg border border-border py-1.5 text-sm font-medium hover:border-brand/50 hover:text-brand"
          >
            Apply
          </button>
        </Group>
      )}

      <Group title="Availability">
        <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={toggleStock}
            className="h-4 w-4 rounded border-border accent-brand"
          />
          <span className="flex-1">In stock only</span>
        </label>
      </Group>
    </aside>
  );
}
