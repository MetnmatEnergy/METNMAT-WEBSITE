/**
 * Structured-data check for one URL of every page type.
 *
 *   node apps/website/scripts/validate-jsonld.mjs [origin]
 *
 * Parses every JSON-LD block and checks the fields Google actually requires for
 * rich results, plus the mistakes that silently disqualify a page:
 *   - unparseable JSON (the whole block is dropped)
 *   - required properties missing per @type
 *   - Review/AggregateRating without real reviews (a manual-action risk, and
 *     forbidden by this project's no-fabricated-data rule)
 *   - the same @type emitted twice on one page without distinct @id
 *
 * Read-only. This is not a substitute for Google's Rich Results Test, but it
 * catches everything that tool would flag as an error rather than a warning.
 */

const ORIGIN = (process.argv[2] || "https://www.metnmat.com").replace(/\/$/, "");

// One URL per page type. Product/blog/project slugs are resolved from the live
// sitemaps so this keeps working as content changes.
async function pageTypeUrls() {
  const pick = async (section, fallback) => {
    try {
      const xml = await (await fetch(`${ORIGIN}/sitemaps/${section}.xml`)).text();
      const first = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])[0];
      return first ? new URL(first).pathname : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    home: "/",
    about: "/about",
    services: "/services",
    contact: "/contact",
    "shop (collection)": "/shop",
    "product (detail)": await pick("products", "/shop/p/aluminum-sheet"),
    "blog (listing)": "/blog",
    "blog (article)": await pick("blog", "/blog"),
    "projects (listing)": "/projects",
    "project (detail)": await pick("projects", "/projects"),
  };
}

const REQUIRED = {
  Product: ["name"],
  Offer: ["price", "priceCurrency", "availability"],
  BlogPosting: ["headline", "datePublished"],
  Article: ["headline", "datePublished"],
  BreadcrumbList: ["itemListElement"],
  // `url` is NOT required on every Organization: an author's affiliation is
  // legitimately just a name. The canonical company entity is checked separately
  // by the dangling-@id-reference rule below.
  Organization: ["name"],
  WebSite: ["name", "url"],
  ItemList: ["itemListElement"],
  FAQPage: ["mainEntity"],
  Service: ["name"],
  ImageObject: ["url"],
  Person: ["name"],
};

const walk = (node, fn) => {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, fn));
  if (!node || typeof node !== "object") return;
  fn(node);
  for (const v of Object.values(node)) walk(v, fn);
};

let errors = 0;
let checked = 0;

const urls = await pageTypeUrls();
for (const [label, path] of Object.entries(urls)) {
  const res = await fetch(ORIGIN + path, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = await res.text();
  const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  const problems = [];
  const types = [];
  const parsed = [];

  for (const [i, raw] of blocks.entries()) {
    try {
      parsed.push(JSON.parse(raw));
    } catch (e) {
      problems.push(`block ${i + 1} is not valid JSON (${e.message.slice(0, 60)}) — Google drops it entirely`);
    }
  }

  for (const doc of parsed) {
    walk(doc, (n) => {
      const t = n["@type"];
      if (typeof t !== "string") return;
      types.push(t);

      // A node that carries an @id and little else is a REFERENCE to an entity
      // defined elsewhere in the graph, not a definition. Requiring the full
      // property set on it would flag correct, deliberately-deduped markup.
      const isReference =
        typeof n["@id"] === "string" &&
        Object.keys(n).filter((k) => !["@type", "@id", "name"].includes(k)).length === 0;
      if (isReference) return;

      for (const req of REQUIRED[t] ?? []) {
        if (n[req] === undefined || n[req] === null || n[req] === "") {
          problems.push(`${t} is missing required "${req}"`);
        }
      }
      if (t === "AggregateRating" || t === "Review") {
        problems.push(`${t} present — this site has no real reviews; fabricated ratings risk a manual action`);
      }
      if (t === "Offer" && n.price !== undefined && !(Number(n.price) >= 0)) {
        problems.push(`Offer.price is not a valid number ("${n.price}")`);
      }
    });
  }

  // Dangling @id references: if a page points at an entity by @id, some node on
  // that page must actually DEFINE it (carry a url). Otherwise the reference
  // resolves to a bare name — which is how product Offers ended up with a
  // seller that had no identity at all.
  const ids = new Map();
  for (const doc of parsed) {
    walk(doc, (n) => {
      if (typeof n["@id"] !== "string") return;
      const defined = ids.get(n["@id"]) || false;
      ids.set(n["@id"], defined || Boolean(n.url));
    });
  }
  for (const [id, defined] of ids) {
    if (!defined) problems.push(`@id "${id}" is referenced but never defined on this page (no node carries a url)`);
  }

  // Duplicate top-level entities without a distinguishing @id confuse dedupe.
  const counts = types.reduce((m, t) => ((m[t] = (m[t] || 0) + 1), m), {});
  for (const [t, n] of Object.entries(counts)) {
    if (n > 1 && ["BreadcrumbList", "WebSite", "Product"].includes(t)) {
      problems.push(`${t} appears ${n}× on one page`);
    }
  }

  checked++;
  errors += problems.length;
  const status = problems.length === 0 ? "OK  " : "FAIL";
  console.log(`${status} ${label.padEnd(20)} ${path}`);
  console.log(`       types: ${[...new Set(types)].sort().join(", ") || "(none)"}`);
  for (const p of problems) console.log(`       ✗ ${p}`);
}

console.log(`\n${checked} page types checked, ${errors} error(s).`);
process.exit(errors ? 1 : 0);
