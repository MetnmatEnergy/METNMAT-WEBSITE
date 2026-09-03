/**
 * Delete products by slug. Deliberately blunt and deliberately explicit.
 *
 * This exists to undo a bad import. It takes an explicit slug list — never a
 * pattern, never a category — because the failure mode of a catalogue delete is
 * unrecoverable, and a wildcard is exactly how that happens.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/delete-products.ts --target=prod --slugs=a,b --dry-run
 *   npx tsx scripts/delete-products.ts --target=prod --slugs=a,b --confirm
 *
 * It refuses to run without --confirm, prints every product it is about to
 * remove, and stops if any named slug is missing (a typo must not silently
 * delete a shorter list than intended).
 */
import { loadEnv, assertTarget } from "./_bootstrap";
loadEnv();

import { getPayload } from "payload";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const CONFIRMED = argv.includes("--confirm");
const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

async function main() {
  const { target, dbName } = assertTarget(argv);
  const raw = flag("slugs");
  if (!raw) throw new Error("Pass --slugs=<slug,slug,…>");
  const slugs = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!DRY && !CONFIRMED) {
    throw new Error("Refusing to delete without --confirm. Re-run with --dry-run first.");
  }

  console.log(`target   ${target}  (database "${dbName}")`);
  console.log(`slugs    ${slugs.length}`);
  console.log(`mode     ${DRY ? "DRY RUN — nothing will be deleted" : "DELETING"}\n`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const found = await payload.find({
    collection: "products",
    where: { slug: { in: slugs } },
    limit: slugs.length,
    depth: 0,
  });

  const bySlug = new Map(found.docs.map((d) => [(d as { slug: string }).slug, d]));
  const missing = slugs.filter((s) => !bySlug.has(s));
  if (missing.length) {
    throw new Error(`slug(s) not found — refusing to run a partial delete:\n  ${missing.join("\n  ")}`);
  }

  let done = 0;
  for (const slug of slugs) {
    const doc = bySlug.get(slug) as { id: string; name?: string; images?: unknown[] };
    console.log(`  ${DRY ? "would delete" : "delete"}  ${slug}  (${doc.name ?? "?"})`);
    if (DRY) continue;
    // The product goes; its media documents stay in the library, where staff can
    // reuse or clear them. Deleting uploads here would be a second, wider blast
    // radius for no benefit.
    await payload.delete({ collection: "products", id: doc.id });
    done++;
  }
  console.log(`\n${DRY ? "would delete" : "deleted"} ${DRY ? slugs.length : done} product(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
