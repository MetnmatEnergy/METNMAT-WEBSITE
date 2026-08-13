# metnmat.com — Production Upgrade, Release Notes

Everything below was verified against **production**, not a local build. Where a
gate was not met, it says so.

Run the gate yourself:

```bash
node apps/website/scripts/qa-crawl.mjs https://www.metnmat.com
```

> ⚠️ **Dated record (through 2026-08-03), verified against GCP Cloud Run.** This
> is a per-phase account of work that shipped, and the commit SHAs against each
> phase are the durable part — they stay true regardless of where the site runs.
> Three caveats before using it as a status report:
>
> 1. **The gate command above cannot pass right now.** Every service 503s while
>    GCP billing is disabled. A failing crawl today says nothing about the work
>    recorded here.
> 2. **Phase 8's performance numbers are Cloud Run measurements.** They are not a
>    valid before/after for the AWS stack — different runtime, no CDN, single
>    instance. Re-baseline after cutover rather than comparing against them. The
>    caveat already noted in `BACKLOG.md` still applies too: mobile Lighthouse
>    varied ±20 points run to run, so compare page weight, not scores.
> 3. **"Needs the site owner" (bottom) is the only live section** — those items
>    are open until someone does them. Everything above it is history.
>
> For what has changed since, see `AUDIT.md` §11 (several Phase 0 findings are
> now closed) and `deploy/README.md` (the GCP → AWS migration).

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
**Gate not met.** Desktop passes (95–100); mobile does not reach ≥95 on `/`.

Measured with Lighthouse 12.8.2 against production, **median of 3 serial runs
per page** (parallel runs contend for CPU and corrupt the result). Reproduce:

```bash
node run.mjs mobile 3   # scratchpad runner; desktop needs lighthouse/core/config/desktop-config.js
```

Two methodology traps, both of which produced wrong numbers here first:
- **`formFactor: "desktop"` alone is not the desktop preset.** It changes the
  viewport but leaves the default *mobile* throttling (4× CPU, 1.6 Mbps) in
  place, which scored desktop at 71–80 instead of 94–100. Use `desktop-config.js`.
- Passing the string `"lighthouse:default"` as a config object throws
  "No artifacts were defined on the config". For stock mobile, pass `undefined`.

| Page | Mobile (Phase 0) | Desktop | Weight |
|---|---|---|---|
| `/` | **85** (73) | 99 | 817 KiB |
| `/shop` | **92 (74)** | 100 | **536 KiB** |
| `/shop/p/…` | 85–96 (99) | 100 | 571 KiB |
| `/blog/…` | 77–82 (98) | 99 | 500 KiB |
| `/cart` | **95** | **100** | 1,102 KiB |

Mobile perf scores still swing ±20 between runs (`/` ran 75/73/81 in one median),
so treat weight and the a11y/SEO categories as the signal and single perf scores
as noise.

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

Then a production Lighthouse run found three more, fixed in `cd6334f`:

- **The desktop LCP was a lazily-loaded mosaic tile.** Promoting "the first tile"
  would have been a no-op — column A's four products all lack photography — so
  the rule is *first card that actually has an image, first copy only*. Against
  live CMS data that resolves to exactly one image, `PEM Fuel Cell Hardware`,
  the very element Lighthouse named. It uses `loading="eager"`, **not**
  `priority`: the mosaic is `hidden lg:block`, and `priority` would preload a
  large image on mobile where it never renders and is not the LCP.
- **Homepage service cards pulled 900px Unsplash masters into a ~366px box** —
  504 → 401 KiB measured on a 750px variant. Width only, no `&h=`: these URLs
  carry `fit=crop`, so pinning a height re-frames the photo. `/services` keeps
  the tall master; its fan carousel is genuinely portrait (344×608).
- **The logo was still PNG.** Re-encoded lossless to WebP and verified
  pixel-identical after decode — the wordmark is the same artwork, 67 → 45 KB.
  The PNGs stay on disk; `icon-512.png` remains the structured-data logo.
- **62 partner logos had no intrinsic size.** All 31 dimensions measured with
  sharp. CSS still decides the rendered size, so nothing moves after load — the
  box is simply correct *before* the bitmap arrives. `getClients()` now carries
  `width`/`height` from Payload so CMS-supplied logos inherit the same fix.

Net: `/` mobile **867 → 817 KiB**, TBT 152 → 61 ms.

Where the remaining weight is, so the next pass doesn't re-derive it:

| | |
|---|---|
| Warm cache | 106 KB total — 57 KB HTML + 48 KB nav prefetch; everything else served from cache |
| Initial JS | ~197 KB brotli, excluding the 34 KB polyfills chunk (it carries `noModule`, so modern browsers never fetch it). This is the React 19 + Next 15 App Router baseline |
| Images | At DPR 2 on a 375px viewport, no image downloads a variant more than 1.6× its rendered box — the `sizes` attributes are correct |

#### Homepage mobile LCP · `98933fc`

The hero's left column — badge, headline, subtitle, CTAs, stats — was wrapped in
`animate-fade-up`, which starts at `opacity: 0`. That block holds the LCP
element, and **Chrome does not count an invisible element**, so a decorative
entrance animation was pushing LCP out by roughly its own 0.6s.

Controlled A/B, identical content and a 58 KiB document, median of 5 mobile runs
against a local server (6–15 ms server time, so this isolates render):

| | perf | LCP |
|---|---|---|
| with `animate-fade-up` | 86 | 3996 ms |
| without | **89** | **3392 ms** |

On production the median moved **83 → 85** and LCP **4798 → 4165 ms**.
`cart-rail` and `filter-drawer` keep the animation; they hold no LCP candidate.

**Two things measured and deliberately NOT shipped:**

- **`content-visibility` on the below-fold sections** reached perf 92 / LCP
  3129 ms and did *not* regress CLS (0.0001). Rejected anyway: the page grew
  7283 → 8488px as sections rendered, because `contain-intrinsic-size` cannot be
  sized correctly for both mobile and desktop — the real blocks measure
  1820/2771/1805px at desktop and are taller on mobile. First scroll jumps
  ~1200px. Two Lighthouse points is not worth that on a marketing page.
- **Hiding the maintenance banner is worth about ONE point** (perf 90 vs 89,
  LCP 3325 vs 3392 ms). See the correction under Known limitations.

**Why ≥95 is not reachable without structural change.** With a **6 ms** server
and near-zero network, local FCP is still ~2 s and LCP ~3.4 s. This is CPU, not
bytes: Lighthouse throttles mobile CPU 4×, and the page is **1502 DOM elements /
445 KiB of raw HTML** (`dom-size` scores 0.5; main-thread work 2.2 s). Of the
255 KiB of markup, the partner marquee alone is **55 KiB and 247 elements** — 62
logos whose repeated Tailwind class strings account for 39 KiB. The remaining
lever is shipping *less homepage*, which is a redesign, not a fix.

#### `/cart` layout shift · `6d65142`

`/cart` was the only page failing CLS — **0.155 on production**, and Lighthouse
attributed all of it to one shift of `<footer>`.

The cart lives in `localStorage`, so the server can only render a spinner. That
box is ~152px and resolves to the empty-cart state at ~368px, dropping
everything below it — footer included — by ~216px in a single frame.

All three states now reserve the same height. Measured with the same instrument
on the same build: **0.196 → 0.0002 locally, 0.0000 on production**, the only
remainder being a 0.00015 font swap. `/cart` went **91 → 95 mobile, 94 → 100
desktop**.

Nothing gains dead whitespace: the reserved height *is* the empty state's
natural height, and because the block sits in `max-w-md` that height is
viewport-independent — it measures 368px at both 375px and 803px, where the
64px under the buttons is the pre-existing `py-16`. With items the container
measures 880px, so the reservation is inert.

A cart that *does* have items still expands from the reserved height. Removing
that would mean telling the server the cart size through a cookie, which would
make the page uncacheable — not worth it for the returning-visitor case.

#### Three Lighthouse failures that are CORRECT behaviour

Verified against the source and deliberately **not** changed:

- **`/cart` SEO 63 — `is-crawlable`.** `robots.ts` disallows `/cart` on purpose,
  in a commented list of thin/transactional routes. A cart must not be indexed;
  the audit is reporting the intent working. Adding a `noindex` meta would be a
  no-op — a compliant crawler never fetches a disallowed URL, so it never reads
  the tag. Making the meta effective would mean *removing* the disallow.
- **`legacy-javascript`.** There is no browserslist anywhere in the repo, so Next
  already uses its modern target. The flagged bytes are `next/dist/build/
  polyfills/polyfill-module.js`, `require()`d unconditionally by Next itself —
  ~513 bytes brotli that no config can remove. Adding a browserslist would make
  it *worse*: the usual values are wider than Next's floor, so SWC would start
  down-compiling our own source, and browserslist is shared with autoprefixer,
  silently re-targeting CSS prefixing site-wide.
- **`uses-long-cache-ttl`.** The app already sends
  `public, max-age=31536000, immutable` on `/_next/static/**`. A Google edge
  cache rewrites it to `public,max-age=3600` before the browser sees it — the
  CDN clamp already documented in CLAUDE.md. Nothing in app code can override a
  header applied downstream of the origin.

### Phase 9 — Accessibility · `28987d9` `cd6334f`
**axe clean, 100/100 on all six page types** (from 91–93). Fixed: `<aside>`
cannot carry `role="dialog"`; the quantity field had no accessible name;
`text-brand` measured 3.70:1 on dark (moved to `brand-soft`, 5.23:1); heading
order; and three WCAG 2.5.3 failures — a button reading "Save" that announced
"Add to wishlist" could not be activated by voice.

**That 100/100 held only at mobile width.** A later production Lighthouse run at
*desktop* width scored `/` at **94** and every other page at **97** — because the
desktop nav is hidden on mobile, so the audit never reached it. Two real defects
were hiding there, fixed in `cd6334f`:

- The **active nav link** still used `text-brand`: 3.79:1 on the translucent
  header, under the 4.5:1 AA floor. Now `text-brand-soft` (4.99:1). The same
  defect sat in `mobile-nav.tsx` and `departments-menu.tsx`, both rendered behind
  `{open && …}` where no automated audit can ever see them. All six
  theme × background combinations were recomputed from the raw HSL tokens and
  every one now passes. The brand-red underline stays — a non-text indicator,
  judged at 3:1. This one class fixed a11y on *every* page: 97 → **100**.
- **Carousel dots were 6×6 hit targets.** The dot is now the visual and the
  button's padding is the target — 12×26, an 8.7× area increase — with
  `px-[3px]` recreating the exact 6px whitespace `gap-1.5` gave. Verified: pills
  still 6×6/32×6, gaps still 6px, row still 40px tall, and clicking the padding
  outside the pill selects the tab.

`/` therefore sits at **97**, not 100: axe wants a 24px target and 12px is under
it. Closing that needs visibly wider dot spacing, which is a design decision, not
a bug fix — and WCAG 2.5.8 already exempts a control with an equivalent path,
which the 40×40 prev/next arrows provide to every slide. Recorded, not hidden.

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

### DPDP Act, 2023 · `c87447d`

India's Digital Personal Data Protection Act has **no "legitimate interest"
basis**, and website analytics is not one of the s.7 certain legitimate uses.
The site was setting a persistent visitor id on every visit with nothing asked.

**Consent (s.6).** Analytics runs only on an explicit yes. Nothing is
pre-selected and the banner has no dismiss "X" — dismissal is not a clear
affirmative action. Accept and Decline are one click, same size, both on screen.
`getTracker()` gates on consent and deliberately does **not** memoise the
refusal, so accepting starts measurement without a reload; `resetTracker()`
drops the cached instance *and* the queued events so withdrawal stops it
mid-session. Withdrawal erases `mm-vid`/`mm-sid`/`mm-slast` rather than merely
ceasing to use them, and lives behind "Privacy choices" in every footer, because
s.6(4) requires withdrawing to be as easy as giving. The record is versioned:
raising `CONSENT_VERSION` re-asks everyone.

**Notice (s.5).** `/privacy` rewritten to the Act's structure — a per-purpose
table, the consent position, browser storage itemised as necessary vs consented,
processors named, retention (including that GST invoices cannot be erased on
request while that duty stands), s.8(5) safeguards, the five rights, and the
route to the Data Protection Board. s.9 children is stated honestly: a B2B site
not directed at under-18s, with no claim to a parental-consent mechanism we do
not have.

**Rights and grievance (ss.11-14).** `/privacy/request` files into a new
`data-requests` collection that stamps `receivedAt`, a due date from a
configurable SLA, and a reference shown to the requester. Public create,
staff-only read. Nothing is auto-actioned — erasing a customer record is a human
decision with legal retention to weigh. The route has **no email fallback** on a
CMS failure, unlike `/api/contact`: a statutory clock has to leave an auditable
record, and silently emailing it would look like success while the obligation
went untracked. The Grievance Officer (s.13(3)) is published from a new CMS
global defaulting to the real `contact@metnmat.com`; name and phone are editable
so the officer can be named without a deploy.

Verified on production:

| Check | Result |
|---|---|
| First-time visitor, no decision | no `mm-vid`, no `mm-sid`, **0** `/api/a/collect` calls |
| After Accept (no reload) | ids created, collect request sent |
| Withdraw via footer | all three ids erased, **0** further collect calls |
| Rights request end to end | `DPR-2026-IBUU0D` persisted with reference + due date |
| `GET /api/data-requests` unauthenticated | **403** — anyone may file, nobody may read |
| Honeypot / bad email / bad type / >4000 chars | 400 each |

Nine tests pin what must not silently regress: undecided is not consent, corrupt
storage is not consent, a stale version re-asks, and withdrawal erases.

Two things worth knowing before touching this:

- **The accept path cannot be verified with Puppeteer.** `collector.ts`
  self-excludes bots on `navigator.webdriver`, which Puppeteer sets true, so an
  automated run shows consent stored but no visitor id — correct behaviour that
  reads exactly like a bug. Verify accept in a non-automated browser.
- Consent is **opt-in by the site owner's decision**, taken knowing it costs
  analytics coverage from everyone who declines or ignores the banner.

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

1. **Lighthouse mobile ≥95 not met on `/` and `/blog/…`** (85 and 81; `/shop/p/…`
   reaches 96, `/shop` 92, `/cart` 95).
   **Correction: the maintenance banner is NOT what caps this.** That claim was
   never measured. It was measured now, by building with the banner disabled:
   worth **~1 point** (perf 90 vs 89). Keeping it costs essentially nothing, so
   there is no performance reason to retire it early. The real cap is DOM size
   and CPU — see the homepage LCP note in Phase 8.
2. **`/` desktop accessibility is 97, not 100** — axe `target-size` on the
   carousel dots. The hit area is 8.7× larger than it was but still 12px wide
   against axe's 24px bar; clearing it needs visibly wider dot spacing, which is
   a design call. The 40×40 prev/next arrows already reach every slide.
3. **`/blog/…` occasionally reports CLS ~0.115.** Intermittent: three
   consecutive dedicated runs measured 0.0000 with no shift items, so treat a
   single non-zero reading as a cold image load, not a regression.
4. **CSP keeps `'unsafe-inline'`** — a decision, not a gap. Nonces are per-request and cannot coexist with cached HTML, and Next's 21 per-page RSC scripts cannot be hashed, so removing it would make every page dynamic. JSON-LD is already escaped and no user-generated HTML is rendered, so nothing exploitable is open. Caps securityheaders.com at A.
5. **62 of 68 products have no image.** Content gap; nothing in code fixes it.
   This is also why the homepage mosaic's whole first column renders
   placeholders — see the LCP fix in Phase 8.
6. **35 legacy products and all 26 legacy posts** land on `/shop/all` and
   `/blog` — no provable equivalent exists.
7. **Mobile Lighthouse varies ±20 points run to run** (`/shop` measured
   63/69/82/86 in one session). Compare page weight, not single scores.
8. **Do not trust paint timings (FCP/LCP) taken from the in-app browser pane.**
   The homepage reported FCP 1452 ms with TTFB 32 ms, CSS resolved at 44 ms,
   fonts at 92 ms, `domInteractive` 91 ms and **zero** long tasks — an
   unexplained 1.36 s gap that reads exactly like a render-blocking bug. It
   isn't. A calibration page serving one `<h1>` with no CSS, no JS and no images
   reported **FCP 2368 ms** in the same pane. The pane doesn't composite
   promptly, so every paint metric it produces is floor-limited by the harness.
   Resource sizes, request counts, element geometry and `naturalWidth` from that
   pane are fine — only paint timing is not. Use Lighthouse or a real browser.
9. **The deployer service account cannot read Cloud Logging**, which made a
   silent seed failure cost several deploy cycles to diagnose.

## Needs the site owner

- **Delete the DPDP verification record** `DPR-2026-IBUU0D` in Admin → Data
  Requests. I created it to prove the pipeline persists end to end; it is
  labelled "AUTOMATED VERIFICATION - safe to delete" and deleting needs a staff
  login I do not have.
- **Name the Grievance Officer** in Admin → Privacy & DPDP. The site currently
  publishes `contact@metnmat.com` alone, which is a valid published contact,
  but naming a person is better practice.
- Verify both domains in **Google Search Console** and submit the sitemap.
  `GOOGLE_SITE_VERIFICATION` is wired; set it and redeploy.
- Retire the **maintenance banner** when the site is ready.
- Upload **product photography**.
- The four Phase 0 decisions: `metnmat.in` strategy, legacy content migration,
  `COMPANY_GSTIN`/`COMPANY_CIN`, and a staging environment.

Remaining backlog: `docs/upgrade/BACKLOG.md`.
