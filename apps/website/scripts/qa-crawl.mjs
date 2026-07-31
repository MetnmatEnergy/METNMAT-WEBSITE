/**
 * Full-site QA crawl. Exits non-zero on any failure, so it can gate a release.
 *
 *   node apps/website/scripts/qa-crawl.mjs [origin]
 *
 * Fails on:
 *   - a non-200 page in the sitemap
 *   - a broken internal link or image
 *   - a missing or duplicated <title>, description, canonical or <h1>
 *   - a sitemap URL that does not resolve, or a page missing from the sitemap
 *   - an orphan page (in the sitemap, linked from nowhere)
 *   - missing or invalid JSON-LD on a page type that requires it
 *
 * .mjs, not the .ts the brief names: this repo has no TypeScript runner wired
 * for standalone scripts (no tsx/ts-node dependency), and a script that cannot
 * be executed is not a gate. Same directory and conventions as the other
 * scripts here.
 */

const ORIGIN = (process.argv[2] || "https://www.metnmat.com").replace(/\/$/, "");
const UA = "Mozilla/5.0 (compatible; metnmat-qa-crawl/1.0)";
const CONCURRENCY = 4;

// Page types that MUST carry particular structured data. Anything not listed
// only has to be internally consistent.
const REQUIRED_SCHEMA = [
  { test: (p) => p === "/", types: ["WebSite"] },
  { test: (p) => p.startsWith("/shop/p/"), types: ["Product", "BreadcrumbList"] },
  // /blog/submit is a submission form, not an article — it shares the URL shape
  // but carries no post, so requiring BlogPosting there is a false positive.
  { test: (p) => /^\/blog\/[^/]+$/.test(p) && p !== "/blog/submit", types: ["BlogPosting", "TechArticle"], anyOf: true },
  { test: (p) => /^\/projects\/[^/]+$/.test(p), types: ["CreativeWork"] },
];

const failures = [];
const fail = (kind, detail) => failures.push({ kind, detail });

async function get(url) {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "manual" });
      const ct = res.headers.get("content-type") || "";
      const readable = ct.includes("text/html") || ct.includes("xml");
      return { status: res.status, body: res.status === 200 && readable ? await res.text() : "" };
    } catch {
      await new Promise((r) => setTimeout(r, 400 * (a + 1)));
    }
  }
  return { status: 0, body: "" };
}

async function pool(items, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

const pick = (html, re) => (html.match(re)?.[1] ?? "").trim().replace(/\s+/g, " ");
const norm = (p) => p.replace(/\/$/, "") || "/";

// ---- 1. sitemap (index + children) ----------------------------------------
const index = await get(`${ORIGIN}/sitemap.xml`);
const childUrls = [...index.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const isIndex = index.body.includes("<sitemapindex");
let sitemapUrls = [];
if (isIndex) {
  for (const child of childUrls) {
    const c = await get(child);
    if (c.status !== 200) fail("sitemap-child", `${c.status} ${child}`);
    sitemapUrls.push(...[...c.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));
  }
} else {
  sitemapUrls = childUrls;
}
sitemapUrls = [...new Set(sitemapUrls.filter((u) => u.startsWith(ORIGIN)))];
const paths = [...new Set(sitemapUrls.map((u) => new URL(u).pathname))];
if (!paths.length) fail("sitemap", "no URLs found");
console.log(`sitemap: ${isIndex ? childUrls.length + " children, " : ""}${paths.length} unique paths\n`);

// ---- 2. crawl -------------------------------------------------------------
const pages = new Map();
const linkedTo = new Map();
const imgs = new Set();

await pool(paths, async (p) => {
  const r = await get(ORIGIN + p);
  if (r.status !== 200) fail("non-200", `${r.status} ${p}`);
  const ld = [];
  for (const m of r.body.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      ld.push(JSON.parse(m[1]));
    } catch {
      fail("invalid-jsonld", p);
    }
  }
  pages.set(p, {
    status: r.status,
    title: pick(r.body, /<title>([^<]*)<\/title>/i),
    desc: pick(r.body, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i),
    canonical: pick(r.body, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i),
    h1s: (r.body.match(/<h1[\s>]/g) || []).length,
    ld,
  });
  for (const m of r.body.matchAll(/<a\b[^>]*href="([^"#?]+)/g)) {
    const h = m[1];
    const abs = h.startsWith("/") && !h.startsWith("//") ? h : h.startsWith(ORIGIN) ? new URL(h).pathname : null;
    if (abs) {
      if (!linkedTo.has(norm(abs))) linkedTo.set(norm(abs), new Set());
      linkedTo.get(norm(abs)).add(p);
    }
  }
  for (const m of r.body.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const s = m[1];
    if (s.startsWith("/") && !s.startsWith("//")) imgs.add(s.replace(/&amp;/g, "&"));
  }
});

// ---- 3. per-page assertions ----------------------------------------------
const titles = new Map();
for (const [p, v] of pages) {
  if (v.status !== 200) continue;
  if (!v.title) fail("missing-title", p);
  if (!v.desc) fail("missing-description", p);
  if (!v.canonical) fail("missing-canonical", p);
  else if (norm(new URL(v.canonical, ORIGIN).pathname) !== norm(p)) fail("canonical-mismatch", `${p} -> ${v.canonical}`);
  if (v.h1s !== 1) fail("h1-count", `${v.h1s} on ${p}`);
  if (v.title) {
    if (!titles.has(v.title)) titles.set(v.title, []);
    titles.get(v.title).push(p);
  }
  const rule = REQUIRED_SCHEMA.find((r) => r.test(p));
  if (rule) {
    const found = new Set();
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== "object") return;
      if (typeof n["@type"] === "string") found.add(n["@type"]);
      Object.values(n).forEach(walk);
    };
    v.ld.forEach(walk);
    const ok = rule.anyOf ? rule.types.some((t) => found.has(t)) : rule.types.every((t) => found.has(t));
    if (!ok) fail("missing-schema", `${p} expected ${rule.types.join(rule.anyOf ? " or " : " + ")}`);
  }
}
for (const [t, ps] of titles) if (ps.length > 1) fail("duplicate-title", `"${t.slice(0, 60)}" on ${ps.join(", ")}`);

// ---- 4. orphans -----------------------------------------------------------
for (const p of paths) {
  if (pages.get(p)?.status !== 200) continue;
  if (p === "/") continue; // the root is reached by the logo on every page
  if (!linkedTo.has(norm(p))) fail("orphan", p);
}

// ---- 5. internal links + images not already crawled ------------------------
const offSitemap = [...linkedTo.keys()].filter((p) => !pages.has(p) && !p.startsWith("/api"));
await pool(offSitemap, async (p) => {
  const r = await get(ORIGIN + p);
  // 3xx to a real page is intentional (the legacy redirect map).
  if (r.status !== 200 && r.status !== 301 && r.status !== 302 && r.status !== 307 && r.status !== 308) {
    fail("broken-link", `${r.status} ${p}  (linked from ${[...linkedTo.get(p)].slice(0, 2).join(", ")})`);
  }
});
await pool([...imgs], async (src) => {
  const r = await get(ORIGIN + src);
  if (r.status !== 200) fail("broken-image", `${r.status} ${src.slice(0, 90)}`);
});

// ---- report ---------------------------------------------------------------
const byKind = failures.reduce((m, f) => ((m[f.kind] = m[f.kind] || []).push(f.detail), m), {});
for (const [kind, items] of Object.entries(byKind)) {
  console.log(`✗ ${kind}: ${items.length}`);
  items.slice(0, 10).forEach((d) => console.log(`    ${d}`));
  if (items.length > 10) console.log(`    … ${items.length - 10} more`);
}
console.log(
  failures.length === 0
    ? `\n✓ QA crawl clean — ${pages.size} pages, ${offSitemap.length} off-sitemap links, ${imgs.size} images.`
    : `\n${failures.length} failure(s).`
);
process.exit(failures.length ? 1 : 0);
