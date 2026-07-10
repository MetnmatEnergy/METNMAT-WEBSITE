import Link from "next/link";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { getFeaturedProducts } from "@/frontend/lib/cms";
import type { Product } from "@/frontend/lib/catalog";

function prettyCategory(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MosaicCard({ product }: { product: Product }) {
  const spec = product.specs?.[0]?.value || product.shortDesc || product.brand;
  return (
    <Link
      href={`/shop/p/${product.slug}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-brand/40"
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <MediaPlaceholder className="aspect-[4/3]" label={product.brand || "METNMAT"} />
      )}
      <div className="p-4">
        {product.categorySlug && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-soft">
            {prettyCategory(product.categorySlug)}
          </span>
        )}
        <p className="mt-0.5 font-display text-sm font-semibold leading-snug">{product.name}</p>
        {spec && <p className="mt-1 truncate text-xs text-muted-foreground">{spec}</p>}
      </div>
    </Link>
  );
}

/** One vertically-scrolling column (children rendered twice for a seamless loop). */
function Column({
  items,
  reverse,
  className,
}: {
  items: Product[];
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className={`flex animate-scroll-y flex-col gap-4 group-hover:[animation-play-state:paused] motion-reduce:animate-none ${
          reverse ? "[animation-direction:reverse]" : ""
        }`}
      >
        {[...items, ...items].map((p, i) => (
          <MosaicCard key={`${p.slug}-${i}`} product={p} />
        ))}
      </div>
    </div>
  );
}

/**
 * Hero product showcase — two columns of catalog cards that auto-scroll
 * vertically in opposite directions, with a fade mask top & bottom and
 * pause-on-hover. Pulls live featured products from the CMS.
 */
export async function ProductMosaic() {
  const products = await getFeaturedProducts(8);
  if (products.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <MediaPlaceholder className="aspect-[4/3]" label="Product" />
        <MediaPlaceholder className="mt-10 aspect-[4/3]" label="Product" />
        <MediaPlaceholder className="aspect-[4/3]" label="Product" />
        <MediaPlaceholder className="mt-10 aspect-[4/3]" label="Product" />
      </div>
    );
  }

  // Split across two columns (col B starts offset for a staggered look).
  const colA = products.filter((_, i) => i % 2 === 0);
  const colB = products.filter((_, i) => i % 2 === 1);

  return (
    <div className="group absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]">
      <div className="grid grid-cols-2 gap-4">
        <Column items={colA.length ? colA : products} />
        <Column items={colB.length ? colB : products} reverse className="-mt-12" />
      </div>
    </div>
  );
}
