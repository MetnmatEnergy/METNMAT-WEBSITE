/**
 * Import a product catalogue — rows and photographs — into the CMS.
 *
 * Reads the manifest written by catalogue-manifest.ts, uploads each image
 * through the Payload local API (so S3 receives the master and all five
 * derivatives, exactly as an admin upload would), and creates or updates the
 * product that owns them.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/import-catalogue.ts catalogue.json --images ./photos --target=dev --dry-run
 *   npx tsx scripts/import-catalogue.ts catalogue.json --images ./photos --target=prod
 *
 * Flags
 *   --dry-run          validate everything and write nothing (do this first)
 *   --retire-missing   products in the CMS but not in the manifest become DRAFTS
 *   --limit N          stop after N products (rehearse the shape of a big run)
 *
 * Why it runs here and not on the server: image processing happens wherever the
 * upload is handled. Running locally keeps six sharp encodes per product off a
 * box that has ~400 MB of headroom and three other applications on it, and only
 * the finished objects cross the network.
 *
 * Idempotent. A product already carrying exactly the images the manifest names
 * is left alone, so an interrupted run is resumed by running it again.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnv, assertTarget, assertS3 } from "./_bootstrap";
loadEnv();

import sharp from "sharp";
import { getPayload, type Payload } from "payload";
import { checkProductPhoto, PRODUCT_IMAGE_SPEC } from "../src/hooks/product-image-spec";
import type { ManifestProduct } from "./catalogue-manifest";

type Manifest = { products: ManifestProduct[] };

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};

const DRY = argv.includes("--dry-run");
const RETIRE = argv.includes("--retire-missing");
const LIMIT = Number(flag("limit") ?? 0) || 0;

/**
 * Validate the whole manifest before writing anything.
 *
 * A catalogue import that fails halfway leaves the shop in a state nobody
 * designed — some products new, some old, some with images and some without.
 * Everything that can be checked without the database is checked here, so the
 * common failures (a blank price, a photo that is the wrong shape) stop the run
 * before it has touched a single row.
 */
async function validate(products: ManifestProduct[], imageDir: string): Promise<string[]> {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const p of products) {
    const at = `[${p.slug || "(no slug)"}]`;
    if (!p.slug) errors.push(`${at} missing slug`);
    if (seen.has(p.slug)) errors.push(`${at} duplicate slug in the manifest`);
    seen.add(p.slug);

    if (!p.name?.trim()) errors.push(`${at} missing name`);
    if (!p.categorySlug?.trim()) errors.push(`${at} missing categorySlug`);
    if (!p.sku?.trim()) errors.push(`${at} missing sku`);
    if (typeof p.price !== "number" || !(p.price > 0)) errors.push(`${at} price must be a number above 0`);
    if (!Array.isArray(p.images) || p.images.length === 0) errors.push(`${at} has no images`);

    for (const rel of p.images ?? []) {
      const file = path.join(imageDir, rel);
      if (!fs.existsSync(file)) {
        errors.push(`${at} image not found: ${rel}`);
        continue;
      }
      try {
        const { width, height } = await sharp(file).metadata();
        if (!width || !height) {
          errors.push(`${at} ${rel}: could not read dimensions`);
        } else if (!checkProductPhoto(width, height).ok) {
          errors.push(
            `${at} ${rel}: ${width}x${height} — shortest side must be >= ${PRODUCT_IMAGE_SPEC.minShortSide}px (upload the camera original)`
          );
        }
      } catch {
        errors.push(`${at} ${rel}: unreadable image`);
      }
    }
  }
  return errors;
}

/** Category slug → id, resolved once. Missing categories are an error, not a silent create. */
async function categoryMap(payload: Payload): Promise<Map<string, string>> {
  const res = await payload.find({ collection: "categories", limit: 1000, depth: 0 });
  return new Map(res.docs.map((d) => [String((d as { slug?: string }).slug ?? ""), String(d.id)]));
}

async function main(): Promise<void> {
  const manifestPath = argv.find((a) => !a.startsWith("--") && a.endsWith(".json"));
  const imageDir = flag("images");

  if (!manifestPath || !imageDir) {
    console.error("Usage: npx tsx scripts/import-catalogue.ts <manifest.json> --images <dir> --target=dev|prod [--dry-run]");
    process.exit(2);
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(2);
  }

  const { target, dbName } = assertTarget(argv);
  assertS3(target);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  let products = manifest.products ?? [];
  if (LIMIT > 0) products = products.slice(0, LIMIT);

  console.log(`\ntarget   ${target}  (database "${dbName}")`);
  console.log(`storage  ${process.env.STORAGE_PROVIDER || "(unset → gcs)"} ${process.env.S3_BUCKET ?? ""}`);
  console.log(`manifest ${products.length} product(s) from ${path.basename(manifestPath)}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be written" : "WRITING"}\n`);

  console.log("validating...");
  const errors = await validate(products, imageDir);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s) — nothing was written:\n`);
    for (const e of errors.slice(0, 40)) console.error(`  ${e}`);
    if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`);
    process.exit(1);
  }
  console.log(`ok — ${products.length} product(s), ${products.reduce((n, p) => n + p.images.length, 0)} image(s)\n`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const cats = await categoryMap(payload);
  const unknown = [...new Set(products.map((p) => p.categorySlug).filter((c) => !cats.has(c)))];
  if (unknown.length) {
    console.error(`Unknown categorySlug(s): ${unknown.join(", ")}`);
    console.error(`Existing: ${[...cats.keys()].sort().join(", ")}`);
    process.exit(1);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let uploaded = 0;
  const touched = new Set<string>();

  // Sequential on purpose. Concurrency here would multiply peak memory by the
  // worker count for no useful gain — the run is bounded by sharp, and a
  // catalogue load is not a latency-sensitive operation.
  for (const p of products) {
    const found = await payload.find({
      collection: "products",
      where: { slug: { equals: p.slug } },
      limit: 1,
      depth: 1,
    });
    const existing = found.docs[0] as { id: string; images?: { image?: unknown }[] } | undefined;
    touched.add(p.slug);

    const currentFiles = (existing?.images ?? [])
      .map((r) => (r.image && typeof r.image === "object" ? String((r.image as { filename?: string }).filename ?? "") : ""))
      .filter(Boolean);

    // Resumability: same filenames in the same order means this product was
    // already done by an earlier run.
    const same =
      currentFiles.length === p.images.length && currentFiles.every((f, i) => f === path.basename(p.images[i]));

    if (same) {
      skipped++;
      console.log(`= ${p.slug} (already has its ${currentFiles.length} image(s))`);
      continue;
    }

    if (DRY) {
      console.log(`${existing ? "~" : "+"} ${p.slug} — would upload ${p.images.length} image(s)`);
      existing ? updated++ : created++;
      continue;
    }

    const mediaIds: string[] = [];
    for (const rel of p.images) {
      const media = await payload.create({
        collection: "media",
        data: { alt: (p.alt?.trim() || p.name).slice(0, 300), category: "product" },
        filePath: path.join(imageDir, rel),
      });
      mediaIds.push(String(media.id));
      uploaded++;
    }

    const data = {
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      category: cats.get(p.categorySlug)!,
      price: p.price!,
      ...(typeof p.mrp === "number" ? { mrp: p.mrp } : {}),
      moq: p.moq ?? 1,
      unit: p.unit || "pc",
      shortDesc: p.shortDesc || "",
      inStock: p.inStock !== false,
      featured: Boolean(p.featured),
      images: mediaIds.map((id) => ({ image: id })),
      // Drafts are enabled on this collection and public reads are gated to
      // published. Without this a freshly imported product exists, looks
      // correct in the admin, and is invisible on the site.
      _status: "published" as const,
    };

    if (existing) {
      await payload.update({ collection: "products", id: existing.id, data });
      updated++;
      console.log(`~ ${p.slug} — ${mediaIds.length} image(s)`);
    } else {
      await payload.create({ collection: "products", data });
      created++;
      console.log(`+ ${p.slug} — ${mediaIds.length} image(s)`);
    }
  }

  // Retire, never delete. Orders snapshot the SKU as text so history survives
  // either way, but StockLedger holds a REQUIRED relationship to the product —
  // deleting would orphan those rows. Drafting removes it from the shop, keeps
  // every reference intact, and is undone by publishing again.
  let retired = 0;
  if (RETIRE) {
    const all = await payload.find({ collection: "products", limit: 1000, depth: 0 });
    for (const doc of all.docs) {
      const slug = String((doc as { slug?: string }).slug ?? "");
      if (!slug || touched.has(slug)) continue;
      if (DRY) {
        console.log(`- ${slug} — would be retired (draft)`);
      } else {
        await payload.update({ collection: "products", id: doc.id, data: { _status: "draft" } });
        console.log(`- ${slug} — retired (draft)`);
      }
      retired++;
    }
  }

  console.log(
    `\n${DRY ? "DRY RUN — " : ""}created ${created}, updated ${updated}, unchanged ${skipped}` +
      `, images uploaded ${uploaded}${RETIRE ? `, retired ${retired}` : ""}`
  );
  if (!RETIRE) {
    console.log(`\nProducts already in the CMS but absent from the manifest were left alone.`);
    console.log(`Pass --retire-missing to draft them instead.`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
