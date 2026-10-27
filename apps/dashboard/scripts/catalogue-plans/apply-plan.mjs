// Apply one catalogue plan (set-catalogue-fields.ts) to production: dry run first,
// and only if that succeeds, the real write. Cross-platform, no shell, so paths
// with spaces ("HP VICTUS 1") are safe.
//
// Run with the production CMS environment loaded:
//   node "<...>/Documents/metnmat-seo/with-cms-env.mjs" "<repo>" -- node apps/dashboard/scripts/catalogue-plans/apply-plan.mjs scripts/catalogue-plans/<plan>.json
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DASH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PLAN = process.argv[2];
if (!PLAN?.endsWith(".json")) throw new Error("pass the plan, e.g. scripts/catalogue-plans/<plan>.json");
const tsx = createRequire(path.join(DASH, "package.json")).resolve("tsx/cli");

for (const mode of ["--dry-run", "--confirm"]) {
  console.log(`\n=== ${mode === "--dry-run" ? "1/2  dry run" : "2/2  writing"} ===`);
  const r = spawnSync(process.execPath, [tsx, "scripts/set-catalogue-fields.ts", PLAN, "--target=prod", mode], { cwd: DASH, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    console.error(`\nSTOPPED: ${mode} exited ${r.status}.${mode === "--dry-run" ? " Nothing was written." : ""}`);
    process.exit(r.status ?? 1);
  }
}
console.log("\n=== DONE — tell Claude 'done' ===");
