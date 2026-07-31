/**
 * Information-architecture crawl for the public site.
 *
 *   node apps/website/scripts/ia-crawl.mjs [origin]
 *
 * Fetches every URL in sitemap.xml, follows internal links one hop past it, and
 * reports the things that quietly hurt crawlability:
 *   - duplicate <title> across different URLs
 *   - missing / self-inconsistent canonical tags
 *   - orphans: sitemap URLs no other page links to
 *   - internal links that 404 or redirect
 *   - pages with no <h1>, or more than one
 *
 * Read-only. Safe to run against production.
 */

const ORIGIN = (process.argv[2] || "https://www.metnmat.com").replace(/\/$/, "");
const UA = "Mozilla/5.0 (compatible; metnmat-ia-crawl/1.0)";
const CONCURRENCY = 4;

const pick = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim().replace(/\s+/g, " ") : "";
};

async function get(url) {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "manual" });
      const ct = res.headers.get("content-type") || "";
      const readable = ct.includes("text/html") || ct.includes("xml");
      const body = res.status === 200 && readable ? await res.text() : "";
      return { status: res.status, location: res.headers.get("location") || "", body };
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (a + 1)));
    }
  }
  return { status: 0, location: "", body: "" };
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n], n);
      }
    })
  );
  return out;
}

// ---- 1. sitemap -----------------------------------------------------------
const sm = await get(`${ORIGIN}/sitemap.xml`);
const sitemapUrls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].trim())
  .filter((u) => u.startsWith(ORIGIN));
if (!sitemapUrls.length) {
  console.error(`no sitemap URLs from ${ORIGIN}/sitemap.xml (status ${sm.status})`);
  process.exit(1);
}
const paths = [...new Set(sitemapUrls.map((u) => new URL(u).pathname))];
console.log(`sitemap: ${paths.length} unique paths\n`);

// ---- 2. crawl -------------------------------------------------------------
const pages = new Map(); // path -> {status, title, canonical, h1count}
const linkedTo = new Map(); // path -> Set(referrers)
const noteLink = (to, from) => {
  if (!linkedTo.has(to)) linkedTo.set(to, new Set());
  linkedTo.get(to).add(from);
};

await pool(paths, async (p) => {
  const r = await get(ORIGIN + p);
  const h1s = (r.body.match(/<h1[\s>]/g) || []).length;
  pages.set(p, {
    status: r.status,
    location: r.location,
    title: pick(r.body, /<title>([^<]*)<\/title>/i),
    canonical: pick(r.body, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i),
    h1s,
  });
  for (const m of r.body.matchAll(/<a\b[^>]*href="([^"#?]+)/g)) {
    const href = m[1];
    if (href.startsWith("/") && !href.startsWith("//")) noteLink(href.replace(/\/$/, "") || "/", p);
    else if (href.startsWith(ORIGIN)) noteLink(new URL(href).pathname.replace(/\/$/, "") || "/", p);
  }
});

// ---- 3. report ------------------------------------------------------------
const norm = (p) => p.replace(/\/$/, "") || "/";
let issues = 0;
const section = (name, rows) => {
  console.log(`── ${name}: ${rows.length}`);
  rows.slice(0, 25).forEach((r) => console.log("   " + r));
  if (rows.length > 25) console.log(`   … ${rows.length - 25} more`);
  console.log();
  issues += rows.length;
};

section(
  "non-200 in sitemap",
  [...pages].filter(([, v]) => v.status !== 200).map(([k, v]) => `${v.status} ${k}${v.location ? " -> " + v.location : ""}`)
);

const byTitle = new Map();
for (const [p, v] of pages) {
  if (v.status !== 200 || !v.title) continue;
  if (!byTitle.has(v.title)) byTitle.set(v.title, []);
  byTitle.get(v.title).push(p);
}
section(
  "duplicate <title>",
  [...byTitle].filter(([, ps]) => ps.length > 1).map(([t, ps]) => `"${t.slice(0, 70)}" ← ${ps.length}: ${ps.slice(0, 4).join(", ")}`)
);

section(
  "missing canonical",
  [...pages].filter(([, v]) => v.status === 200 && !v.canonical).map(([k]) => k)
);
section(
  "canonical points elsewhere",
  [...pages]
    .filter(([k, v]) => v.status === 200 && v.canonical && norm(new URL(v.canonical, ORIGIN).pathname) !== norm(k))
    .map(([k, v]) => `${k} → ${v.canonical}`)
);

section(
  "orphans (in sitemap, not linked from any crawled page)",
  paths.filter((p) => pages.get(p)?.status === 200 && !linkedTo.has(norm(p))).map((p) => p)
);

section(
  "h1 problems",
  [...pages].filter(([, v]) => v.status === 200 && v.h1s !== 1).map(([k, v]) => `${v.h1s} h1 — ${k}`)
);

// Internal link targets we never crawled (outside the sitemap) — check them.
const offSitemap = [...linkedTo.keys()].filter((p) => !pages.has(p) && !p.startsWith("/api"));
const checked = await pool(offSitemap, async (p) => ({ p, ...(await get(ORIGIN + p)) }));
section(
  "internal links to non-200",
  checked.filter((c) => c.status !== 200 && c.status !== 307 && c.status !== 308).map((c) => `${c.status} ${c.p}  ← ${[...linkedTo.get(c.p)].slice(0, 3).join(", ")}`)
);

console.log(issues === 0 ? "clean." : `${issues} finding(s).`);
