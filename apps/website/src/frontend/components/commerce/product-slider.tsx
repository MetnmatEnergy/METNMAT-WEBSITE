import Link from "next/link";
import { Marquee } from "@/frontend/components/ui/marquee";
import type { Product } from "@/frontend/lib/catalog";

function prettyCategory(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * One floating product render on the shared white stage (redox.me style):
 * no card box — just the render with a small labelled caption beneath it.
 */
function FloatingProduct({ product }: { product: Product }) {
  return (
    <Link
      href={`/shop/p/${product.slug}`}
      className="group/item flex w-52 shrink-0 flex-col items-center text-center"
    >
      <span className="flex h-40 w-full items-center justify-center">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="max-h-full max-w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.12)] transition-transform duration-500 group-hover/item:scale-105"
          />
        ) : (
          <span className="flex h-32 w-32 items-center justify-center rounded-2xl bg-neutral-100 text-[10px] font-semibold uppercase tracking-widest text-neutral-300">
            {product.brand || "METNMAT"}
          </span>
        )}
      </span>
      <span className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-brand">
        {product.categorySlug ? prettyCategory(product.categorySlug) : "METNMAT"}
      </span>
      <span className="mt-0.5 line-clamp-2 max-w-[12rem] text-xs font-semibold leading-snug text-neutral-800 group-hover/item:text-brand">
        {product.name}
      </span>
    </Link>
  );
}

/**
 * Redox.me-style showcase band: a single clean WHITE stage on which the product
 * renders float side by side (no card boxes) and glide across together as one
 * composition, with the brand caption fixed beneath — like redox.me's
 * "ELECTROCHEMICAL FLOW SYSTEMS" banner. Pauses on hover; each render links to
 * its product page. Images come live from the CMS.
 */
export function ProductSlider({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-white">
      <Marquee durationSec={60} className="pt-8">
        {products.map((p) => (
          <FloatingProduct key={p.slug} product={p} />
        ))}
      </Marquee>
      <p className="px-6 pb-6 pt-5 text-center font-display text-sm font-bold tracking-wide text-neutral-900 sm:text-base">
        METNMAT{" "}
        <span className="font-semibold text-neutral-500">·</span>{" "}
        <span className="text-brand">ELECTROCHEMICAL LAB SYSTEMS</span>
      </p>
    </div>
  );
}
