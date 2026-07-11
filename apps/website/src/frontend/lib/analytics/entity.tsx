/**
 * Server-renderable entity tag for detail pages: tells the collector WHAT this
 * page is about ("product:zero-gap-electrolyzer"), so per-entity analytics key
 * on the same unique slugs used by orders and enquiries. Renders one meta tag;
 * zero client cost.
 */
export function AnalyticsEntity({ type, slug }: { type: "product" | "project" | "blog" | "service"; slug: string }) {
  if (!slug) return null;
  return <meta name="mm:entity" content={`${type}:${slug}`.slice(0, 120)} />;
}
