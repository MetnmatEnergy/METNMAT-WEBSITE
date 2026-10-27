/**
 * Apply a reviewed plan of field changes to products and categories.
 *
 * Every change names the value it expects to replace (`expect`), read from the
 * live catalogue when the plan was written. If staff have changed that field
 * since, the row is reported and skipped — a plan can never overwrite newer
 * work. `fillIfEmpty` fields are written only while the live value is empty.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/set-catalogue-fields.ts <plan.json> --target=prod --dry-run
 *   npx tsx scripts/set-catalogue-fields.ts <plan.json> --target=prod --confirm
 *
 * Plan rows:
 *   { "collection": "products" | "categories",
 *     "slug": "…",
 *     "set":    { "<field>": <value>, … },        // written when expect matches
 *     "expect": { "<field>": <live value>, … },   // per field in `set`; omit a field to skip the check
 *     "fillIfEmpty": { "<field>": <value>, … },   // written only when the live value is empty
 *     "categorySlug": "…",                        // products: move to this category
 *     "note": "why" }
 * `specs` is compared and written as the whole [{label, value}] array.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnv, assertTarget, APP_DIR } from "./_bootstrap";
loadEnv();

import { getPayload } from "payload";

type Row = {
  collection: "products" | "categories";
  slug: string;
  set?: Record<string, unknown>;
  expect?: Record<string, unknown>;
  fillIfEmpty?: Record<string, unknown>;
  categorySlug?: string;
  note?: string;
};

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const CONFIRMED = argv.includes("--confirm");

const norm = (v: unknown): string => {
  if (Array.isArray(v)) {
    return JSON.stringify(v.map((s: { label?: string; value?: string }) => [String(s?.label ?? "").trim(), String(s?.value ?? "").trim()]));
  }
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v.trim() : JSON.stringify(v);
};
const empty = (v: unknown) => norm(v) === "" || norm(v) === "[]";
const short = (v: unknown) => {
  const s = norm(v);
  return s.length > 90 ? `${s.slice(0, 87)}…` : s;
};

function loadPlan(): Row[] {
  const rel = argv.find((a) => !a.startsWith("--") && a.endsWith(".json"));
  if (!rel) throw new Error("Pass the plan file, e.g. scripts/catalogue-plans/fixes-2026-10.json");
  const rows = JSON.parse(fs.readFileSync(path.resolve(APP_DIR, rel), "utf8")) as Row[];
  if (!Array.isArray(rows) || !rows.length) throw new Error("plan must be a non-empty array");
  for (const r of rows) {
    if (!r.slug || !["products", "categories"].includes(r.collection)) throw new Error(`bad row: ${JSON.stringify(r).slice(0, 200)}`);
    if (!r.set && !r.fillIfEmpty && !r.categorySlug) throw new Error(`${r.slug}: nothing to change`);
  }
  return rows;
}

async function main() {
  const { target, dbName } = assertTarget(argv);
  const plan = loadPlan();
  if (!DRY && !CONFIRMED) throw new Error("Refusing to write without --confirm. Run --dry-run first.");

  console.log(`target   ${target}  (database "${dbName}")`);
  console.log(`rows     ${plan.length}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be written" : "WRITING"}\n`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const cats = await payload.find({ collection: "categories", limit: 500, depth: 0 });
  const catBySlug = new Map(cats.docs.map((c) => [(c as { slug: string }).slug, c as { id: string }]));

  let written = 0;
  let skipped = 0;
  for (const r of plan) {
    const found = await payload.find({
      collection: r.collection,
      where: { slug: { equals: r.slug } },
      limit: 1,
      depth: 0,
      draft: true,
    });
    const doc = found.docs[0] as (Record<string, unknown> & { id: string }) | undefined;
    if (!doc) {
      console.log(`  MISSING ${r.collection}/${r.slug}`);
      skipped++;
      continue;
    }
    const data: Record<string, unknown> = {};
    const stale: string[] = [];
    for (const [field, value] of Object.entries(r.set ?? {})) {
      if (r.expect && field in r.expect && norm(doc[field]) !== norm(r.expect[field])) {
        stale.push(`${field} is now "${short(doc[field])}"`);
        continue;
      }
      if (norm(doc[field]) !== norm(value)) data[field] = value;
    }
    for (const [field, value] of Object.entries(r.fillIfEmpty ?? {})) {
      if (empty(doc[field])) data[field] = value;
    }
    if (r.categorySlug) {
      const cat = catBySlug.get(r.categorySlug);
      if (!cat) throw new Error(`${r.slug}: unknown category ${r.categorySlug}`);
      if (String(doc.category) !== String(cat.id)) data.category = cat.id;
    }
    for (const s of stale) console.log(`  stale   ${r.collection}/${r.slug}: ${s} — left alone`);
    if (!Object.keys(data).length) {
      if (!stale.length) console.log(`  same    ${r.collection}/${r.slug}`);
      skipped++;
      continue;
    }
    for (const [field, value] of Object.entries(data)) {
      console.log(`  ${DRY ? "would" : "set  "}   ${r.collection}/${r.slug}  ${field}: "${short(doc[field])}" -> "${short(value)}"`);
    }
    if (DRY) continue;
    await payload.update({ collection: r.collection, id: doc.id, data: data as never });
    written++;
  }
  console.log(`\n${DRY ? "dry run complete" : `updated ${written} record(s)`}; ${skipped} unchanged/skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
