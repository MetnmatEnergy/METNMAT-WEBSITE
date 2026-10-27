// One-shot catalogue update for the metnmat.in → metnmat.com move (2026-10-27).
// Cross-platform (no shell): every step runs tsx through this same Node binary,
// so paths with spaces ("HP VICTUS 1") are safe.
//
// Run with the production CMS environment loaded:
//   node "<...>/Documents/metnmat-seo/with-cms-env.mjs" "<repo>" -- node apps/dashboard/scripts/catalogue-plans/run-2026-10-27.mjs "<image dir>"
//
// 1. DRY RUN of every step — stops here if anything is wrong. Nothing is written.
// 2. Creates the 9 products that existed only on metnmat.in (published, priced as on metnmat.in).
// 3. Attaches their photographs.
// 4. Applies fixes-2026-10.json: repaired descriptions, real spec tables, brands,
//    the Test product unpublished, H-Cell category filled, category intros.
// 5. Fills empty SEO titles/meta descriptions (never overwrites staff values).
//
// --from=4 resumes at step 4 once steps 2-3 have run: it dry-runs steps 4-5,
// then applies them. Steps 2-3 are not repeated, because re-running step 3
// would attach every photograph a second time.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DASH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FROM = Number((process.argv.find((a) => a.startsWith("--from=")) || "--from=1").slice(7));
const IMG = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (![1, 4].includes(FROM)) throw new Error("--from must be 1 or 4");
if (!IMG && FROM < 4) throw new Error("pass the image directory (Documents/metnmat-seo/img-new)");
const tsx = createRequire(path.join(DASH, "package.json")).resolve("tsx/cli");

const NEW = "scripts/draft-products/metnmat-in-missing-2026-10.json";
const FIXES = "scripts/catalogue-plans/fixes-2026-10.json";
const SEO_OLD = "scripts/seo-plans/products-2026-10.json";
const SEO_NEW = "scripts/seo-plans/products-new-2026-10.json";
const ATTACH = [
  "h-type-electrochemical-cell-100-100-ml",
  "h-type-electrochemical-cell-30-30-ml",
  "water-jacketed-electrochemical-cell-100-ml",
  "single-chamber-electrochemical-cell-50-ml",
  "graphite-felt-electrode-200-200-3-mm",
  "nickel-fiber-felt-electrode-10-10-cm",
  "pem-hydrogen-electrolyzer-60-ml-min",
  "piperion-anion-exchange-ionomer-dispersion-5-wt-20-ml",
  "ptfe-water-splitting-reactor-40-ml-three-electrode",
].map((s) => `scripts/attach-manifests/${s}.json`);

function run(script, ...args) {
  console.log(`\n$ tsx ${script} ${args.join(" ")}`);
  const r = spawnSync(process.execPath, [tsx, script, ...args], { cwd: DASH, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    console.error(`\nSTOPPED: ${script} exited ${r.status}. Nothing after this step was run.`);
    process.exit(r.status ?? 1);
  }
}

console.log("=== 1/5  dry run ===");
if (FROM < 4) run("scripts/create-draft-products.ts", NEW, "--target=prod", "--publish", "--dry-run");
run("scripts/set-catalogue-fields.ts", FIXES, "--target=prod", "--dry-run");
run("scripts/set-product-seo.ts", SEO_OLD, "--target=prod", "--dry-run");
// The 9 new products exist only after step 2, so their SEO plan can be checked only on a resume.
if (FROM >= 4) run("scripts/set-product-seo.ts", SEO_NEW, "--target=prod", "--dry-run");

if (FROM < 4) {
  console.log("\n=== 2/5  create the 9 products ===");
  run("scripts/create-draft-products.ts", NEW, "--target=prod", "--publish");

  console.log("\n=== 3/5  attach photographs ===");
  run("scripts/attach-product-images.ts", ...ATTACH, "--images", IMG, "--target=prod", "--dry-run");
  run("scripts/attach-product-images.ts", ...ATTACH, "--images", IMG, "--target=prod");
}

console.log("\n=== 4/5  fixes ===");
run("scripts/set-catalogue-fields.ts", FIXES, "--target=prod", "--confirm");

console.log("\n=== 5/5  SEO titles and descriptions ===");
run("scripts/set-product-seo.ts", SEO_OLD, "--target=prod", "--confirm");
run("scripts/set-product-seo.ts", SEO_NEW, "--target=prod", "--confirm");

console.log("\n=== DONE — tell Claude 'catalogue update done' ===");
