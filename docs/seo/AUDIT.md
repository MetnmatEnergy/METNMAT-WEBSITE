# METNMAT — Technical + Generative SEO Audit (Phase 1)

Branch `seo/technical-geo-overhaul` · audited 2026-08-05 against live production
(`https://www.metnmat.com`) and the repo at `c938551`.

Every number below was measured, not estimated. The commands are in
[§9 How this was measured](#9-how-this-was-measured) so you can re-run them.

---

## 1. Verdict up front

**The brief's premise needs correcting.** It frames the anomaly — strong backlink
profile, zero organic keywords — as a technical failure to be fixed in code. It
is not. The technical SEO on `metnmat.com` is, with a handful of exceptions
listed in §4, already correct.

The real explanation is three things stacked, in order of weight:

| # | Cause | Weight | Fixable in repo? |
|---|---|---|---|
| 1 | **The site is 2 months old. Its SEO layer is 5 days old.** | dominant | **No** — this is time |
| 2 | **Authority is split across two live domains**, and `.in` holds all the history | large | Partly — needs your decision (§5) |
| 3 | **Every `.com` page tells Google the site is under maintenance and to use `metnmat.in`** | real, self-inflicted | **Yes — one CMS toggle** |

Ranking a new domain takes months. "0 organic keywords" on a site whose sitemap
has existed for five days is the expected reading, not a defect. Nothing in the
code can shortcut that. What the code *can* do is make sure that when the
crawl-and-rank cycle does run, nothing is working against it — and right now
cause 3 actively is.

### Against the three hypotheses in §1 of the brief

**(a) Indexation failure — REFUTED.** Measured on live production:

| Check | Result |
|---|---|
| `https://www.metnmat.com/` | `200 OK` |
| Canonical | `https://www.metnmat.com` — self-referential, correct |
| Robots meta | `index, follow` |
| `robots.txt` | `Allow: /`, sensible disallows, sitemap declared |
| Sitemap | index + 6 sections, **132 URLs**, all `200` |
| Google index | `site:metnmat.com` returns the homepage **and** `/terms` |

The site is crawlable, indexable, and indexed. It is not blocked.

**(b) Duplicate/competing content — PARTLY TRUE, but not as duplication.** The
two domains are not near-duplicates. They target different things:

- `.com` — *"METNMAT — Electrochemical Systems | Reference Electrodes"*
- `.in` — *"Home | Metnmat Research and Innovations | Metallography | Metallurgy | Jalan Industrial"*

So Google is not deduplicating them. The problem is **dilution**, not duplication:
two separate live properties for one company, and the older one carries the
history. `https://www.metnmat.in/` returns `200` with
`<link rel="canonical" href="https://www.metnmat.in"/>` and a permissive
`robots.txt` — a fully independent, self-canonical Wix site with **no signal of
any kind pointing to `.com`**. `metnmat.in` → `www.metnmat.in` is a `301`; there
is no `.in` → `.com` redirect anywhere.

**(c) Technical/rendering blockers — REFUTED.** Content is server-rendered.
Titles, descriptions, canonicals, and exactly one `<h1>` are present on every
page checked. Structured data is extensive (§3).

### The one thing genuinely working against you

Every page on `metnmat.com` server-renders this, above the `<h1>`:

> "We are currently performing scheduled maintenance. Features may be
> temporarily unavailable. **Better to use metnmat.in**"

Confirmed present on `/`, `/shop`, `/about`, `/contact` — i.e. site-wide, in the
initial HTML, so every crawler and every LLM extractor reads it before any real
content.

For a generative-search surface this is close to worst-case: the first
assertion on every page is that the site is degraded and that the *other* domain
is preferable. It is a plausible contributor to the AI-visibility figures in
your brief, and it is certainly working against the `.com` consolidation you're
trying to achieve.

Two clarifications, so this is on the record fairly:

- Earlier in this project I measured this banner's cost and reported it as
  "~1 Lighthouse point." That was a **performance** measurement and it was
  correct. Its SEO and generative-search cost is a different question, which I
  had not measured until now. The performance verdict does not license leaving
  it up.
- You previously said to keep it until the `.com` site is finished. That is a
  legitimate call and I'm not overriding it. But the live wording — *"Better to
  use metnmat.in"* — is stronger than the CMS default
  (*"Some features may be temporarily unavailable."*), so it was edited in the
  admin at some point. Softening the wording is a one-field CMS edit that costs
  nothing and removes the cross-domain recommendation while keeping the notice.

---

## 2. Repo SEO surface

| Concern | Where | State |
|---|---|---|
| Per-page metadata | `frontend/lib/seo.ts` → `pageMetadata()` | Correct — self-canonical + matching OG |
| Root title template | `app/layout.tsx:38` — `s.seo.titleTemplate \|\| "%s · {site.name}"` | CMS-driven |
| Structured data | `frontend/components/seo/schema.ts` (11 builders) | Extensive, no fabrication |
| Breadcrumbs | `frontend/components/seo/page-breadcrumbs.tsx` | Emitting on all section pages |
| Sitemap index | `app/sitemap.xml/route.ts` | 6 sections, `revalidate = 3600` |
| Sitemap sections | `app/sitemaps/[section]/route.ts` + `frontend/lib/sitemap.ts` | pages/products/categories/blog/projects/images |
| robots.txt | `app/robots.ts` | Correct disallows, sitemap declared |
| Generative/LLM | `app/llms.txt` | 2,244 bytes, real facts only |
| Legacy `.in` URLs | `legacy-redirects.mjs` (**123 entries**) | Wired via `next.config.mjs:103` |

**Live sitemap coverage — 132 URLs:**

| Section | URLs |
|---|---|
| pages | 14 |
| products | 68 |
| categories | 26 |
| blog | 3 |
| projects | 15 |
| images | 6 |

The `legacy-redirects.mjs` work is genuinely good and worth calling out: 123
mappings derived from *product specification data* (chemistry, body material,
form factor, dimensions) rather than slug similarity, with each mapping's
confidence recorded. That is the right way to do it.

---

## 3. Structured data — measured live

| Route | Types emitted |
|---|---|
| `/` | `Organization`+`LocalBusiness` (array), `WebSite`, `SearchAction`, `FAQPage`, `Question`, `Answer`, `Place`, `PostalAddress`, `GeoCoordinates`, `ContactPoint`, `OpeningHoursSpecification` |
| `/shop` | `BreadcrumbList`, `ItemList`, `ListItem` |
| `/shop/p/[slug]` | `Product` — `sku`, `mpn`, `brand`, `category`, `description`, `additionalProperty`, `isRelatedTo`, `Offer` (`price`, `priceCurrency`, `availability`), `image` |
| `/services` | `Service`, `ItemList`, `BreadcrumbList`, + org block |
| `/projects` | `CollectionPage`, `CreativeWork`, `BreadcrumbList` |
| `/blog` | `Blog`, `BlogPosting`, `ImageObject`, `Organization`, `BreadcrumbList` |
| `/contact` | `ContactPage`, `ContactPoint`, `Place`, `PostalAddress` |
| `/about` | `Organization`+`LocalBusiness`, `Place`, `OpeningHoursSpecification` |

**No `aggregateRating` and no `review` anywhere** — correct. You have no real
review data, so emitting it would be fabrication. Leaving it out costs star
ratings in SERPs; inventing it risks a manual action. Current behaviour is right
and I am not changing it.

---

## 4. Defects found

Small list, because the foundation is sound.

### P0 — do first

**P0-1 · The maintenance banner recommends the competing domain.**
Site-wide, server-rendered, above the `<h1>`. Not a code change — the text lives
in the `maintenance` global (`apps/dashboard/src/globals/index.ts:238`) and the
live copy was edited in the admin. **Owner action, Admin → Maintenance.**
Either switch it off, or drop the last sentence so it reads
*"…Some features may be temporarily unavailable."*

**P0-2 · No cross-domain signal between `.in` and `.com`.**
Two independent self-canonical properties. Requires your decision — see §5.
I will not touch this without an explicit choice, because both options are
irreversible in practice and one of them retires a live site.

### P1 — repo work, safe

**P1-1 · Product titles double-brand.**
Live: `L-Shaped Glassy Carbon Disk Working Electrode (3 mm) — METNMAT · METNMAT`.
The PDP builds a title that already ends in `— METNMAT`, then the root template
appends ` · METNMAT` again. Wastes ~10 characters of SERP title and reads as an
error. Fix: strip the suffix at the source so the template does the branding.

**P1-2 · `/shop` and `/shop/all` compete.**
Both `index, follow`, both self-canonical, both list products, both target
catalogue intent. Two URLs competing for one query. Recommend: keep `/shop` as
the indexable landing page and make `/shop/all` the paginated deep list
(canonical to itself is fine, but the two need distinct, non-overlapping
targeting — or `/shop/all` should canonical to `/shop`).

**P1-3 · 62 of 68 products have no image.**
`Product.image` is present in schema, but pointing at a placeholder for the
large majority. Google Merchant / product rich results substantially discount
imageless products. **Not a code fix — needs photography.** Already on your
owner list; restating because it directly gates product rich results.

### P2 — worth doing, lower leverage

- **P2-1** No `xhtml:link` hreflang in any sitemap (`0` occurrences). Only
  relevant if you choose Option A in §5.
- **P2-2** `pages.xml` omits `/quote`, `/support` are present but several
  legitimate landing pages could be added as the content grows.
- **P2-3** No `Article`-level `speakable` or FAQ blocks on `/services` and
  `/projects` — both are strong generative-answer candidates and currently
  offer LLMs less extractable structure than `/` does.

---

## 5. The `.IN` ↔ `.COM` decision — I need your call

This is the highest-leverage item and the brief says to ask before acting.
Current state: `metnmat.in` is live, 2018-era Wix, fully indexable,
self-canonical, no redirects to `.com`. `metnmat.com` is 2 months old and holds
the real product catalogue, commerce, CMS and content.

**Option A — Coexist.** Keep both. Add reciprocal cross-domain signals so Google
understands they're one entity. Lower risk, keeps the `.in` site's traffic, but
permanently splits authority and you will keep competing with yourself.

**Option B — Consolidate `.IN` → `.COM`.** 301 every `.in` URL to its `.com`
equivalent. **The 123-entry mapping in `legacy-redirects.mjs` already exists and
was built for exactly this.** This is the option that actually solves the
dilution: it transfers the `.in` link equity to `.com` and ends the competition.
Cost: the `.in` site stops existing as a destination, and the redirects must be
configured **in Wix**, outside this repo.

**My recommendation is Option B**, because your stated goal is to make `.com`
the primary property, the mapping work is already done, and Option A locks in
the split permanently. But B retires a live site, so it is your call, not mine.

---

## 6. What I will NOT do

Per the brief's no-fabrication rule, and stated so it's explicit:

- No invented reviews, ratings, awards, certifications or client logos.
- No `aggregateRating`/`review` schema without real review data.
- No fabricated statistics, benchmarks or case-study numbers.
- No URL renames without a 301 — and none proposed in this plan.
- No changes to secrets, env var names, payment, order, enquiry, analytics,
  cron or deploy paths.

---

## 7. Proposed execution plan (Phase 2)

Pending your §5 decision. Every step gated by
`next build` + `tsc --noEmit` + `next lint` + `pnpm test`, in small commits.

| Step | Work | Risk |
|---|---|---|
| 1 | P1-1 product title double-branding | trivial |
| 2 | P1-2 `/shop` vs `/shop/all` targeting + canonical | low |
| 3 | P2-3 FAQ/structured blocks on `/services`, `/projects` (real content only) | low |
| 4 | Internal-linking map + fix orphans | low |
| 5 | Metadata + structured-data reports, IA diagram, keyword→URL map | none (docs) |
| 6 | **Option A only:** reciprocal hreflang + `xhtml:link` in sitemaps | medium |
| 7 | **Option B only:** verify the 123 mappings against live `.in`, hand you the Wix redirect list | medium |

---

## 8. Out-of-repo action list (you, not me)

Ordered by leverage.

1. **Edit or disable the maintenance banner** — Admin → Maintenance. Removes the
   *"Better to use metnmat.in"* recommendation. *(minutes, highest leverage)*
2. **Decide `.IN` ↔ `.COM`** (§5) — unblocks the largest structural fix.
3. **Google Search Console + Bing Webmaster** — verify `www.metnmat.com`, submit
   `https://www.metnmat.com/sitemap.xml`. Without GSC you are blind to actual
   index coverage; everything above is inferred from the outside.
4. **If Option B:** configure the 301s in Wix for `metnmat.in`.
5. **Product photography** — 62 of 68 products (P1-3).
6. **Verify where the backlinks actually point** — `.in` or `.com`. This changes
   the value of Option B substantially and I cannot check it without SEMrush/Ahrefs.
7. **Entity records** — Wikidata, Crunchbase, LinkedIn company page consistency.
8. **Give it time.** The site is 2 months old. Expect the first meaningful
   organic keyword movement 3–6 months after GSC verification and banner removal.

---

## 9. How this was measured

```bash
# indexability
curl -sI https://www.metnmat.com/
curl -s  https://www.metnmat.com/ | grep -oE '<link rel="canonical"[^>]*>'
curl -s  https://www.metnmat.com/robots.txt

# sitemap coverage
for s in pages products categories blog projects images; do
  echo "$s $(curl -s https://www.metnmat.com/sitemaps/$s.xml | grep -oE '<loc>' | wc -l)"
done

# structured data per route
curl -s https://www.metnmat.com/shop | grep -oE '"@type":"[A-Za-z]+"' | sort -u

# the banner
curl -s https://www.metnmat.com/ | grep -oE '[^<>]*metnmat\.in[^<>]*'

# site age
git log --reverse --format="%ad" --date=short | head -1
git log --diff-filter=A --format=%ad --date=short -- apps/website/src/frontend/lib/sitemap.ts | tail -1
```

One correction to an earlier measurement in this document's own process:
`grep -c '<loc>'` counts *lines*, and the sitemap XML is emitted on a single
line, so it reported `1` for every section. The counts in §2 use
`grep -oE '<loc>' | wc -l`.
