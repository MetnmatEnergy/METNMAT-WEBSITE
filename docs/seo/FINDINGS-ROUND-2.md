# SEO findings — round 2 (post-deploy)

Measured 2026-08-05, after the `seo/technical-geo-overhaul` merge deployed
(`c0b1f25`). Produced by a 4-way measurement pass (metadata, structured data,
information architecture, Core Web Vitals), each checked by an independent
adversarial verifier, then **re-verified by hand** for everything below.

Two of the four verifiers flagged fabrication in their measurement agent's
output, and two agents contradicted each other outright. So every claim in §1
was re-measured directly before being written down. §3 lists what was *not*
confirmed and is therefore not being acted on.

---

## 1. Confirmed — I re-measured each of these myself

> **Status 2026-08-05 — P0, P1 (HEAD) and P1 (duplicate descriptions) are FIXED
> and verified on production.** `/services` mobile LCP 8.93 s → **3.49 s**,
> desktop 2.84 s → **0.82 s**, `lcp-lazy-loaded` passing in every run. Media
> `HEAD` 404 → **200**, all 20 image-sitemap entries now HEAD-able. Duplicate
> product descriptions 4 groups / 11 URLs → **0**, and over-length 63 → **0**.
> Still open: 62 products with no image (photography), and mobile LCP is
> improved but not yet under the 2.5 s threshold. See `SEO_CHANGELOG.md`.

### P0 · `/services` loads its hero imagery from Unsplash

`/services` references `images.unsplash.com` **34 times**, with **16
`loading="lazy"` images**. The source is
[`apps/website/src/frontend/lib/service-images.ts`](../../apps/website/src/frontend/lib/service-images.ts).

Lighthouse (36 runs, 6 URLs × 2 form factors × 3 runs) puts `/services` mobile
LCP at a **8.93 s median** and desktop at **2.84 s**, against a 2.5 s threshold —
the LCP element being a lazy-loaded, externally hosted image. The LCP figure is
the workflow's; the Unsplash dependency and lazy-loading are mine, confirmed
from the live HTML and the repo.

Three separate problems in one:

1. **Performance.** A lazy-loaded LCP image is the single worst LCP pattern —
   the browser defers the very element it is waiting on.
2. **Availability.** A production page depends on a third-party CDN nobody here
   controls.
3. **Privacy.** Every visitor's IP goes to `images.unsplash.com` on page load.
   This site just shipped a DPDP consent layer; a third-party request that fires
   before any consent decision is worth a deliberate look, not an accident.

There is also a positioning question that is **yours, not mine**: these are
stock photographs illustrating METNMAT's own R&D services. That may be entirely
intentional. Flagging it because "no fabricated content" is a standing rule on
this project and stock imagery sits near that line.

### P1 · Every CMS-hosted image 404s to a HEAD request

| Method | Status | Content-Type |
|---|---|---|
| `HEAD` | **404** | `application/json` |
| `GET` | **200** | `image/webp` (11,356 b) |

Reproduced on multiple images, including one listed in
`/sitemaps/images.xml`. Crawlers, link checkers and asset validators routinely
use HEAD to test availability — to all of them, every image on the site is
missing. This is in the Payload media route (`/api/media/file/<filename>`), so
it is a `apps/dashboard` fix and it touches production media serving. **Not
changed here** — media delivery is too load-bearing to alter as a drive-by.

### P1 · 62 of 68 `Product` nodes emit no `image`

Measured across all 68 product URLs: **6 with a schema image, 62 without.**
Same root cause as the known photography gap, now quantified in the structured
data. Product rich results are effectively unavailable without it.

### P1 · og:image absent on 101 of 126 indexable URLs

| Section | Missing |
|---|---:|
| Products | 62 |
| Categories | 26 |
| Static pages | 12 |
| Blog | 1 |
| Projects | 0 |
| **Total** | **101 / 126** |

Only 25 URLs have an og:image. Every share of those 101 URLs renders without a
card image.

### P1 · 4 meta descriptions are byte-identical across 11 product URLs

| Shared description | URLs |
|---|---:|
| "The Ag/AgCl Reference Electrode is the industry-stan…" | 3 |
| "The Detachable Gold Disk Electrode (Straight Type) i…" | 3 |
| "The Hg/HgO Reference Electrode is specifically engin…" | 3 |
| "The Platinum Wire Counter Electrode is a high-purity…" | 2 |

These are genuinely different SKUs — different diameters, lengths and body
materials — sharing one description. It is the same failure mode the legacy
redirect map was carefully built to avoid: treating a product family as one
product.

---

## 2. Corrected — an agent got this wrong

**"Seven URLs share one `<title>`."** False. I re-fetched all 126 sitemap URLs
and grouped the actual title strings: **0 duplicate title groups.** The agent
that reported this had also been flagged by its verifier on several other
claims; it appears to have measured URLs outside the sitemap, including
robots-disallowed utility routes that do share a fallback title. Those are not
indexable and do not matter.

The duplicate-**description** finding in §1 is real and came from the other
agent, which its verifier confirmed.

---

## 3. Reported but NOT confirmed — not acted on

Recorded so they are not silently dropped, and so nobody treats them as fact:

- Per-run Lighthouse LCP breakdowns and the claim that the Unsplash photo id
  differs between runs. The verifier could not substantiate the individual run
  figures, though it did confirm all 36 Lighthouse JSONs are real and that the
  aggregate values reproduce.
- `CLS 0.000 on all 12 page/form-factor combinations` — flagged unsupported.
- Various category-overlap similarity scores (`0.667`, `0.345`) and per-page
  word counts from the IA pass — flagged unsupported, and that agent is the one
  that got the title-duplication claim wrong.
- "19 pages reference an `Organization` `@id` without emitting the node" — not
  re-measured.

---

## 4. Suggested order

1. **`/services` Unsplash images** (P0) — biggest single CWV number on the site,
   plus the availability and privacy angles. Needs your call on whether to
   self-host the current images or replace them with real METNMAT photography.
2. **HEAD 404 on media** (P1) — small, self-contained, but touches production
   media serving so it wants its own change and its own verification.
3. **Duplicate product descriptions** (P1) — 11 URLs, CMS content edit.
4. **og:image + `Product.image`** (P1) — both resolve with the photography
   already on your list; one asset fixes both.

Nothing here is a regression from the deploy. All five confirmed findings
pre-date it.
