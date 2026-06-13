/**
 * Attach downloaded product images (_img_tmp) to CMS products via the Payload
 * local API. MODE per product: "append-front" prepends new media to existing
 * images (for updated/better renders); "set" only fills products with no images.
 *
 * Run: cd apps/dashboard && npx tsx scripts/attach-images.ts
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

function safeName(key: string): string {
  return key.replace(/^products\//, "").replace(/[:()/\\]/g, "_").replace(/\s+/g, " ").trim();
}

const JOBS: { slug: string; mode: "set" | "append-front"; keys: string[] }[] = [
  {
    slug: "photocatalytic-water-splitting-panel-reactors-app-400",
    mode: "set",
    keys: [
      "products/Zero gap photocatalyst pannel reactor.png",
      "products/Zero gap photocatalyst pannel reactor 2.png",
    ],
  },
  {
    slug: "pem-fuel-cell-hardware",
    mode: "append-front",
    keys: [
      "products/Hydrogen Fuel cell.png",
      "products/Hydrogen Fuel cell 2.png",
      "products/Hydrogen Fuel cell 3.png",
      "products/Hydrogen Fuel cell 5.png",
    ],
  },
];

const TMP = path.join(__dirname, "_img_tmp");

async function main() {
  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  for (const job of JOBS) {
    const found = await payload.find({
      collection: "products",
      where: { slug: { equals: job.slug } },
      limit: 1,
      depth: 0,
    });
    const product = found.docs[0];
    if (!product) {
      console.log(`SKIP (not found): ${job.slug}`);
      continue;
    }
    const existing = ((product as { images?: { image?: unknown }[] }).images ?? [])
      .map((e) => (typeof e.image === "object" && e.image ? String((e.image as { id?: unknown }).id ?? e.image) : String(e.image)))
      .filter(Boolean);

    if (job.mode === "set" && existing.length > 0) {
      console.log(`SKIP (already has ${existing.length} images): ${job.slug}`);
      continue;
    }

    const newIds: string[] = [];
    for (const key of job.keys) {
      const localPath = path.join(TMP, safeName(key));
      if (!fs.existsSync(localPath)) {
        console.log(`  MISSING: ${localPath}`);
        continue;
      }
      const media = await payload.create({
        collection: "media",
        data: { alt: String(product.name), category: "product" },
        filePath: localPath,
      });
      newIds.push(String(media.id));
      console.log(`  media: ${safeName(key)} -> ${media.id}`);
    }

    const finalIds = job.mode === "append-front" ? [...newIds, ...existing] : newIds;
    if (newIds.length) {
      await payload.update({
        collection: "products",
        id: product.id,
        data: { images: finalIds.map((id) => ({ image: id })) },
      });
    }
    console.log(`OK: ${job.slug} -> ${finalIds.length} images (${newIds.length} new)`);
  }
  console.log("DONE");
  process.exit(0);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
