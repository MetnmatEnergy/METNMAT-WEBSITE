/**
 * Fill product SEO fields (seoTitle, metaDescription) from an explicit plan.
 *
 * Part of docs/seo/MASTER-PROMPT.md: once metnmat.in redirects here, the titles
 * and descriptions written for the Wix pages stop showing in search, and the
 * .com pages that replace them should carry the better of the two. The plan is
 * reviewed by a person first (docs/seo/product-seo-plan.csv); this script only
 * writes what the plan says, and only into fields that are still EMPTY, so it
 * can never overwrite a title or description staff have written in the admin
 * ("catalog ownership = CMS staff"). Pass --overwrite to replace a live value,
 * and then only where the plan's "from" matches it exactly.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/set-product-seo.ts <plan.json> --target=prod --dry-run
 *   npx tsx scripts/set-product-seo.ts <plan.json> --target=prod --confirm
 *
 * The plan is [{ "slug", "seoTitle"?, "metaDescription"?, "fromSeoTitle"?,
 * "fromMetaDescription"? }, …].
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnv, assertTarget, APP_DIR } from "./_bootstrap";
loadEnv();

import { getPayload } from "payload";

type Field = "seoTitle" | "metaDescription";
type SeoChange = {
  slug: string;
  seoTitle?: string;
  metaDescription?: string;
  fromSeoTitle?: string;
  fromMetaDescription?: string;
};

const FIELDS: Field[] = ["seoTitle", "metaDescription"];
// The layout appends " · METNMAT" (10 characters) to every title, and Google
// shows about 60. A longer title is cut mid-word in the result.
const MAX = { seoTitle: 50, metaDescription: 165 } as const;
const MIN = { seoTitle: 15, metaDescription: 70 } as const;

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const CONFIRMED = argv.includes("--confirm");
const OVERWRITE = argv.includes("--overwrite");

function loadPlan(): SeoChange[] {
  const rel = argv.find((a) => !a.startsWith("--") && a.endsWith(".json"));
  if (!rel) throw new Error("Pass the plan file, e.g. scripts/seo-plans/products-2026-10.json");
  const parsed = JSON.parse(fs.readFileSync(path.resolve(APP_DIR, rel), "utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("plan must be a non-empty array");
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const p of parsed as SeoChange[]) {
    if (!p.slug || !FIELDS.some((f) => typeof p[f] === "string")) problems.push(`bad row: ${JSON.stringify(p)}`);
    for (const f of FIELDS) {
      const v = p[f];
      if (v === undefined) continue;
      if (v.trim() !== v || v.length < MIN[f] || v.length > MAX[f]) {
        problems.push(`${p.slug}: ${f} must be ${MIN[f]}–${MAX[f]} trimmed characters (is ${v.length})`);
      }
      // Two products with one title (or description) compete with each other.
      const key = `${f}:${v.toLowerCase()}`;
      if (seen.has(key)) problems.push(`${p.slug}: ${f} duplicates ${seen.get(key)}`);
      seen.set(key, p.slug);
    }
  }
  if (problems.length) throw new Error(`plan rejected:\n  ${problems.join("\n  ")}`);
  return parsed;
}

async function main() {
  const { target, dbName } = assertTarget(argv);
  const plan = loadPlan();
  if (!DRY && !CONFIRMED) throw new Error("Refusing to write without --confirm. Run --dry-run first.");

  console.log(`target   ${target}  (database "${dbName}")`);
  console.log(`rows     ${plan.length}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be written" : "WRITING"}${OVERWRITE ? " (overwrite)" : ""}\n`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const found = await payload.find({
    collection: "products",
    where: { slug: { in: plan.map((p) => p.slug) } },
    limit: plan.length,
    depth: 0,
  });
  type Doc = { id: string; slug: string } & Partial<Record<Field, string | null>>;
  const bySlug = new Map(found.docs.map((d) => [(d as Doc).slug, d as Doc]));

  const missing = plan.filter((p) => !bySlug.has(p.slug)).map((p) => p.slug);
  if (missing.length) throw new Error(`slug(s) not found:\n  ${missing.join("\n  ")}`);

  let written = 0;
  let kept = 0;
  for (const p of plan) {
    const doc = bySlug.get(p.slug)!;
    const data: Partial<Record<Field, string>> = {};
    for (const f of FIELDS) {
      const next = p[f];
      if (next === undefined) continue;
      const live = (doc[f] ?? "").trim();
      if (live === next) continue;
      const from = f === "seoTitle" ? p.fromSeoTitle : p.fromMetaDescription;
      if (live && !(OVERWRITE && from === live)) {
        console.log(`  keep   ${p.slug}  ${f} is set by staff: "${live}"`);
        kept++;
        continue;
      }
      data[f] = next;
      console.log(`  ${DRY ? "would" : "set "}  ${p.slug}  ${f}\n           "${live}"\n        -> "${next}"`);
    }
    if (!Object.keys(data).length || DRY) continue;
    await payload.update({ collection: "products", id: doc.id, data: data as never });
    written++;
  }
  console.log(`\n${DRY ? "dry run complete" : `updated ${written} product(s)`}; ${kept} staff value(s) left untouched`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
