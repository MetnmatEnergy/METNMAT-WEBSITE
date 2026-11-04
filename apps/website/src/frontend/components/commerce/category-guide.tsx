import Link from "next/link";
import { formatINR, inclGSTForProduct, isQuoteOnly, type Product } from "@/frontend/lib/catalog";
import type { CategorySeo } from "@/frontend/lib/category-seo";

/**
 * The buying guide, price list and FAQ under a category or topic page's products.
 * Rendered as plain visible text, because Google requires FAQ structured data to
 * match what is on the page, and answer engines read what a crawler can see
 * without a click. The price list is a real table for the same reason: "<product>
 * price" is what buyers search, and few rivals show one.
 */
export function CategoryGuide({
  seo,
  faqs,
  links,
  products,
}: {
  seo: CategorySeo;
  faqs: { q: string; a: string }[];
  links: { href: string; name: string }[];
  products: Product[];
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

      {products.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl font-bold tracking-tight sm:text-2xl">Price list</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Prices of {seo.nouns} in India, including GST</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">Product</th>
                  <th scope="col" className="py-2 text-right font-medium">Price incl. GST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.slug}>
                    <td className="py-2 pr-4">
                      <Link href={`/shop/p/${p.slug}`} className="text-foreground hover:text-brand hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-2 text-right font-medium">
                      {formatINR(p.price > 0 && !isQuoteOnly(p) ? inclGSTForProduct(p, p.price) : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

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

      {links.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl font-bold tracking-tight sm:text-2xl">See also</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted-foreground hover:border-brand/40 hover:text-foreground"
              >
                {l.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
