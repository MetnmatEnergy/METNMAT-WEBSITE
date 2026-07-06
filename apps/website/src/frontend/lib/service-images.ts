/**
 * Themed Unsplash photography per service slug — shared by the services page
 * showcase and the homepage What-we-do cards. Components render a brand
 * gradient fallback if a photo is blocked or 404s (never a broken card).
 * Keyed by every slug that can appear — placeholder fallback AND the live CMS.
 */
const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;

export const SERVICE_IMAGES: Record<string, string> = {
  "product-process-development": unsplash("1581092918056-0c4c3acd3789"),
  "applied-research-consultancy": unsplash("1581091226825-a6a2a5aee158"),
  "process-quality-improvement": unsplash("1581092160562-40aa08e78837"),
  "product-benchmarking": unsplash("1460925895917-afdab827c52f"),
  "microstructure-heat-treatment": unsplash("1635070041078-e363dbe005cb"),
  "modeling-simulations": unsplash("1518770660439-4636190af475"),
  "materials-testing-characterization": unsplash("1576086213369-97a306d36557"),
  "materials-processing-facilities": unsplash("1504917595217-d4dc5ebe6122"),
};
