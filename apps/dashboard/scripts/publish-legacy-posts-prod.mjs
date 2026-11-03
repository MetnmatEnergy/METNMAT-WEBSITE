// Publish the 15 metnmat.in posts to production with publish-legacy-posts.ts:
// dry run first, and only if that succeeds, the real write. No email is sent
// (see the script). Cross-platform, no shell, so paths with spaces are safe.
//
// Run with the production CMS environment loaded:
//   node "<...>/Documents/metnmat-seo/with-cms-env.mjs" "<repo>" -- node apps/dashboard/scripts/publish-legacy-posts-prod.mjs
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DASH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = createRequire(path.join(DASH, "package.json")).resolve("tsx/cli");

for (const mode of ["--dry-run", "--confirm"]) {
  console.log(`\n=== ${mode === "--dry-run" ? "1/2  dry run" : "2/2  publishing"} ===`);
  const r = spawnSync(process.execPath, [tsx, "scripts/publish-legacy-posts.ts", "--target=prod", mode], { cwd: DASH, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    console.error(`\nSTOPPED: ${mode} exited ${r.status}.${mode === "--dry-run" ? " Nothing was written." : ""}`);
    process.exit(r.status ?? 1);
  }
}
console.log("\n=== DONE — tell Claude 'done' ===");
