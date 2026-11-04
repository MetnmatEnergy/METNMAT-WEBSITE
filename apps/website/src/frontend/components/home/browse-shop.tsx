import Link from "next/link";
import { getIndexableCategories } from "@/frontend/lib/cms";
import { topicLinks } from "@/frontend/lib/topic-seo";

/**
 * The home page's route into the shop. Before this it linked to fifteen projects
 * and eight products but to no category, and the home page is the strongest page
 * on the site, so that strength never reached the pages meant to rank. Plain links
 * in the server HTML, named the way buyers name things.
 */
export async function BrowseShop() {
  const categories = await getIndexableCategories().catch(() => []);
  const departments = categories.filter((c) => !c.parent);
  if (departments.length === 0) return null;
  const under = (slug: string) => categories.filter((c) => c.parent === slug);

  return (
    <nav aria-labelledby="browse-shop" className="mt-14 border-t border-border pt-8">
      <h3 id="browse-shop" className="font-display text-lg font-bold tracking-tight">
        Browse the shop
      </h3>
      <div className="mt-5 columns-2 gap-8 lg:columns-4">
        {departments.map((d) => (
          <div key={d.slug} className="mb-6 break-inside-avoid">
            <Link href={`/shop/c/${d.slug}`} className="font-display text-sm font-semibold hover:text-brand">
              {d.name}
            </Link>
            {under(d.slug).length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {under(d.slug).map((s) => (
                  <li key={s.slug}>
                    <Link href={`/shop/c/${s.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <div className="mb-6 break-inside-avoid">
          <Link href="/shop/all" className="font-display text-sm font-semibold hover:text-brand">
            All products
          </Link>
          <ul className="mt-1.5 space-y-1">
            {topicLinks().map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="text-sm text-muted-foreground hover:text-foreground">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
