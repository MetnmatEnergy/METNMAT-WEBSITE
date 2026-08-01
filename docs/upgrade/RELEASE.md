# metnmat.com — Production Upgrade, Release Notes

Everything below was verified against **production**, not a local build. Where a
gate was not met, it says so.

Run the gate yourself:

```bash
node apps/website/scripts/qa-crawl.mjs https://www.metnmat.com
```

---

## Phases

### Phase 0 — Discovery (read-only)
`docs/upgrade/AUDIT.md` — stack, hosting, routes, Payload model, media, legacy
parity, Lighthouse baseline, findings register, and the four decisions that
still block work.

### Phase 1 — Stabilise / CMS integrity · `8123aec`
- Products now read through a `_status: published` gate — drafts can no longer
  leak through the public API. Pre-checked all 68 products were published before
  shipping, so the shop could not empty.
- Slugify hooks on Categories and Services.
- Deleted a dead `/api/products` stub and four unused backend files.
- Rate limits on `/api/search`, `/api/product-by-sku`, `/api/geo`,
  `/api/products/resolve`.

### Phase 4 — Information architecture · `57ffa46` `68b7179` `7c9e0e0`
- **122 redirects** for the legacy Wix site (33 pages, 100 products, 26 posts);
  158 of 159 legacy URLs resolve. `/blank-2` is left to 404 deliberately.
- **The first version was wrong and was corrected.** Slug-similarity matching
  sent every platinum wire/ring/spiral URL to a platinum *sheet*, and six
  glass-bodied Ag/AgCl electrodes to a PEEK probe — `platinum-counter-electrode`
  reads like a family page but is one SKU. Matching now runs against each
  product's own spec table (chemistry, body material, form factor, size
  options). 17 mappings repointed, 7 newly resolved.
- Breadcrumbs on every page; `PageBreadcrumbs` emits the visible trail and its
  JSON-LD from one array so they cannot drift.
- Redirects emit a literal **301** (Next's `permanent: true` is a 308).

### Phase 5 — Navigation
Mega menu operable by keyboard (arrows, Home/End, Escape, focus return),
verified on production.

### Phase 6 — Technical SEO · `36d34cc` `ea7b38d` `3897378` `723a7a3`
- **Sitemap index** with per-section children, so Search Console reports
  coverage per section instead of one number. Children are not prerendered (a
  cold CMS during a build once dropped every product), and a CMS-backed section
  that comes back empty returns **503 + no-store** rather than a cacheable empty
  200.
- Two dangling `@id` references fixed: product Offers named a seller no node
  defined, and articles without authors emitted an anonymous company beside a
  publisher for the same company.
- All schema builders consolidated into `components/seo/schema.ts` (pure, no
  JSX, unit-testable). **Proven equivalent**: snapshotted production JSON-LD for
  10 page types, refactored, re-snapshotted a local build against the production
  CMS — 9 identical, the 10th differing only by the intended fix.

### Phase 7 — GEO / AI search · `c6fc700` `f5d7a00`
- Buyer Q&A on product pages with FAQPage schema. Every answer traces to a field
  set on that product or a published policy; questions without source data are
  omitted rather than invented.
- Entity relationships: articles declare `isPartOf` the Blog and `about` their
  own CMS category; products declare `isRelatedTo` the products actually shown.

### Phase 8 — Performance · `4360a96` `dd17472` `c22a163` `4b728a0` `9a1b982`
**Gate not met.** Desktop passes (96–99); mobile does not reach ≥95.

| Page | Mobile (Phase 0) | Desktop | Weight |
|---|---|---|---|
| `/` | 73 (94) | 96 | 903 KiB |
| `/shop` | **86 (74)** | 99 | **560 KiB** |
| `/shop/p/…` | 78 (99) | 98 | 600 KiB |
| `/blog/…` | 82 (98) | 99 | 500 KiB |

`/shop` — the page actually worked — beat its baseline; its weight fell
**1,016 → 560 KiB**. Fixes: carousel mounted all 5 banners at once; the chat
widget pulled 378 KiB (193 KiB unused) on every page; category tiles were
fetched inside the LCP burst because `loading="lazy"` is inert within ~1250px.

Three wrong diagnoses were disproved by measuring: the audit's `_next/image`
cold-miss (every resource returns in <300 ms, TTFB 0.12 s), cold containers, and
local CPU contention. Lighthouse *simulates* 1.6 Mbps, so the score tracks total
bytes — the site is fast for real users.

#### Homepage weight · `55e5337` `f9fa75d`

`/` was the heaviest page. Two measured reductions:

- **Partner logos PNG → WebP: 571 → 202 KiB.** 31 logos in the trusted-by
  marquee, shipped as PNG.
- **Header stopped prefetching utility routes: 5 prefetches / 58 KB → 3 / 48 KB**
  (verified on production). Next prefetches every visible `Link`, and the cart,
  wishlist and mobile-search icons sit in the header of every page — so each
  visit speculatively pulled `/cart` (10 KB) and `/search` for routes most people
  never open. Primary nav still prefetches: `/shop`, `/services`, `/contact`.

Where the remaining weight actually is, so the next pass doesn't re-derive it:

| | |
|---|---|
| Warm cache | 106 KB total — 57 KB HTML + 48 KB nav prefetch; everything else served from cache |
| Initial JS | ~197 KB brotli, excluding the 34 KB polyfills chunk (it carries `noModule`, so modern browsers never fetch it). This is the React 19 + Next 15 App Router baseline |
| Images | **Nothing to win.** At DPR 2 on a 375px viewport, zero images download a variant more than 1.6× their rendered box — the `sizes` attributes are correct — and nothing above the fold is `eager` below it |
| LCP element | **Text**, not an image (the hero subtitle). So `priority` on the mosaic would only compete with the real LCP, not help it |

### Phase 9 — Accessibility · `28987d9`
**axe clean, 100/100 on all six page types** (from 91–93). Fixed: `<aside>`
cannot carry `role="dialog"`; the quantity field had no accessible name;
`text-brand` measured 3.70:1 on dark (moved to `brand-soft`, 5.23:1); heading
order; and three WCAG 2.5.3 failures — a button reading "Save" that announced
"Add to wishlist" could not be activated by voice.

Keyboard walkthrough: nav, search (a correct combobox with
`aria-activedescendant`), and the inquiry form (labels, `aria-invalid`,
`aria-describedby`, focus to first error).

### Phase 10 — Key page types · `e3d11d7`
Products and blog complete against the checklist. RSS existed but only `/blog`
advertised it — now site-wide. **No Research section was built**: there is no
real research content, and inventing objectives and publications would breach
the no-fabrication rule.

### Phase 11 — Search · `5fe7a6b`
Ten real customer queries; **three returned nothing**. The blog article titled
"CO₂ Fuel Cells" was unreachable by typing "CO2" — the subscript is a different
character. Also "electrolyser" (we list "electrolyzer") and "nafion" (we list it
as PFSA). All ten now return correct results in ~200 ms.

### Phase 12 — Security
**8 of 9 pass.** Headers complete; no secrets in `.next/static`; CMS collections
403; internal routes 401; cookies `httpOnly`/`sameSite`/`secure`; **no draft
leakage** (probed three ways). `unsafe-inline` stays in `script-src` by decision: nonces cannot coexist with
cached HTML and Next's per-page RSC scripts cannot be hashed, so the migration
would cost site-wide caching to close a hole that is not open. Recorded in
BACKLOG.md with the measurements.

### Phase 14 — Final QA
`apps/website/scripts/qa-crawl.mjs` — **clean: 126 pages, 78 images, exit 0**.
Fails on non-200, broken link or image, missing/duplicate title, description,
canonical or H1, orphan, or missing schema on a page type that requires it.

---

## Project covers · `762ec8a` `88a9dca` `b2aadab` `06741bc`

All 15 case studies now have covers. The nine new ones failed silently at first:
`Media.category` is required with `defaultValue: "product"`, and the
product-image spec hook added earlier in this upgrade polices exactly that
category (4:3, ≥2400px). Every 3:2 banner was rejected at validation. Seed media
creates now state their category explicitly.

---

## Known limitations

1. **Lighthouse mobile ≥95 not met.** The maintenance banner is the LCP element
   on 3 of 5 pages; the site owner is keeping it for now.
2. **CSP keeps `'unsafe-inline'`** — a decision, not a gap. Nonces are per-request and cannot coexist with cached HTML, and Next's 21 per-page RSC scripts cannot be hashed, so removing it would make every page dynamic. JSON-LD is already escaped and no user-generated HTML is rendered, so nothing exploitable is open. Caps securityheaders.com at A.
3. **62 of 68 products have no image.** Content gap; nothing in code fixes it.
4. **35 legacy products and all 26 legacy posts** land on `/shop/all` and
   `/blog` — no provable equivalent exists.
5. **Mobile Lighthouse varies ±20 points run to run** (`/shop` measured
   63/69/82/86 in one session). Compare page weight, not single scores.
6. **Do not trust paint timings (FCP/LCP) taken from the in-app browser pane.**
   The homepage reported FCP 1452 ms with TTFB 32 ms, CSS resolved at 44 ms,
   fonts at 92 ms, `domInteractive` 91 ms and **zero** long tasks — an
   unexplained 1.36 s gap that reads exactly like a render-blocking bug. It
   isn't. A calibration page serving one `<h1>` with no CSS, no JS and no images
   reported **FCP 2368 ms** in the same pane. The pane doesn't composite
   promptly, so every paint metric it produces is floor-limited by the harness.
   Resource sizes, request counts, element geometry and `naturalWidth` from that
   pane are fine — only paint timing is not. Use Lighthouse or a real browser.
6. **The deployer service account cannot read Cloud Logging**, which made a
   silent seed failure cost several deploy cycles to diagnose.

## Needs the site owner

- Verify both domains in **Google Search Console** and submit the sitemap.
  `GOOGLE_SITE_VERIFICATION` is wired; set it and redeploy.
- Retire the **maintenance banner** when the site is ready.
- Upload **product photography**.
- The four Phase 0 decisions: `metnmat.in` strategy, legacy content migration,
  `COMPANY_GSTIN`/`COMPANY_CIN`, and a staging environment.

Remaining backlog: `docs/upgrade/BACKLOG.md`.
