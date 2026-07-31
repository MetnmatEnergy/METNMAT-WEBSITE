import { NextResponse } from "next/server";
import { searchSite, searchProducts } from "@/frontend/lib/cms";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import type { Product } from "@/frontend/lib/catalog";
import type { SiteLink } from "@/frontend/lib/cms";

export const dynamic = "force-dynamic";

const slim = (products: Product[]) =>
  products.slice(0, 6).map((p) => ({
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    sku: p.sku,
    price: p.price,
    categorySlug: p.categorySlug,
  }));

/**
 * Live search endpoint powering the typeahead.
 * - default (header): full global search — products first, then research, blog,
 *   projects, categories, pages.
 * - scope=products (shop): products only, no other-tab results.
 */
export async function GET(request: Request) {
  // Public, unauthenticated, and every call fans out to the CMS. 60/min sits far
  // above a human typing into the debounced autosuggest.
  const rl = await limitRate(`search:${clientIp(request)}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { products: [], links: [], error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const scope = url.searchParams.get("scope");
  if (q.length < 2) return NextResponse.json({ products: [], links: [], totalProducts: 0 });

  if (scope === "products") {
    const products = await searchProducts(q);
    return NextResponse.json({ products: slim(products), links: [], totalProducts: products.length });
  }

  const { products, links } = await searchSite(q);
  return NextResponse.json({
    products: slim(products),
    links: (links as SiteLink[]).slice(0, 8),
    totalProducts: products.length,
  });
}
