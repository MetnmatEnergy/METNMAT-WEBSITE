# SEO Changelog

Every SEO-affecting change, newest first. Branch: `seo/technical-geo-overhaul`.

Format: what changed · why · files · verification.

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
