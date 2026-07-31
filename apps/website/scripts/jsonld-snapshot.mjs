/**
 * Captures the JSON-LD emitted by one URL of each page type, normalised so two
 * runs can be diffed.
 *
 *   node apps/website/scripts/jsonld-snapshot.mjs <origin> <outFile> [pathsJson]
 *
 * Used to prove a refactor of the schema builders changed nothing: snapshot
 * production, refactor, snapshot a local build of the same pages, diff. Keys are
 * sorted recursively so formatting/ordering differences don't show up as churn.
 */
import fs from "node:fs";

const ORIGIN = process.argv[2].replace(/\/$/, "");
const OUT = process.argv[3];
const PATHS = process.argv[4]
  ? JSON.parse(process.argv[4])
  : {
      home: "/",
      about: "/about",
      services: "/services",
      contact: "/contact",
      shop: "/shop",
      product: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm",
      blogList: "/blog",
      blogArticle: "/blog/co2-fuel-cells",
      projectList: "/projects",
      projectDetail: "/projects/microstructure-control-heat-treatment",
    };

const sortDeep = (v) => {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortDeep(v[k])])
    );
  }
  return v;
};

const snapshot = {};
for (const [label, path] of Object.entries(PATHS)) {
  const html = await (await fetch(ORIGIN + path, { headers: { "user-agent": "Mozilla/5.0" } })).text();
  const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const docs = [];
  for (const raw of blocks) {
    try {
      docs.push(sortDeep(JSON.parse(raw)));
    } catch {
      docs.push({ __unparseable: raw.slice(0, 120) });
    }
  }
  // Order of <script> tags is not semantically meaningful; sort for a stable diff.
  snapshot[label] = docs.map((d) => JSON.stringify(d)).sort();
}

fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
const total = Object.values(snapshot).reduce((n, d) => n + d.length, 0);
console.error(`snapshot: ${Object.keys(snapshot).length} page types, ${total} JSON-LD blocks → ${OUT}`);
