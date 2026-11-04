import Link from "next/link";
import type { CategorySeo } from "@/frontend/lib/category-seo";

/**
 * The buying guide and FAQ under a category's product grid. Rendered as plain
 * visible text, because Google requires FAQ structured data to match what is on
 * the page, and answer engines read what a crawler can see without a click.
 */
export function CategoryGuide({
  seo,
  faqs,
  related,
}: {
  seo: CategorySeo;
  faqs: { q: string; a: string }[];
  related: { slug: string; name: string }[];
}) {
  return (
    <section className="mt-14 max-w-3xl border-t border-border pt-10">
      <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{seo.guideTitle}</h2>
      <dl className="mt-5 space-y-4">
        {seo.guide.map((g) => (
          <div key={g.term}>
            <dt className="font-medium text-foreground">{g.term}</dt>
            <dd className="mt-0.5 text-muted-foreground">{g.text}</dd>
          </div>
        ))}
      </dl>

      {faqs.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl font-bold tracking-tight sm:text-2xl">Frequently asked questions</h2>
          <div className="mt-5 space-y-5">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-medium text-foreground">{f.q}</h3>
                <p className="mt-1 text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {related.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl font-bold tracking-tight sm:text-2xl">Related categories</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {related.map((c) => (
              <Link
                key={c.slug}
                href={`/shop/c/${c.slug}`}
                className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted-foreground hover:border-brand/40 hover:text-foreground"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
