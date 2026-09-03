/**
 * Remove product gallery entries whose media file no longer exists.
 *
 * WHY THIS EXISTS
 * GCS media was deliberately not migrated when the platform moved to S3 (see
 * CLAUDE.md, "the media bucket is empty by decision"). The Media DOCUMENTS from
 * that era survived in Mongo, so a product can still reference a file that 404s.
 * The storefront then renders a broken <img> — worse than the branded
 * placeholder, which is what an empty gallery gives you.
 *
 * WHAT IT DOES NOT DO
 * It does not delete the Media documents, only the product's reference to them,
 * and only for the slugs you name. Nothing is inferred and nothing is bulk-swept:
 * a dead reference is proof the FILE is gone, not that the record is worthless —
 * staff may still want the row for provenance.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/prune-dead-images.ts --target=prod --slugs=a,b --dry-run
 *   npx tsx scripts/prune-dead-images.ts --target=prod --slugs=a,b
 *
 * Pass --slugs=ALL to audit every product WITHOUT writing (report only); it
 * refuses to combine ALL with a real write, so a survey can never turn into a
 * catalogue-wide edit by a missing flag.
 */
import { loadEnv, assertTarget } from "./_bootstrap";
loadEnv();

import { getPayload } from "payload";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL || "https://admin.metnmat.com";

/** HEAD the file; anything other than 2xx means the storefront cannot show it. */
async function isDead(url: string): Promise<boolean> {
  const abs = url.startsWith("http") ? url : `${CMS_URL}${url}`;
  try {
    const res = await fetch(abs, { method: "HEAD" });
    return !res.ok;
  } catch {
    // A transport failure is NOT proof the file is gone — treat it as alive so a
    // flaky network can never delete a good reference.
    return false;
  }
}

async function main() {
  const { target, dbName } = assertTarget(argv);
  const raw = flag("slugs");
  if (!raw) throw new Error("Pass --slugs=<slug,slug> (or --slugs=ALL to survey without writing)");
  const surveyAll = raw === "ALL";
  if (surveyAll && !DRY) {
    throw new Error("--slugs=ALL is survey-only. Re-run with --dry-run, then name the slugs you want changed.");
  }
  const slugs = surveyAll ? [] : raw.split(",").map((s) => s.trim()).filter(Boolean);

  console.log(`target   ${target}  (database "${dbName}")`);
  console.log(`scope    ${surveyAll ? "ALL products (survey only)" : slugs.join(", ")}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be written" : "WRITING"}\n`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const found = await payload.find({
    collection: "products",
    where: surveyAll ? {} : { slug: { in: slugs } },
    limit: surveyAll ? 500 : slugs.length,
    depth: 1,
  });

  if (!surveyAll) {
    const missing = slugs.filter((s) => !found.docs.some((d) => (d as { slug?: string }).slug === s));
    if (missing.length) throw new Error(`unknown slug(s): ${missing.join(", ")}`);
  }

  let changed = 0;
  let deadTotal = 0;
  for (const product of found.docs) {
    const p = product as { id: string; slug: string; images?: { image?: unknown }[] };
    const gallery = p.images ?? [];
    if (gallery.length === 0) continue;

    const keep: { image: string }[] = [];
    const dead: string[] = [];
    for (const row of gallery) {
      const media = row.image as { id?: string; url?: string; filename?: string } | string | undefined;
      if (!media || typeof media === "string") {
        // Unresolvable reference (depth did not populate it) — leave it alone
        // rather than guess; this script only acts on evidence it can verify.
        if (typeof media === "string") keep.push({ image: media });
        continue;
      }
      if (media.url && (await isDead(media.url))) {
        dead.push(media.filename ?? media.id ?? "?");
      } else if (media.id) {
        keep.push({ image: media.id });
      }
    }

    if (dead.length === 0) continue;
    deadTotal += dead.length;
    console.log(`${p.slug}: ${dead.length} dead of ${gallery.length}`);
    for (const f of dead) console.log(`    404  ${f}`);

    if (DRY) continue;
    await payload.update({
      collection: "products",
      id: p.id,
      data: { images: keep } as never,
    });
    console.log(`    -> gallery now ${keep.length} image(s)`);
    changed++;
  }

  console.log(`
${deadTotal} dead reference(s) across ${found.docs.length} product(s) inspected.`);
  if (!DRY) console.log(`${changed} product(s) updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
