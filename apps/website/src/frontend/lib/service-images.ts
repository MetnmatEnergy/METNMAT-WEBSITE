/**
 * Themed photography per service slug — shared by the services page showcase
 * and the homepage What-we-do cards. Components render a brand gradient
 * fallback if a photo 404s (never a broken card). Keyed by every slug that can
 * appear — placeholder fallback AND the live CMS.
 *
 * These were served straight from `images.unsplash.com` until 2026-08-05. That
 * cost more than it looked like:
 *
 *   - LCP. The /services fan-carousel photo is the LCP element, and a
 *     third-party origin has to be DNS-resolved, connected and TLS-negotiated
 *     before its first byte. Mobile LCP measured 8.93s median.
 *   - Availability. A production page depended on a CDN nobody here controls.
 *   - Privacy. Every visitor's IP reached Unsplash on page load, before any
 *     consent decision — awkward on a site that ships a DPDP consent layer.
 *
 * Same photographs, same ids, same crop: downloaded once and re-encoded to
 * webp (900w master + 750w card, 677KB for all 16 files). The Unsplash License
 * permits download, commercial use and self-hosting with no attribution
 * required. Regenerate with `scripts/fetch-service-images.mjs`.
 */

/** One slug per photo. Both maps derive from this, so they cannot drift. */
const SLUGS = [
  "product-process-development",
  "applied-research-consultancy",
  "process-quality-improvement",
  "product-benchmarking",
  "microstructure-heat-treatment",
  "modeling-simulations",
  "materials-testing-characterization",
  "materials-processing-facilities",
] as const;

/**
 * Tall master, 900w. /services renders these in PORTRAIT boxes — the
 * fan-carousel card is 344x608 CSS px at >=1024px — so 900 wide is the floor
 * there. Do not shrink this map.
 */
export const SERVICE_IMAGES: Record<string, string> = Object.fromEntries(
  SLUGS.map((slug) => [slug, `/services/${slug}.webp`]),
);

/**
 * The homepage What-we-do cards only ever show a ~366x176 CSS-px letterbox, so
 * they get a 750w encode rather than the 900w master.
 *
 * These vary by WIDTH ONLY, from the same source crop as the master — pinning a
 * height would change the crop REGION and visibly re-frame the photo at some
 * breakpoints. Identical aspect ratio means object-cover shows the identical
 * region; only the resolution drops.
 */
export const SERVICE_CARD_IMAGES: Record<string, string> = Object.fromEntries(
  SLUGS.map((slug) => [slug, `/services/${slug}-card.webp`]),
);
