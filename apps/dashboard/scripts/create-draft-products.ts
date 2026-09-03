/**
 * Create product records as DRAFTS from a manifest of technical data.
 *
 * This is the path for "the manufacturer's manual arrived before the commercial
 * decisions did". The catalogue importer (scripts/import-catalogue.ts) is the
 * route for a finished product and deliberately refuses a blank price; this one
 * writes everything a datasheet can supply — name, category, description, the
 * full spec table — and leaves the commercial fields for staff:
 *
 *   _status              draft      → invisible on the storefront until published
 *   price                0          → "quote-only" per the Products schema
 *   priceApprovalStatus  pending    → shows up for commercial sign-off
 *   sku                  unset      → part numbers are assigned by staff, not guessed
 *
 * Photographs are NOT handled here. Once a draft exists, the normal path adds
 * them: scripts/attach-product-images.ts with a manifest.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/create-draft-products.ts scripts/draft-products/<file>.json --target=dev --dry-run
 *   npx tsx scripts/create-draft-products.ts scripts/draft-products/<file>.json --target=dev
 *
 * Re-running is safe: a slug that already exists is reported and skipped, never
 * overwritten, so an interrupted run is resumed by running it again.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnv, assertTarget, APP_DIR } from "./_bootstrap";
loadEnv();

import { getPayload } from "payload";

type DraftSpec = { label: string; value: string };
type DraftProduct = {
  name: string;
  slug: string;
  categorySlug: string;
  shortDesc: string;
  specs: DraftSpec[];
  sizes?: string[];
  note?: string;
  /**
   * INR, GST-inclusive, matching the Products schema. Omit for a quote-only
   * listing: 0 is the schema's "price on request" and the storefront renders it
   * as such (see isQuoteOnly in the website's catalog.ts).
   */
  price?: number;
};

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
/**
 * Publish immediately instead of leaving the record as a draft.
 *
 * The default stays draft — a datasheet is not a commercial decision. Pass this
 * only when the catalogue owner has decided the product should be listed before
 * a price exists: `price: 0` renders as "On request" on the storefront and the
 * buy box becomes a quote request, which is a supported state (see isQuoteOnly
 * in the website's catalog.ts). `priceApprovalStatus` stays "pending" either
 * way, because the price genuinely has not been signed off.
 */
const PUBLISH = argv.includes("--publish");

function loadManifest(): DraftProduct[] {
  const rel = argv.find((a) => !a.startsWith("--") && a.endsWith(".json"));
  if (!rel) throw new Error("Pass the manifest path, e.g. scripts/draft-products/pumps.json");
  const abs = path.resolve(APP_DIR, rel);
  const parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(`${rel}: expected a non-empty array`);
  for (const p of parsed) {
    for (const field of ["name", "slug", "categorySlug", "shortDesc"] as const) {
      if (!p[field]?.trim()) throw new Error(`${p.slug ?? "?"}: ${field} is required`);
    }
    if (!Array.isArray(p.specs) || p.specs.length === 0) throw new Error(`${p.slug}: specs are required`);
  }
  return parsed;
}

async function main() {
  const { target, dbName } = assertTarget(argv);
  const manifest = loadManifest();

  console.log(`target   ${target}  (database "${dbName}")`);
  console.log(`products ${manifest.length} ${PUBLISH ? "published (quote-only)" : "draft(s)"}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be written" : "WRITING"}\n`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  // Categories are referenced by slug in the manifest; resolve them up front so
  // an unknown one fails before anything is written rather than halfway through.
  const wanted = [...new Set(manifest.map((p) => p.categorySlug))];
  const cats = await payload.find({
    collection: "categories",
    where: { slug: { in: wanted } },
    limit: 100,
    depth: 0,
  });
  const bySlug = new Map(cats.docs.map((c) => [c.slug as string, c.id as string]));
  const missing = wanted.filter((s) => !bySlug.has(s));
  if (missing.length) {
    const all = await payload.find({ collection: "categories", limit: 200, depth: 0 });
    throw new Error(
      `unknown categorySlug: ${missing.join(", ")}\nvalid: ${all.docs.map((c) => c.slug).join(", ")}`
    );
  }

  let created = 0;
  let skipped = 0;
  for (const p of manifest) {
    const existing = await payload.find({
      collection: "products",
      where: { slug: { equals: p.slug } },
      limit: 1,
      depth: 0,
      draft: true,
    });
    if (existing.docs.length) {
      console.log(`  skip   ${p.slug} — already exists`);
      skipped++;
      continue;
    }
    if (DRY) {
      console.log(`  would create  ${p.slug}  (${p.specs.length} specs, price ${p.price ?? 0})`);
      created++;
      continue;
    }
    await payload.create({
      collection: "products",
      draft: !PUBLISH,
      data: {
        name: p.name,
        slug: p.slug,
        brand: "METNMAT",
        category: bySlug.get(p.categorySlug)!,
        shortDesc: p.shortDesc,
        specs: p.specs,
        sizes: (p.sizes ?? []).map((label) => ({ label })),
        price: typeof p.price === "number" && p.price > 0 ? p.price : 0,
        unit: "pc",
        moq: 1,
        gstRate: 18,
        countryOfOrigin: "India",
        productType: "made-to-order",
        inStock: true,
        featured: false,
        noIndex: false,
        // A price carried over from an existing METNMAT listing is a real price,
        // but it has not been re-approved for this catalogue, so it still lands
        // in the commercial review queue.
        priceApprovalStatus: "pending",
        _status: PUBLISH ? "published" : "draft",
      } as never,
    });
    console.log(`  create ${p.slug}  (${p.specs.length} specs)`);
    created++;
  }

  console.log(`\n${DRY ? "would create" : "created"} ${created}, skipped ${skipped}`);
  if (!DRY && created) {
    console.log(
      PUBLISH
        ? 'Live now, priced "On request" — set price + SKU in the admin to make them purchasable.'
        : "Drafts are invisible on the storefront. Set price + SKU and publish in the admin."
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
