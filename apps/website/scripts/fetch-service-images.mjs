// Regenerate the self-hosted service photography in public/services/.
//
// These were served straight from images.unsplash.com until 2026-08-05, which
// put a third-party request in front of the /services LCP element (8.93s median
// on mobile), made a production page depend on a CDN we don't control, and sent
// every visitor's IP to Unsplash before any consent decision.
//
// Same photo ids and the same crop params, fetched once and re-encoded to webp.
// The Unsplash License permits download, commercial use and self-hosting with no
// attribution required.
//
//   node apps/website/scripts/fetch-service-images.mjs
//
// sharp is not a website dependency — it is resolved from the dashboard workspace.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../dashboard/package.json", import.meta.url));
const sharp = require("sharp");

const OUT = fileURLToPath(new URL("../public/services/", import.meta.url));
mkdirSync(OUT, { recursive: true });

/** Slug -> Unsplash photo id. Must stay in step with service-images.ts. */
const PHOTO_IDS = {
  "product-process-development": "1581092918056-0c4c3acd3789",
  "applied-research-consultancy": "1581091226825-a6a2a5aee158",
  "process-quality-improvement": "1581092160562-40aa08e78837",
  "product-benchmarking": "1460925895917-afdab827c52f",
  "microstructure-heat-treatment": "1635070041078-e363dbe005cb",
  "modeling-simulations": "1518770660439-4636190af475",
  "materials-testing-characterization": "1576086213369-97a306d36557",
  "materials-processing-facilities": "1504917595217-d4dc5ebe6122",
};

// Fetch at 2x the largest CSS box (the 344x608 portrait fan card => 900w
// master) so the self-hosted copy is never softer than what Unsplash served.
const src = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

let master = 0;
let card = 0;

for (const [slug, id] of Object.entries(PHOTO_IDS)) {
  const res = await fetch(src(id, 1800), { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    console.log(`  FAIL ${slug} -> HTTP ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());

  // 900w master: the floor for the portrait fan card at >=1024px.
  const m = await sharp(buf).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  writeFileSync(`${OUT}${slug}.webp`, m);

  // 750w card: the homepage letterbox. Width ONLY — pinning a height would
  // change the crop region and re-frame the photo.
  const c = await sharp(buf).resize({ width: 750, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  writeFileSync(`${OUT}${slug}-card.webp`, c);

  const meta = await sharp(m).metadata();
  master += m.length;
  card += c.length;
  console.log(`  ${slug.padEnd(36)} ${meta.width}x${meta.height}  master ${(m.length / 1024).toFixed(0)}KB  card ${(c.length / 1024).toFixed(0)}KB`);
}

console.log(`\n  total ${((master + card) / 1024).toFixed(0)}KB across ${Object.keys(PHOTO_IDS).length * 2} files`);
