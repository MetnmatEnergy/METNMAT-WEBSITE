# SEO Changelog

Every SEO-affecting change, newest first. Branch: `seo/technical-geo-overhaul`.

Format: what changed · why · files · verification.

---

## 2026-08-05 — Phase 4: per-SKU product descriptions, and the LCP fix corrected

### 1 · Product meta descriptions are now derived per SKU

All 68 products ship with `metaDescription` unset, so every one fell back to
`shortDesc` — which is written per product **family**, not per SKU. Four
descriptions were byte-identical across 11 URLs, and 63 of 68 ran past Google's
~155-character display limit.

The SKUs genuinely differ — body material, tube diameter, effective length,
junction core — and every one of those values is already in the product's own
`specs`. Descriptions now lead with the specs that distinguish the SKU and
follow with the family prose. **Nothing is invented; every word traces to a real
CMS field.** A CMS `metaDescription` still wins and is returned untouched.

**Measured across all 68 real products:**

| | before | after |
|---|---:|---:|
| Duplicate description groups | 4 (11 URLs) | **0** |
| Descriptions over 155 chars | 63 | **0** |
| Longest | 314 | **154** (median 151) |

Two rules had to be found by measuring, not reasoning:

- **Taking the first three specs in CMS order was not enough.** Sibling SKUs
  share their opening specs: the platinum-wire pair is identical for three rows
  and splits at `body material` (PEEK vs PTFE); the Hg/HgO pair is identical for
  five and splits at `Body Material` (Glass vs PTFE). Two duplicate groups
  survived the first attempt. Specs are now ranked — material, then dimensions,
  then CMS order — before slicing.
- **Nine products carry the same spec twice** under punctuation variants, which
  rendered as `Body / Material: PEEK, Body Material: PEEK`. Deduped on the label
  stripped to alphanumerics — deliberately *not* on the value, since
  `body diameter` and `tube diameter` can both legitimately be 6 mm.

- `apps/website/src/frontend/lib/seo.ts` — `productMetaDescription()`
- `apps/website/src/app/shop/p/[slug]/page.tsx`
- `test/product-meta-description.test.ts` (new, 18 tests — 227 → 245)

### 2 · The `/services` LCP fix from Phase 3 was wrong, and is corrected

Phase 3 eagerly loaded carousel indices 0 and 1 on the assumption that the front
card is index 0. **It is not.** With `MAX_VISIBLE = 7`, `HALF = 3` and 8 cards,
`centerIndex` starts at 3 and the initially visible set is indices 0–6 — every
one of them painted on first render. Five painted cards stayed lazy, and mobile
LCP was still **10.78 s median** against a lazy-loaded card 2.

Now derived rather than assumed: `initialVisibleCount` and `initialFrontIndex`
mirror the layout effect's own `frontSlot`, so every painted card is eager and
the front card carries `fetchpriority="high"`.

A second mistake, caught by measuring: the first correction also marked the
other visible cards `fetchpriority="low"`. Which card Chrome picks as LCP
depends on painted area and moves with the viewport — index 0 on desktop, index
2 on mobile, the front card on neither — so `low` was telling the browser to
fetch the actual LCP candidate last. Removed; only the front card carries an
explicit priority.

Phase 3 did work on desktop: LCP 2.84 s → **2.35 s**, `lcp-lazy-loaded` passing.
It was mobile that was untouched.

**Measured on production**, 3 runs per form factor, median with spread:

| `/services` | baseline | Phase 3 (broken) | **now** |
|---|---:|---:|---:|
| Mobile LCP | 8.93 s | 10.78 s | **3.49 s** |
| Mobile perf | — | 62 | **83** |
| Desktop LCP | 2.84 s | 2.35 s | **0.82 s** |
| Desktop perf | — | 79 | **94** |
| `lcp-lazy-loaded` | 0 | 0, 0.5, 1 | **1, 1, 1** (both form factors) |
| CLS | 0.000 | 0.000 | 0.000 |

Mobile LCP down 61%, desktop down 71%, and the lazy-LCP audit now passes in
every run on both form factors.

Two honest caveats. **Mobile LCP 3.49 s is still above the 2.5 s "good"
threshold** — much better, not yet passing; the remaining cost is transferring
seven painted photographs on a throttled connection, and a responsive `srcset`
so small viewports fetch smaller encodes is the next lever. And the mobile
spread is still wide (min 3.47 s, max 7.40 s), so the median is the number to
trust, not any single run.

Phase 3 measuring *worse* than the baseline (10.78 s vs 8.93 s) is within that
spread and is not claimed as a regression it caused — what is certain is that it
did not fix mobile, because `lcp-lazy-loaded` was still failing.

- `apps/website/src/frontend/components/ui/card-fan-carousel.tsx`

**Verification:** `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 0 (245) ·
`pnpm build` 0 (both apps) · `importMap.js` 2 lines.

### Owner action surfaced by this work

`ag-agcl-reference-electrode-6-mm` has a spec label typo — **`Body Mateirial`** —
which now appears in that product's public meta description. It is CMS data, not
code, so it is not being patched in the codebase: one-field fix in
Admin → Products.

---

## 2026-08-05 — Phase 3: self-hosted service imagery + HEAD on the REST API

Fixes the P0 and the first P1 from `docs/seo/FINDINGS-ROUND-2.md`.

### 1 · `/services` photography is now self-hosted

The 8 service photos were loaded from `images.unsplash.com` on every page view.
Three problems in one request: the `/services` fan-carousel photo is the **LCP
element**, so a third-party origin had to be DNS-resolved, connected and
TLS-negotiated before its first byte (mobile LCP 8.93 s median); a production
page depended on a CDN nobody here controls; and every visitor's IP reached
Unsplash before any consent decision, on a site that ships a DPDP consent layer.

Same photographs, same ids, same crop — fetched once and re-encoded to webp at
the two widths the design already used (900 w master for the portrait fan card,
750 w for the homepage letterbox). **677 KB for all 16 files.** The Unsplash
License permits download, commercial use and self-hosting with no attribution.

The **LCP element was also `loading="lazy"`** — the browser was deferring the
exact element the metric waits on, the worst possible LCP pattern. The first two
cards (the front card and its visible neighbour) now load eagerly, with
`fetchpriority="high"` and `decoding="sync"` on the front one. The rest are
fanned behind and revealed on click, so they stay lazy.

`images.unsplash.com` is also **removed from the CSP `img-src`** — no page may
now load an image from a third-party origin at all.

- `apps/website/src/frontend/lib/service-images.ts`
- `apps/website/src/frontend/components/ui/card-fan-carousel.tsx`
- `apps/website/next.config.mjs`
- `apps/website/scripts/fetch-service-images.mjs` (new — regenerates the set)
- `apps/website/public/services/` (new — 16 files)

**Verified in a real browser** against a build wired to the live CMS:

| Check | Before | After |
|---|---|---|
| `images.unsplash.com` refs on `/services` | 34 | **0** |
| Unsplash anywhere in the DOM | yes | **false** |
| Self-hosted images that decode | — | **8/8**, correct dimensions |
| Front card | `loading="lazy"` | `eager` + `fetchpriority="high"` |
| Homepage Unsplash refs | 12 | **0** |
| CSP `img-src` | allowed Unsplash | `'self' data: blob:` + CMS/GCS/chatbot |

### 2 · `HEAD` now works across the Payload REST API

Every media file returned **404 to `HEAD`** while returning 200 to `GET`, so
crawlers, link checkers and asset validators saw the whole media library as
missing — including the images in the website's image sitemap.

Root cause: `apps/dashboard/src/app/(payload)/api/[...slug]/route.ts` exported
GET/POST/DELETE/PATCH/PUT/OPTIONS but no HEAD. Next only auto-derives HEAD from
GET when no handler claims the method; this catch-all *does* claim it, hands it
to Payload's REST router, and that router dispatches on the method — with no
HEAD route it fell through to its own 404 JSON.

Now runs the real GET and drops the body, passing the response headers through
untouched, per RFC 9110.

- `apps/dashboard/src/app/(payload)/api/[...slug]/route.ts`

**Verified locally**: HEAD and GET now return an identical status and
content-type with 0 bytes on HEAD, where HEAD previously 404'd against a
succeeding GET. The local Atlas credentials fail (`bad auth`), so both returned
500 rather than 200 — that proves the *dispatch*, which was the defect, but the
media-file 200 itself is confirmed on production below.

**Verification:** `pnpm typecheck` 0 · `next lint` 0 (both apps) · `pnpm test` 0
(227) · `pnpm build` 0 (both apps) · `importMap.js` unchanged, 2 lines.

---

## 2026-08-05 — MERGED TO `main` AND DEPLOYED (`c0b1f25`)

Merged `seo/technical-geo-overhaul` (7 commits) and pushed. Cloud Build →
Cloud Run. **Verified live on production ~200 s after push**, not assumed:

| Check | Result |
|---|---|
| Product `<title>` | `…(3 mm) · METNMAT` — double-brand gone |
| `og:title` | branded (was bare) |
| `og:site_name` | present (was absent) |
| `/blank-4`, `/blank-5` | `301 → /support` (were → `/account/orders`) |
| Homepage `FAQPage` | 5 `Question` nodes — the `active` filter did not empty it |
| `admin.metnmat.com/admin` | `200` |
| CMS products API | `200` |

Pre-merge gate, all with real exit codes: `pnpm typecheck` 0 · `pnpm lint` 0
(both apps) · `pnpm test` 0 (227 passed, 26 files) · `pnpm build` 0 (both apps
compiled). `importMap.js` verified identical to `main` and still 1 import +
1 map entry after the build (gotcha #2).

A note on the build gate: `next build | tail` reports **tail's** exit code, not
the build's. Every build above was checked with an unpiped exit code.

### Round-2 findings — see `docs/seo/FINDINGS-ROUND-2.md`

A 4-way measurement pass (metadata, structured data, IA, CWV) with independent
adversarial verifiers. Two verifiers flagged fabrication and two agents
contradicted each other, so everything below was **re-measured by hand**:

- **P0** `/services` pulls hero imagery from `images.unsplash.com` — 34 refs,
  16 lazy-loaded, mobile LCP 8.93 s median. Performance, third-party
  availability, and a DPDP-relevant third-party request all in one.
- **P1** every CMS image returns `404` to `HEAD` but `200` to `GET`.
- **P1** 62 of 68 `Product` nodes emit no `image`.
- **P1** og:image absent on 101 of 126 indexable URLs.
- **P1** 4 meta descriptions byte-identical across 11 product URLs.

**Corrected an agent:** the claim that 7 URLs share a `<title>` is false —
0 duplicate title groups across all 126 sitemap URLs.

None of these are regressions; all pre-date the deploy. None were changed in
this pass — the `/services` and media-route fixes both need decisions.

---

## 2026-08-05 — Phase 2b: the FAQ `active` flag was decorative

**The CMS checkbox did nothing.** `Faqs.active` is labelled *"Uncheck to hide"*,
but the website query had no filter on it and neither did the component. An
unchecked FAQ still rendered on the homepage **and** was still emitted as
`FAQPage` structured data — so staff had no way to retract a published answer
from Google short of deleting the record. The bug was invisible in the data
(all 5 live FAQs happen to be active); it existed only in the request URL.

Now filters `where[active][not_equals]=false` — deliberately not
`equals=true`, so a document written before the field existed (no `active` key)
still shows rather than silently emptying the section.

`getFaqs()` also takes an optional category and returns `category` on each row,
so a page can emit an `FAQPage` of only its own questions, driven by the
database rather than a hardcoded list.

**Verified against the live CMS**, not assumed:

| query | totalDocs |
|---|---:|
| unfiltered (old) | 5 |
| `active != false` (new) | 5 — no regression today |
| `active == false` | 0 |
| `active != false` + `category=Services` | 0 |

An earlier probe of these same queries reported `PARSE-FAIL`. That was Bash
glob-expanding the unquoted `[` in the URL, not the CMS rejecting anything.

**Deliberately NOT done: `FAQPage` on `/services`.** The plumbing is ready and
`category=Services` returns 0, but Google requires FAQ structured data to match
FAQs *visible on the page*. Emitting schema for unrendered content would breach
that guideline. Needs real Service FAQs **and** sign-off on a visible section.

- `apps/website/src/frontend/lib/cms.ts`
- `test/faq-query.test.ts` (new, 5 tests — 222 → 227)

Regression-proven: removing the filter fails
*"excludes FAQs staff have unchecked"*; restoring it passes.

**Verification:** `tsc --noEmit` clean · `next build` clean · `pnpm test` 227.

---

## 2026-08-05 — Phase 2a: title fix, dead redirect fix, consolidation plan

Decisions taken: **Option B — consolidate `.IN` → `.COM`**; maintenance banner
keeps the notice but drops the `metnmat.in` recommendation (owner action).

**1 · Product SERP titles no longer double-brand.**
`generateMetadata` appended `— {brand}` unconditionally, and the root title
template appends ` · METNMAT` on top, so every own-brand product shipped
`…Working Electrode (3 mm) — METNMAT · METNMAT` — ~10 characters of a
~60-character SERP budget spent repeating one word. The brand suffix is now
appended only for a genuine third-party brand.

Same change exposed a second defect: Next's title template never applies to
`openGraph`/`twitter`, and the PDP — unlike every other route, which brands via
`pageMetadata()` — was shipping a bare OG title. Removing the redundant suffix
would have left shared product links with no company name at all, so OG and
Twitter titles are now branded explicitly and `siteName` added.

- `apps/website/src/app/shop/p/[slug]/page.tsx`

**2 · Two legacy redirects pointed into a robots-disallowed, auth-gated route.**
`/blank-4` ("Order Tracking") and `/blank-5` ("tracking-status") — titles
confirmed from the live legacy pages — redirected to `/account/orders`, which is
`Disallow: /account` in robots.txt *and* 307s to `/login`. Unfollowable by a
crawler, a sign-in wall for a logged-out customer. Both now go to `/support`;
there is no public order-tracking page.

Pinned with a regression test that derives the disallow list from `robots.ts`,
so adding a disallow there fails the test rather than silently creating dead
redirects. Verified by reintroducing the bug: the test fails naming
`/blank-4 -> /account/orders`, and passes when restored.

- `apps/website/legacy-redirects.mjs`
- `test/legacy-redirects.test.ts` (+1 test, 221 → 222)

**3 · Consolidation deliverables.**
- `docs/seo/DOMAIN-CONSOLIDATION.md` — ordered runbook for the Wix side.
- `docs/seo/wix-301-redirects.csv` — 90 import-ready rows. 122 mappings reduce
  to 90 because 30 product slugs contain `φ` and appear both literal and
  percent-encoded; those are one Wix page. Verified 30 collapsed groups,
  0 false merges.

**4 · Withdrew an audit finding.** P1-2 claimed `/shop` and `/shop/all` compete.
Checked before acting: `/shop` is a hub (`<h1>` "METNMAT Store"), `/shop/all` is
the catalogue (`<h1>` "All products"), correctly linked, with filtered views
already `noindex, follow` and pages 2+ self-canonicalising. Acting on my original
suggestion would have de-indexed the only page listing all 68 products.
**No change made.**

**Measured:** 118 of 120 legacy URLs are live `200` on `metnmat.in`, 0 gone.
An earlier 8-concurrent pass reported "91 already gone" — that was Wix
rate-limiting into connect timeouts, not 404s. Corrected by a sequential re-run.

**5 · Internal-linking map + roadmap.** `docs/seo/ROADMAP.md` — prioritised
backlog, 30/60/90, and a sitelink-readiness score of **62/100** scored against
measurable signals. Crawled all 126 indexable sitemap URLs: **0 orphans**, but
`/shop/all` has exactly **1** inbound link and 11 products have 1 (P2-6).

**Verification:** `tsc --noEmit` clean · `next build` clean · `next lint` clean
· `pnpm test` 222 passed.

The title fix was verified end-to-end, not inferred: rebuilt against the live
CMS and rendered locally. `NEXT_PUBLIC_*` is inlined at build time, so the first
attempt — overriding it at `next start` — silently served the 404 page's root
metadata and had to be redone as a rebuild.

| | before (production) | after (local, live CMS) |
|---|---|---|
| `<title>` | `…(3 mm) — METNMAT · METNMAT` | `…(3 mm) · METNMAT` |
| `og:title` | `…(3 mm) — METNMAT` | `…(3 mm) · METNMAT` |
| `og:site_name` | *absent* | `METNMAT INNOVATIONS PRIVATE LIMITED` |
| `twitter:title` | `…(3 mm) — METNMAT` | `…(3 mm) · METNMAT` |
| canonical | correct | unchanged |
| `Product` schema | present | unchanged |

Checked across 4 products. Every catalogue product currently carries brand
`METNMAT`, so the third-party-brand branch is preserved but unexercised today.

---

## 2026-08-05 — Phase 1: audit only, no site changes

**Changed:** nothing that affects the live site. Audit and plan only.

**Added:**
- `docs/seo/AUDIT.md` — Phase 1 audit, root-cause diagnosis, defect register,
  execution plan, out-of-repo action list.
- `SEO_CHANGELOG.md` — this file.

**Key finding:** the premise that this is a technical-SEO failure is wrong.
`metnmat.com` is crawlable, indexable, indexed, self-canonical, with a valid
132-URL sectioned sitemap and extensive structured data. The anomaly is
explained by site age (first commit 2026-06-05; SEO layer 2026-07-31), split
authority across two live domains, and a site-wide maintenance banner that
server-renders *"Better to use metnmat.in"* on every page.

**Blocked on:** the `.IN` ↔ `.COM` decision (AUDIT.md §5). No structural change
until the owner chooses.

**Verification:** no code touched, so no build gate needed. All audit figures
measured against live production — commands in AUDIT.md §9.

**Modified files:** none. Two files added, both documentation.
