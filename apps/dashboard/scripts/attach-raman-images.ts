/**
 * Attach the In-Situ Raman cell photographs to its existing CMS product.
 *
 * One-off in the mould of attach-images.ts, but with the _bootstrap guards
 * (explicit --target checked against MONGODB_URI, S3 asserted for prod) and a
 * distinct alt text per image. The photo set and its order are deliberate —
 * identity → construction detail → scale → system in operation — and the first
 * image becomes the shop-grid thumbnail and Open Graph image.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/attach-raman-images.ts --target=prod --dry-run
 *   npx tsx scripts/attach-raman-images.ts --target=prod
 *
 * Flags
 *   --images <dir>   where the normalized masters live (default scripts/_img_tmp)
 *   --dry-run        validate files and refuse conditions, write nothing
 *   --replace        overwrite an existing images array (default: refuse)
 *
 * Environment (same shape as a catalogue import — see docs/CATALOGUE.md):
 *   MONGODB_URI       …/metnmat_cms (prod) or …/metnmat_cms_dev (dev)
 *   PAYLOAD_SECRET    any non-empty value works for a local-API run
 *   STORAGE_PROVIDER  s3            (prod)
 *   S3_BUCKET         metnmat-media-prod
 *   S3_REGION         ap-south-1
 *   CMS_URL           https://admin.metnmat.com  (so the chatbot resync emits
 *                     absolute image URLs rather than omitting them)
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnv, assertTarget, assertS3, APP_DIR } from "./_bootstrap";
loadEnv();

import sharp from "sharp";
import { getPayload } from "payload";
import { checkProductMaster, PRODUCT_IMAGE_SPEC } from "../src/hooks/product-image-spec";

const SLUG = "dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-windo";
const NAME = "Dual Chambered In-Situ Raman Spectroscopy Cell With Single Light Window";

// Order matters: images[0] is the thumbnail everywhere. Filenames follow the
// catalogue convention (unnumbered primary, then numeric suffixes).
const IMAGES: { file: string; alt: string }[] = [
  {
    file: "In-Situ Raman Spectroscopy Cell IRE-4.webp",
    alt: `${NAME} — three-quarter view showing the dual-chamber PEEK body, sapphire optical window and fluidic ports`,
  },
  {
    file: "In-Situ Raman Spectroscopy Cell IRE-4 2.webp",
    alt: `${NAME} — top-down view of the sapphire optical window assembly and electrode aperture`,
  },
  {
    file: "In-Situ Raman Spectroscopy Cell IRE-4 3.webp",
    alt: `${NAME} — held in a gloved hand, showing the compact palm-sized form factor`,
  },
  {
    file: "In-Situ Raman Spectroscopy Cell IRE-4 4.webp",
    alt: `${NAME} — operating setup with dual peristaltic pumps and catholyte and anolyte reservoirs`,
  },
];

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};
const DRY = argv.includes("--dry-run");
const REPLACE = argv.includes("--replace");
const IMAGE_DIR = path.resolve(APP_DIR, flag("images") ?? path.join("scripts", "_img_tmp"));

async function validateFiles(): Promise<string[]> {
  const errors: string[] = [];
  for (const { file } of IMAGES) {
    const full = path.join(IMAGE_DIR, file);
    if (!fs.existsSync(full)) {
      errors.push(`missing: ${full}`);
      continue;
    }
    try {
      const { width, height } = await sharp(full).metadata();
      if (!width || !height) {
        errors.push(`${file}: could not read dimensions`);
      } else if (!checkProductMaster(width, height).ok) {
        errors.push(`${file}: ${width}x${height} — must be 4:3 and >= ${PRODUCT_IMAGE_SPEC.minWidth}px wide`);
      }
    } catch {
      errors.push(`${file}: unreadable image`);
    }
  }
  return errors;
}

async function main(): Promise<void> {
  const { target, dbName } = assertTarget(argv);
  assertS3(target);

  console.log(`\ntarget   ${target}  (database "${dbName}")`);
  console.log(`storage  ${process.env.STORAGE_PROVIDER || "(unset → gcs)"} ${process.env.S3_BUCKET ?? ""}`);
  console.log(`images   ${IMAGE_DIR}`);
  console.log(`product  ${SLUG}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be written" : "WRITING"}\n`);

  const errors = await validateFiles();
  if (errors.length) {
    console.error("Validation failed:");
    errors.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }
  console.log(`${IMAGES.length} image(s) validated against the product master spec.`);

  if (DRY) {
    console.log("Dry run — stopping before the database.");
    process.exit(0);
  }

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const found = await payload.find({
    collection: "products",
    where: { slug: { equals: SLUG } },
    limit: 1,
    depth: 0,
  });
  const product = found.docs[0];
  if (!product) {
    console.error(`Product not found by slug: ${SLUG}`);
    process.exit(1);
  }

  const existing = ((product as { images?: { image?: unknown }[] }).images ?? []).length;
  if (existing > 0 && !REPLACE) {
    console.error(`Product already carries ${existing} image(s). Re-run with --replace to overwrite.`);
    process.exit(1);
  }

  const ids: string[] = [];
  for (const { file, alt } of IMAGES) {
    const media = await payload.create({
      collection: "media",
      data: { alt, category: "product" },
      filePath: path.join(IMAGE_DIR, file),
    });
    ids.push(String(media.id));
    console.log(`  media: ${file} -> ${media.id}`);
  }

  await payload.update({
    collection: "products",
    id: product.id,
    data: { images: ids.map((id) => ({ image: id })) },
  });
  console.log(`OK: ${SLUG} -> ${ids.length} images`);

  // The product afterChange hook schedules a debounced chatbot-catalog resync;
  // give it a moment to run rather than killing it with the process.
  console.log("waiting for the chatbot resync to settle...");
  await new Promise((r) => setTimeout(r, 8000));
  console.log("DONE");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
