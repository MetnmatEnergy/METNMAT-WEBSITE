# METNMAT SEO — Backlog and 30/60/90 Roadmap

Companion to [`AUDIT.md`](./AUDIT.md). Ordered by leverage, not by effort.

The framing that matters: **`metnmat.com` is two months old and its SEO layer is
five days old.** Nothing below is a fix for that; time is. What these items do is
remove the handicaps so the clock actually counts.

---

## 1. Prioritised backlog

Status as of 2026-08-05.

| ID | Item | Owner | Effort | Impact | Status |
|---|---|---|---|---|---|
| **P0-1** | Maintenance banner recommends `metnmat.in` on every page | You (CMS) | minutes | **High** | Open |
| **P0-2** | Consolidate `.in` → `.com` (Option B chosen) | You (Wix) | ~1h | **High** | Runbook ready |
| **P0-3** | Verify in GSC + Bing, submit sitemap | You | ~30m | **High** | Open |
| P1-1 | Product titles double-brand | Me | — | Medium | ✅ Fixed |
| P1-2 | ~~`/shop` vs `/shop/all` compete~~ | — | — | — | ⛔ Withdrawn, not a defect |
| P1-3 | 62 of 68 products have no image | You (photography) | large | Medium | Open |
| P2-3 | FAQ schema not category-aware; `/services`, `/projects` have none | Me + you (content) | small + content | Medium | Open |
| P2-4 | `/shop` `<h1>` is "METNMAT Store" — no keyword | You (approve copy) | minutes | Low-Med | Awaiting decision |
| P2-5 | Two legacy redirects landed on a robots-disallowed route | Me | — | Low | ✅ Fixed |
| P2-6 | `/shop/all` has 1 inbound link; 11 products have 1 | Me (needs your OK on footer copy) | small | Medium | Open |

---

## 2. 30 / 60 / 90

### Days 0–30 — stop losing, start measuring

Everything here is either yours or already done. None of it is speculative.

1. **Edit the maintenance banner** (Admin → Maintenance). Drop
   *"Better to use metnmat.in"*. This is the single cheapest item on the list and
   it is currently on every page above the `<h1>`.
2. **Verify `www.metnmat.com` in Google Search Console and Bing Webmaster
   Tools. Submit `https://www.metnmat.com/sitemap.xml`.** Until this exists you
   are inferring index coverage from the outside, as this audit had to.
3. **Verify `metnmat.in` in GSC too**, then run **Change of Address**. This only
   works while `.in` is still verifiable — do it *before* the redirects go up.
4. **Apply the 90 Wix redirects + 2 wildcards**, per
   [`DOMAIN-CONSOLIDATION.md`](./DOMAIN-CONSOLIDATION.md). Homepage rule last.
5. **Run a backlink report per domain** so you know whether the referring
   domains point at `.in` or `.com`. This determines what consolidation is worth
   and I cannot see it without SEMrush/Ahrefs.

**What "working" looks like at day 30:** GSC showing indexed-page counts and
first impressions. Not rankings — impressions. Rankings at 30 days on a 3-month
old domain would be unusual.

### Days 31–60 — give crawlers and LLMs more to work with

6. **Product photography** (P1-3). 62 imageless products is the largest single
   gap in the commerce surface. Product rich results substantially discount
   imageless items, and this is the one item on the list with no workaround.
7. **Service and project FAQs** in the CMS. The `Faqs` collection already has a
   `category` field; once real service FAQs exist I can make the FAQ schema
   category-aware so `/services` emits its own `FAQPage`. I will not write these
   — invented FAQs are fabrication, and the 5 live ones are company/product
   scoped.
8. **Decide on the `/shop` `<h1>`** (P2-4) and on a footer link to `/shop/all`
   (P2-6). A crawl of all 126 indexable URLs found **0 orphans** — good — but
   the full catalogue has exactly one inbound link and 11 products have one.
   Both are small changes to visible copy, so they need your sign-off.
9. **Blog cadence.** 3 articles is thin for a technical-authority play. This is
   the highest-leverage *content* lever available and it compounds; nothing in
   the technical layer substitutes for it.

### Days 61–90 — entity and authority

10. **Entity records** — Wikidata, Crunchbase, and LinkedIn consistency. The
    `Organization` node already carries `sameAs` for LinkedIn, YouTube, Facebook
    and the Amazon storefront, a stable `@id`, `logo` and `foundingDate 2018`.
    External records reinforce what the markup already asserts.
11. **Re-audit.** Re-run this document's measurements and compare. Specifically:
    index coverage in GSC, impressions trend, and whether `.in` URLs have started
    dropping out in favour of `.com`.
12. **Then, and only then, judge the SEO work.** 90 days is roughly the earliest
    point at which the numbers mean anything for a domain this new.

---

## 3. Sitelink readiness — 62 / 100

Sitelinks are the sub-links Google shows beneath a brand result. They are
awarded algorithmically, not requested. Scored against the inputs Google
documents plus the structural signals that correlate with them.

| Signal | Weight | Score | Basis |
|---|---:|---:|---|
| Unique, descriptive page titles | 10 | **10** | Verified unique across all page types |
| One `<h1>` per page | 5 | **5** | Verified on 8 routes |
| Clear top-level navigation | 10 | **10** | 6 clean sections: shop, services, projects, blog, about, contact |
| `BreadcrumbList` structured data | 10 | **10** | Emitting on every section page |
| Valid, complete sitemap | 10 | **10** | Index + 6 sections, 132 URLs, all resolve |
| `Organization` entity markup | 10 | **9** | `@id`, `logo`, `foundingDate`, 4 real `sameAs`; no Wikidata/Crunchbase |
| Sitemap submitted to GSC | 10 | **0** | No GSC property yet |
| Single canonical domain | 15 | **0** | Two live self-canonical domains |
| No site-wide degradation notice | 5 | **0** | Maintenance banner on every page |
| Brand query volume | 15 | **~3** | Constrained by domain age; not directly measurable without GSC |
| Content depth | 10 | **5** | 68 products, 15 projects, 3 blog articles |
| **Total** | **100** | **62** | |

**The three zeros are the whole story**, and all three are in the day-0–30 list:
GSC verification, domain consolidation, and the banner. Clearing them takes the
structural score to ~92; the remainder is brand volume and content depth, which
are earned over months.

Sitelinks realistically appear once brand queries have volume *and* the domain
is unambiguous. Consolidation is the prerequisite — Google will not confidently
generate sitelinks for a brand that resolves to two competing properties.

---

## 4. What I did not do, and why

- **No invented reviews, ratings, awards or client logos.** No
  `aggregateRating`/`review` schema — there is no real review data, and
  fabricating it risks a manual action for a cosmetic gain.
- **No URL renames.** None were warranted, so no 301s were needed beyond the
  legacy map.
- **No `/shop/all` canonical change.** I proposed it, then checked and withdrew
  it — see AUDIT.md §4 P1-2.
- **No FAQ content written.** Plumbing yes, content no.
- **No changes** to secrets, env var names, payment, order, enquiry, analytics,
  cron or deploy paths.
