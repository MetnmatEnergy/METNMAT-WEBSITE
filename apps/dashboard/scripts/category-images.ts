/**
 * Set/replace the top-level category images from the user's "shop by categories"
 * uploads (one studio image per category). Seed-safe: seed never writes category.image.
 *
 * Run: cd apps/dashboard && npx tsx scripts/category-images.ts
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, "..");
for (const line of fs.readFileSync(path.join(APP_DIR, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

import { getPayload } from "payload";

/** category slug -> downloaded local file (scripts/_img_tmp) */
const FILES: Record<string, string> = {
  electrodes: "shop by categories_electrodes.png",
  membranes: "shop by categories_Membranes.png",
  "reactor-cell": "shop by categories_Reactors & Cells.png",
  equipments: "shop by categories_Equipments.png",
  accessories: "shop by categories_Accessories.png",
};

async function main() {
  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  for (const [slug, file] of Object.entries(FILES)) {
    const localPath = path.join(__dirname, "_img_tmp", file);
    if (!fs.existsSync(localPath)) { console.log("MISSING file:", file); continue; }
    const cat = (await payload.find({ collection: "categories", where: { slug: { equals: slug } }, limit: 1, depth: 0 })).docs[0];
    if (!cat) { console.log("SKIP category not found:", slug); continue; }
    const media = await payload.create({
      collection: "media",
      data: { alt: `${cat.name} — METNMAT product family`, category: "catalog" },
      filePath: localPath,
    });
    await payload.update({ collection: "categories", id: cat.id, data: { image: String(media.id) } });
    console.log(`OK: ${slug} <- ${file} (media ${media.id})`);
  }
  console.log("DONE");
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
