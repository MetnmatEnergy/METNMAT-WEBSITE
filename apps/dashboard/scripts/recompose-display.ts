/**
 * Re-run the subject-aware display composition for photographs ALREADY in the
 * CMS — after tuning the pipeline, without re-uploading anything. The stored
 * originals stay byte-identical; only the generated `display` derivative (and
 * the auto-detected focal point) are refreshed, through the same hook that
 * runs on upload, so this cannot drift from the production behaviour.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/recompose-display.ts --target=dev --slug=<product-slug>
 *   npx tsx scripts/recompose-display.ts --target=prod --media=<media-id>
 *   npx tsx scripts/recompose-display.ts --target=prod --all --keep-focal
 *
 * Note: a recompose re-seeds focalX/focalY from fresh detection — a focal
 * point staff dragged by hand is replaced. Use the admin's focal editor
 * afterwards to correct individual images.
 *
 * --keep-focal recomposes around the point ALREADY stored instead. That is the
 * mode a library-wide backfill must use: --all --keep-focal re-renders the
 * whole ladder (micro/thumb/card/display) from each stored original without
 * touching a single focal point staff have set. Plain --all re-detects, which
 * over an edited library throws that work away.
 *
 * Environment: same shape as attach-product-images.ts (MONGODB_URI,
 * PAYLOAD_SECRET; STORAGE_PROVIDER/S3_* for prod). On prod the running CMS
 * must be reachable at CMS_URL so the hook can re-read stored originals.
 */
import { loadEnv, assertTarget, assertS3 } from "./_bootstrap";
loadEnv();

import { getPayload } from "payload";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};

async function main(): Promise<void> {
  const slug = flag("slug");
  const mediaId = flag("media");
  const all = argv.includes("--all");
  const keepFocal = argv.includes("--keep-focal");
  if (!slug && !mediaId && !all) {
    console.error("Usage: npx tsx scripts/recompose-display.ts --target=dev|prod --slug=<product-slug> | --media=<media-id> | --all [--keep-focal]");
    process.exit(2);
  }
  const { target, dbName } = assertTarget(argv);
  assertS3(target);
  console.log(`\ntarget   ${target}  (database "${dbName}")`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  let ids: string[] = [];
  if (mediaId) {
    ids = [mediaId];
  } else if (all) {
    // Product photography only — the hook returns early for every other
    // category, so recomposing logos, covers and team photos would be a no-op
    // that still re-PUTs their files.
    const found = await payload.find({
      collection: "media",
      where: { category: { equals: "product" } },
      pagination: false,
      depth: 0,
    });
    ids = found.docs.map((d) => String((d as { id: string | number }).id));
    if (!ids.length) {
      console.error("No media with category=product found.");
      process.exit(1);
    }
  } else {
    const found = await payload.find({
      collection: "products",
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    });
    const product = found.docs[0] as { id: string | number; images?: { image?: unknown }[] } | undefined;
    if (!product) {
      console.error(`Product not found by slug: ${slug}`);
      process.exit(1);
    }
    ids = (product.images ?? [])
      .map((i) => (typeof i.image === "object" && i.image ? String((i.image as { id: unknown }).id) : String(i.image)))
      .filter((id) => id && id !== "undefined");
    if (!ids.length) {
      console.error(`Product "${slug}" carries no images.`);
      process.exit(1);
    }
  }

  console.log(`recomposing ${ids.length} image(s)…\n`);
  let failures = 0;
  for (const id of ids) {
    try {
      const doc = await payload.update({
        collection: "media",
        id,
        data: {},
        context: { recomposeDisplay: keepFocal ? "keep-focal" : true },
      });
      console.log(`  ok: ${(doc as { filename?: string }).filename ?? id}`);
    } catch (e) {
      failures++;
      console.error(`  FAILED ${id}: ${(e as Error).message}`);
    }
  }
  console.log(failures ? `\nDONE with ${failures} failure(s)` : "\nDONE");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
