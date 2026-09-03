/**
 * Set product prices from an explicit {slug, price} list.
 *
 * Used to bring imported products onto the catalogue's existing per-category
 * price bands. It takes a file of exact slug/price pairs rather than deriving
 * anything at run time: a price is a commercial fact, and a script that guesses
 * one is a script that quietly mis-sells.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/set-product-prices.ts <plan.json> --target=prod --dry-run
 *   npx tsx scripts/set-product-prices.ts <plan.json> --target=prod --confirm
 *
 * The plan is [{ "slug": "…", "to": 8999 }, …]; an optional "from" is checked
 * against the live value and the run aborts on any mismatch, so a stale plan
 * cannot overwrite a price someone changed in the meantime.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnv, assertTarget, APP_DIR } from "./_bootstrap";
loadEnv();

import { getPayload } from "payload";

type PriceChange = { slug: string; to: number; from?: number; name?: string };

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const CONFIRMED = argv.includes("--confirm");

function loadPlan(): PriceChange[] {
  const rel = argv.find((a) => !a.startsWith("--") && a.endsWith(".json"));
  if (!rel) throw new Error("Pass the plan file, e.g. scripts/price-plans/reband.json");
  const parsed = JSON.parse(fs.readFileSync(path.resolve(APP_DIR, rel), "utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("plan must be a non-empty array");
  for (const p of parsed) {
    if (!p.slug || typeof p.to !== "number" || p.to < 0) {
      throw new Error(`bad plan row: ${JSON.stringify(p)}`);
    }
  }
  return parsed;
}

async function main() {
  const { target, dbName } = assertTarget(argv);
  const plan = loadPlan();
  if (!DRY && !CONFIRMED) throw new Error("Refusing to write prices without --confirm. Run --dry-run first.");

  console.log(`target   ${target}  (database "${dbName}")`);
  console.log(`changes  ${plan.length}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be written" : "WRITING"}\n`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const found = await payload.find({
    collection: "products",
    where: { slug: { in: plan.map((p) => p.slug) } },
    limit: plan.length,
    depth: 0,
  });
  const bySlug = new Map(found.docs.map((d) => [(d as { slug: string }).slug, d as { id: string; price?: number; name?: string }]));

  const missing = plan.filter((p) => !bySlug.has(p.slug)).map((p) => p.slug);
  if (missing.length) throw new Error(`slug(s) not found:\n  ${missing.join("\n  ")}`);

  const drifted = plan
    .filter((p) => typeof p.from === "number" && bySlug.get(p.slug)!.price !== p.from)
    .map((p) => `${p.slug}: plan says ${p.from}, live is ${bySlug.get(p.slug)!.price}`);
  if (drifted.length) {
    throw new Error(`price drift — the plan is stale, refusing to write:\n  ${drifted.join("\n  ")}`);
  }

  let done = 0;
  for (const p of plan) {
    const doc = bySlug.get(p.slug)!;
    console.log(`  ${DRY ? "would set" : "set"}  ${p.slug}  ${doc.price} -> ${p.to}`);
    if (DRY) continue;
    await payload.update({ collection: "products", id: doc.id, data: { price: p.to } as never });
    done++;
  }
  console.log(`\n${DRY ? "would update" : "updated"} ${DRY ? plan.length : done} price(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
