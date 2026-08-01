/**
 * Themed Unsplash photography per service slug — shared by the services page
 * showcase and the homepage What-we-do cards. Components render a brand
 * gradient fallback if a photo is blocked or 404s (never a broken card).
 * Keyed by every slug that can appear — placeholder fallback AND the live CMS.
 */
const unsplash = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

/** One id per slug — both maps below derive from this, so they cannot drift. */
const PHOTO_IDS: Record<string, string> = {
  "product-process-development": "1581092918056-0c4c3acd3789",
  "applied-research-consultancy": "1581091226825-a6a2a5aee158",
  "process-quality-improvement": "1581092160562-40aa08e78837",
  "product-benchmarking": "1460925895917-afdab827c52f",
  "microstructure-heat-treatment": "1635070041078-e363dbe005cb",
  "modeling-simulations": "1518770660439-4636190af475",
  "materials-testing-characterization": "1576086213369-97a306d36557",
  "materials-processing-facilities": "1504917595217-d4dc5ebe6122",
};

/**
 * Tall master. /services renders these in PORTRAIT boxes — the fan-carousel
 * card is 344x608 CSS px at >=1024px — so 900 wide is the floor there.
 * Do not shrink this map.
 */
export const SERVICE_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(PHOTO_IDS).map(([slug, id]) => [slug, unsplash(id)]),
);

/**
 * The homepage What-we-do cards only ever show a ~366x176 CSS-px letterbox, so
 * the master ships roughly 3x the pixels that box can display.
 *
 * Vary WIDTH ONLY — do not add `&h=`. These URLs already carry `fit=crop`, and
 * pinning a height changes the crop REGION, which visibly re-frames the photo
 * at some breakpoints. Keeping the master's own aspect ratio means object-cover
 * shows the identical region it does today; only the resolution drops.
 */
export const SERVICE_CARD_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(PHOTO_IDS).map(([slug, id]) => [slug, unsplash(id, 750)]),
);
