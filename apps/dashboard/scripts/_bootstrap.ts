/**
 * Shared start-up for the catalogue scripts: load .env, then REFUSE to run
 * unless the database you are pointed at is the one you said you wanted.
 *
 * This exists because the failure it prevents has already happened on this
 * project — `apps/dashboard/.env` has pointed at production while someone
 * believed they were on the dev copy. A catalogue import is exactly the kind of
 * write where noticing afterwards is too late.
 *
 * The guard is deliberately two-sided. Refusing to write production by accident
 * is the obvious half; refusing to write the *dev* database when you meant
 * production matters just as much, because that failure is silent — the import
 * reports success, the live site does not change, and the next hour goes into
 * debugging a deploy that was never the problem.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.join(__dirname, "..");

/** Load .env without overriding anything already exported in the shell. */
export function loadEnv(): void {
  const envPath = path.join(APP_DIR, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

/** The database name out of a Mongo URI, ignoring any ?query. */
export function dbNameFromUri(uri: string): string {
  const afterHost = uri.split("/").slice(3).join("/");
  return (afterHost.split("?")[0] || "").trim();
}

export type Target = "dev" | "prod";

/**
 * Resolve --target and check it against MONGODB_URI. Exits non-zero on any
 * disagreement rather than guessing, and prints what it saw — a guard that
 * refuses without saying which database it found sends you to the wrong file.
 */
export function assertTarget(argv: string[]): { target: Target; dbName: string } {
  const raw = argv.find((a) => a.startsWith("--target="))?.split("=")[1];
  if (raw !== "dev" && raw !== "prod") {
    console.error("Refusing to run without an explicit target.\n");
    console.error("  --target=dev    write the *_dev database (rehearse here first)");
    console.error("  --target=prod   write the live catalogue\n");
    process.exit(2);
  }
  const uri = process.env.MONGODB_URI || "";
  if (!uri) {
    console.error("MONGODB_URI is not set (checked the shell and apps/dashboard/.env).");
    process.exit(2);
  }
  const dbName = dbNameFromUri(uri);
  if (!dbName) {
    console.error(`Could not read a database name out of MONGODB_URI. Got: "${uri.replace(/:[^:@/]+@/, ":***@")}"`);
    process.exit(2);
  }

  // The chatbot's database is a different system that happens to live on the
  // same cluster. Writing Payload collections into it has happened before and
  // left stray _products_versions behind, so it is named explicitly rather than
  // left to the dev/prod rule.
  if (dbName === "metnmat") {
    console.error(`MONGODB_URI points at "metnmat" — that is the CHATBOT's database, not the CMS.`);
    console.error(`The CMS is "metnmat_cms" (prod) or "metnmat_cms_dev" (dev). Refusing.`);
    process.exit(2);
  }

  const want: Target = raw === "prod" ? "prod" : "dev";
  const looksDev = dbName.endsWith("_dev");
  if (want === "dev" && !looksDev) {
    console.error(`--target=dev but MONGODB_URI points at "${dbName}", which is not a *_dev database. Refusing.`);
    process.exit(2);
  }
  if (want === "prod" && looksDev) {
    console.error(`--target=prod but MONGODB_URI points at "${dbName}", a dev database.`);
    console.error(`The import would report success and change nothing on the live site. Refusing.`);
    process.exit(2);
  }
  return { target: want, dbName };
}

/**
 * Storage must be S3 for a production import. Left unset, resolveStorageConfig
 * defaults to `gcs` — which is dead — and uploads would fail partway through a
 * run, after some products had already been written.
 */
export function assertS3(target: Target): void {
  if (target !== "prod") return;
  const provider = (process.env.STORAGE_PROVIDER || "").toLowerCase();
  if (provider !== "s3") {
    console.error(`STORAGE_PROVIDER is "${provider || "(unset)"}" — must be "s3" for a production import.`);
    console.error(`Unset it defaults to "gcs", which is the retired provider.`);
    process.exit(2);
  }
  for (const k of ["S3_BUCKET", "S3_REGION"]) {
    if (!process.env[k]) {
      console.error(`${k} is not set — required when STORAGE_PROVIDER=s3.`);
      process.exit(2);
    }
  }
}
