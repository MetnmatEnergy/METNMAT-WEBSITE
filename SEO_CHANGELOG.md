# SEO Changelog

Every SEO-affecting change, newest first. Branch: `seo/technical-geo-overhaul`.

Format: what changed · why · files · verification.

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
