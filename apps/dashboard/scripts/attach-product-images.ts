/**
 * Attach photographs to an EXISTING CMS product, driven by a manifest.
 *
 * This is the master path for "here is the next product's photo set": stage the
 * ORIGINAL photographs (the display-derivative hook composes them for the
 * gallery automatically), write a small manifest naming the slug, the files
 * (order matters — the first image is the thumbnail everywhere) and one honest
 * alt per view, then run this. For products that do not exist in the CMS yet,
 * use the full catalogue import instead (docs/CATALOGUE.md).
 *
 *   cd apps/dashboard
 *   npx tsx scripts/attach-product-images.ts scripts/attach-manifests/<product>.json --target=prod --dry-run
 *   npx tsx scripts/attach-product-images.ts scripts/attach-manifests/<product>.json --target=prod
 *
 * Manifest shape (committed under scripts/attach-manifests/ so every attach run
 * stays auditable and repeatable):
 *
 *   { "slug": "…", "images": [{ "file": "…​.webp", "alt": "…" }, …] }
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
import { checkProductPhoto, PRODUCT_IMAGE_SPEC } from "../src/hooks/product-image-spec";

type ManifestImage = { file: string; alt: string };
type AttachManifest = { slug: string; images: ManifestImage[] };

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

function loadManifest(): AttachManifest {
  const rel = argv.find((a) => !a.startsWith("--") && a.endsWith(".json"));
  if (!rel) {
    console.error(
      "Usage: npx tsx scripts/attach-product-images.ts <manifest.json> --target=dev|prod [--images <dir>] [--dry-run] [--replace]"
    );
    process.exit(2);
  }
  const full = path.resolve(APP_DIR, rel);
  if (!fs.existsSync(full)) {
    console.error(`Manifest not found: ${full}`);
    process.exit(2);
  }
  const m = JSON.parse(fs.readFileSync(full, "utf8")) as Partial<AttachManifest>;
  if (!m.slug?.trim()) {
    console.error("Manifest is missing a product slug.");
    process.exit(2);
  }
  if (!Array.isArray(m.images) || m.images.length === 0) {
    console.error("Manifest names no images.");
    process.exit(2);
  }
  for (const [i, img] of m.images.entries()) {
    if (!img?.file?.trim()) {
      console.error(`Manifest image #${i + 1} has no "file".`);
      process.exit(2);
    }
    if (!img.alt?.trim()) {
      // Alt text is part of the product data, not an optional nicety — refusing
      // here keeps "every image describes itself" true for future products too.
      console.error(`Manifest image "${img.file}" has no "alt".`);
      process.exit(2);
    }
  }
  return m as AttachManifest;
}

async function validateFiles(images: ManifestImage[]): Promise<string[]> {
  const errors: string[] = [];
  for (const { file } of images) {
    const full = path.join(IMAGE_DIR, file);
    if (!fs.existsSync(full)) {
      errors.push(`missing: ${full}`);
      continue;
    }
    try {
      const { width, height } = await sharp(full).metadata();
      if (!width || !height) {
        errors.push(`${file}: could not read dimensions`);
      } else if (!checkProductPhoto(width, height).ok) {
        errors.push(
          `${file}: ${width}x${height} — shortest side must be >= ${PRODUCT_IMAGE_SPEC.minShortSide}px (upload the camera original)`
        );
      }
    } catch {
      errors.push(`${file}: unreadable image`);
    }
  }
  return errors;
}

async function main(): Promise<void> {
  const manifest = loadManifest();
  const { target, dbName } = assertTarget(argv);
  assertS3(target);

  console.log(`\ntarget   ${target}  (database "${dbName}")`);
  console.log(`storage  ${process.env.STORAGE_PROVIDER || "(unset → gcs)"} ${process.env.S3_BUCKET ?? ""}`);
  console.log(`images   ${IMAGE_DIR}`);
  console.log(`product  ${manifest.slug}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be written" : "WRITING"}\n`);

  const errors = await validateFiles(manifest.images);
  if (errors.length) {
    console.error("Validation failed:");
    errors.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }
  console.log(`${manifest.images.length} image(s) validated against the product master spec.`);

  if (DRY) {
    console.log("Dry run — stopping before the database.");
    process.exit(0);
  }

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const found = await payload.find({
    collection: "products",
    where: { slug: { equals: manifest.slug } },
    limit: 1,
    depth: 0,
  });
  const product = found.docs[0];
  if (!product) {
    console.error(`Product not found by slug: ${manifest.slug}`);
    process.exit(1);
  }

  const existing = ((product as { images?: { image?: unknown }[] }).images ?? []).length;
  if (existing > 0 && !REPLACE) {
    console.error(`Product already carries ${existing} image(s). Re-run with --replace to overwrite.`);
    process.exit(1);
  }

  const ids: string[] = [];
  for (const { file, alt } of manifest.images) {
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
  console.log(`OK: ${manifest.slug} -> ${ids.length} images`);

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
