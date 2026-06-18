/**
 * Shop listing query — filter + sort + paginate, driven entirely by URL search
 * params so listings are shareable and crawlable. Pure functions run server-side
 * on the (small) CMS product set; facets are derived from that same set.
 */
import { inclGST, type Product } from "@/frontend/lib/catalog";

export const PAGE_SIZE = 12;

export type ShopQuery = {
  sort: string;
  brands: string[];
  inStockOnly: boolean;
  minPrice?: number;
  maxPrice?: number;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;
const numOrUndef = (s?: string): number | undefined => {
  if (s == null || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** Headline GST-inclusive price used for price filtering + sorting (0 = quote-only). */
const headline = (p: Product): number => (p.price > 0 ? inclGST(p.price) : 0);

export function parseShopQuery(sp: SearchParams): ShopQuery {
  const brandsRaw = one(sp.brand);
  return {
    sort: one(sp.sort) || "relevance",
    brands: brandsRaw ? brandsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    inStockOnly: one(sp.stock) === "1",
    minPrice: numOrUndef(one(sp.min)),
    maxPrice: numOrUndef(one(sp.max)),
    page: Math.max(1, parseInt(one(sp.page) || "1", 10) || 1),
  };
}

/** True when any narrowing filter (not sort/page) is active. */
export function hasActiveFilters(q: ShopQuery): boolean {
  return q.brands.length > 0 || q.inStockOnly || q.minPrice != null || q.maxPrice != null;
}

/** Facet options derived from a product set (for the filter sidebar). */
export function shopFacets(products: Product[]): {
  brands: string[];
  priceMin: number;
  priceMax: number;
} {
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort();
  const priced = products.map(headline).filter((v) => v > 0);
  return {
    brands,
    priceMin: priced.length ? Math.min(...priced) : 0,
    priceMax: priced.length ? Math.max(...priced) : 0,
  };
}

/** Sort a product list by the given key (quote-only items always sort last on price). */
export function sortProducts(products: Product[], sort: string): Product[] {
  const items = products.slice();
  const byPrice = (dir: "asc" | "desc") => (a: Product, b: Product) => {
    const ha = headline(a);
    const hb = headline(b);
    if (ha === 0 && hb === 0) return 0;
    if (ha === 0) return 1; // quote-only last
    if (hb === 0) return -1;
    return dir === "asc" ? ha - hb : hb - ha;
  };
  switch (sort) {
    case "price-asc":
      return items.sort(byPrice("asc"));
    case "price-desc":
      return items.sort(byPrice("desc"));
    case "rating":
      return items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "newest":
      return items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    default:
      return items; // "relevance" — keep source order
  }
}

/** Filter → sort → paginate. Returns the page window plus paging metadata. */
export function applyShopQuery(
  products: Product[],
  q: ShopQuery
): { items: Product[]; total: number; totalPages: number; page: number } {
  let items = products.slice();

  if (q.brands.length) items = items.filter((p) => q.brands.includes(p.brand));
  if (q.inStockOnly) items = items.filter((p) => p.inStock);
  if (q.minPrice != null || q.maxPrice != null) {
    // Normalise an inverted range (min > max) so it never silently yields nothing.
    const lo =
      q.minPrice != null && q.maxPrice != null ? Math.min(q.minPrice, q.maxPrice) : q.minPrice;
    const hi =
      q.minPrice != null && q.maxPrice != null ? Math.max(q.minPrice, q.maxPrice) : q.maxPrice;
    items = items.filter((p) => {
      const h = headline(p);
      if (h === 0) return false; // quote-only has no price → excluded by a price filter
      if (lo != null && h < lo) return false;
      if (hi != null && h > hi) return false;
      return true;
    });
  }

  items = sortProducts(items, q.sort);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(q.page, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE), total, totalPages, page };
}
