import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { JsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";

/**
 * The visible breadcrumb trail and its BreadcrumbList JSON-LD, emitted from one
 * array so they cannot disagree.
 *
 * Pages used to declare the trail twice — once as `<Breadcrumbs>` and again as
 * `breadcrumbJsonLd([...])` — which meant renaming a crumb in one place silently
 * left structured data describing a different hierarchy than the page shows.
 * Google treats that mismatch as a rich-results error.
 *
 * The last item is the current page: it renders as plain text (not a link) but
 * still needs its path for the JSON-LD trail.
 */
export function PageBreadcrumbs({
  items,
  className,
}: {
  items: { name: string; path: string }[];
  className?: string;
}) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items)} />
      <Breadcrumbs
        className={className}
        items={items.map((item, i) => (i === items.length - 1 ? { name: item.name } : { name: item.name, href: item.path }))}
      />
    </>
  );
}
