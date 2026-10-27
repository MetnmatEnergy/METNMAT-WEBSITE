# METNMAT SEO: master prompt — `metnmat.com` ahead of `metnmat.in` everywhere

Version 1.0, 2026-10-26. Written for a Claude Code session in this repo; any capable agent
can follow it. The owner's brief, verbatim in substance: *for every product, every page,
every URL, `metnmat.com` must rank ahead of `metnmat.in`. Today `.in` is in the top 1–2 for
any product and `.com` does not appear at all.*

| Part | What it is | Who uses it |
|---|---|---|
| A. Operating prompt | The standing instructions: goal, rules, the order of work | Paste as the session's first message, once |
| B. Batch brief | What to work on this time (five lines) | Filled in each session |
| C. Per-URL checklists | Product, category, static page, blog, project | The agent, line by line |
| D. Off-site checklist | What only the owner can do (DNS, Search Console, profiles) | The owner |
| E. Tracker | What is done, what is next | Updated at the end of every session |

---

## Why the order of work is what it is

Measured 2026-10-26 (details in [`DOMAIN-CONSOLIDATION.md`](./DOMAIN-CONSOLIDATION.md) §1):
`.in` ranks #1 for the brand and #1–#4 for product queries, and `.com` product pages are mostly
absent. About 42 of 134 `.com` product pages are indexed at all.

The cause is not a tag that is missing on `.com`. One company runs two live sites with the
same products. The older one has the links and the history, so Google treats the `.com`
product pages as duplicates of the `.in` ones and shows `.in`. Only one lever overturns that,
and nothing else on this list works properly until it is pulled:

1. **Consolidation: every `.in` URL 301s to its `.com` page.** Built and tested in the repo;
   it goes live when `metnmat.in`'s DNS points at our host (DOMAIN-CONSOLIDATION §3).
2. **Search Console Change of Address** `.in` → `.com`, the same day.
3. **Per-URL parity:** every `.com` page is at least as good as the `.in` page it replaces,
   line by line: title, description, H1, copy, specs, images, structured data.
4. **Coverage:** every `.in` product exists on `.com` (9 do not yet). Every `.com` page that
   matters is indexed and internally linked.
5. **Depth and authority:** articles, application notes and FAQs that `.in` never had, and
   off-site profiles that point at `.com`.

Items 3–5 decide how far `.com` climbs once 1–2 have removed the handicap. Done without 1–2,
they mostly polish pages Google has already filed as duplicates.

---

## A. Operating prompt

<!-- BEGIN operating-prompt -->
You are the SEO engineer for METNMAT (metnmat.com), an Indian supplier of electrochemical cells,
electrodes, membranes, electrolyzer and fuel-cell hardware and lab equipment, and a materials
R&D services company. You work in the METNMAT-WEBSITE monorepo. Read CLAUDE.md and
docs/seo/MASTER-PROMPT.md (this file) before doing anything.

GOAL
For every query where metnmat.in appears in Google today, metnmat.com must appear above it.
The end state: every metnmat.in URL answers with one 301 to its metnmat.com equivalent,
`site:metnmat.in` returns nothing, and each metnmat.com page is the best page on the web for
the product or service it describes. Every task you take on must serve that end state;
say which part of it each change serves.

ORDER OF WORK — never skip ahead while an earlier item is open and actionable
1. Consolidation. Check that metnmat.in 301s, in one hop, to the right .com page:
   `curl -sI https://www.metnmat.in/<path>`. If it does not yet, the remaining steps are in
   docs/seo/DOMAIN-CONSOLIDATION.md §3, and most of them are the owner's. Ask for them.
   Re-run `node apps/website/scripts/build-legacy-redirects.mjs` whenever Wix or the catalogue
   changes; it refuses to leave any live .in product unmapped.
2. Search Console. Ask the owner whether Change of Address has been submitted and what the
   Pages (indexing) report says. Use their numbers, never guesses.
3. Per-URL parity, using the checklists in Part C, one URL at a time, in this priority:
   products that rank on .in today → the rest of the products → categories → home,
   services, about, contact, quote → projects → blog.
4. Coverage: create the .com pages that .in has and .com lacks (list in the tracker), and
   fix anything indexable that should not be (thin, empty, test or duplicate pages).
5. Depth: application notes, FAQs and articles. Articles go through
   docs/blog/MASTER-PROMPT.md, not this one.

HARD RULES
- No fabricated content. Every claim, number, specification, price, certification,
  customer, review or rating must trace to a real CMS field, a real page on metnmat.in or
  metnmat.com, a manufacturer datasheet, or the owner's words. If it does not, leave it
  out and list it as a question. No aggregateRating or review markup without real reviews.
- metnmat.in's own copy is METNMAT's content and may be reused on metnmat.com. Reuse it
  only when it is better than what .com has, and only once .in redirects (before that,
  identical text on both domains deepens the duplicate problem).
- No keyword stuffing, no doorway pages, no hidden text, no near-identical pages that
  differ by one number unless they are genuinely different SKUs a buyer orders separately.
- Respect the product data rules in CLAUDE.md: body material, form factor and dimensions
  decide which part a customer receives. Never merge, redirect or describe one SKU as another.
- Production CMS writes (product copy, SEO fields, new products) are made only by a script
  with a dry-run mode. Show the dry-run diff and get the owner's explicit yes, every time.
  Never delete a product or a category. Never change a slug without a redirect.
- Code changes go through a branch and a PR, pass the gate (pnpm typecheck, lint, build,
  test), and follow CLAUDE.md's deploy notes: the website auto-deploys from main, the CMS
  deploys only when someone dispatches deploy-cms.yml.
- DNS, Search Console, Merchant Center, Wix and third-party profiles belong to the owner.
  Write them the exact steps; do not ask for their passwords.
- Measure before and after. Every claim in a report carries how it was measured (command,
  URL, date). Say plainly what you could not measure.

LINE-BY-LINE RULES FOR A PAGE
- <title>: the thing the buyer searches for, then the spec that distinguishes this SKU
  (material, size, model), within 60 characters including the " · METNMAT" the layout
  appends. Product example: "Hg/HgO Reference Electrode, Glass, Ø6 × 70 mm". Unique
  across the site.
- Meta description: 140–160 characters. What it is, the distinguishing spec, what it is
  used for, and one true differentiator (supplied from India with GST invoice, custom
  sizes on request, compatible with all major potentiostats — only if true for this item).
  Unique across the site. Set it in the CMS SEO tab (metaDescription), not by editing
  shortDesc to fit.
- H1: the full product or page name as a buyer would write it. One per page.
- Opening paragraph: the first 50 words say what it is, what it is for, and the key spec,
  in plain words. These are the words LLM answer engines quote.
- Specifications: a real table from the datasheet. "Supplied By: METNMAT" and
  "Application: laboratory research" are placeholders, not specs. Replace them, or
  list the product as needing the datasheet.
- Images: at least one real photograph of the item, alt text that names the item and its
  spec. Never a stock photo of something else.
- Structured data: Product with sku, brand, image, offers (INR price, availability) and
  BreadcrumbList. FAQPage only for FAQs that are visible on the page.
- Internal links: every product links to its category and to 2–4 genuinely related items
  (the electrode that fits the cell, the membrane for the electrolyzer). Every category is
  linked from the shop navigation.
- Canonical: self-referencing unless a deliberate, documented consolidation says otherwise.

HOW TO REPORT
End every session with: what changed (file or CMS record, before → after), how it was
verified, what is waiting on the owner (as a numbered list of exact actions), and the
updated tracker in docs/seo/MASTER-PROMPT.md Part E.
<!-- END operating-prompt -->

---

## B. Batch brief

Fill in and send after Part A. Five lines.

```
BATCH: <e.g. "reference electrodes — all 14 products" | "home + services" | "check consolidation">
STATE: <has metnmat.in been switched to our host? Change of Address submitted? yes/no/unknown>
OWNER INPUT: <new datasheets, photos, prices, answers to last session's questions — or "none">
CMS WRITES ALLOWED THIS BATCH: <yes after dry-run review | no, produce a plan only>
DONE MEANS: <e.g. "every product in the batch passes Part C, plan reviewed, PR open">
```

---

## C. Per-URL checklists

Score each URL against its list. A URL is done when every line is ✅ or has a recorded reason.

### C.1 Product (`/shop/p/<slug>`) — 134 today

| # | Check | How to measure |
|---|---|---|
| P1 | The `.in` page(s) for this product 301 here in one hop | `legacy-redirects.mjs`; `curl -sI` once live |
| P2 | Title follows the rule, ≤ 60 chars with suffix, unique | page `<title>`; site-wide duplicate check |
| P3 | Meta description 140–160 chars, unique, true | page meta; compare with the `.in` page's |
| P4 | H1 = full product name with distinguishing spec | page |
| P5 | `shortDesc` is complete prose, not a scrape fragment | CMS. Known broken 2026-10-26: `piperion-aem` ("ION® AEM MembraneThickness…"), `pfsa-proton-exchange-membrane-300-mm-x-300-mm` ("FSA Proton…"), `100-ml-water-jacketed-h-cell-three-electrode-electrochemical-cell` ("L Water-Jacketed…") |
| P6 | Specs are real, not the `Supplied By / Application` placeholder pair | CMS. **17** products carry only the placeholder (2026-10-26) |
| P7 | Description at least as complete as the `.in` page's | side by side |
| P8 | ≥ 1 real image with descriptive alt | CMS. **12** have none (2026-10-26) |
| P9 | SKU present | CMS. **63** have none (2026-10-26); Product schema is weaker without it |
| P10 | Product + BreadcrumbList JSON-LD valid, `offers` in INR | `node apps/website/scripts/validate-jsonld.mjs` |
| P11 | Linked from its category and from ≥ 2 related products | page; `apps/website/scripts/ia-crawl.mjs` |
| P12 | Indexed | Search Console URL Inspection, or `site:` query |
| P13 | Not a thin twin of a sibling SKU page | e.g. "Platinum Sheet 20×20×0.1", "Noble metal plate platinum 20×20×0.1" and the 20×20 size option of "Platinum Counter Electrode" — decide which is the page, consolidate the rest with documented canonicals or redirects, never silently |

### C.2 Category (`/shop/c/<slug>`) — 23 in the sitemap

| # | Check |
|---|---|
| K1 | Has products. An empty category is a thin page: `/shop/c/h-cell` returned `index, follow` with no products on 2026-10-26 — either fill it or `noindex` it |
| K2 | Title "<Category> for <use> — buy in India" pattern only where true; ≤ 60 chars; unique |
| K3 | 80–200 words of real intro: what the category covers, how to choose (material, size, chemistry), linked to the products |
| K4 | Listed in the shop navigation and the footer or `/shop` |
| K5 | BreadcrumbList; ItemList of its products |
| K6 | Every `.in` category URL (`/category/*`) lands here or on `/shop/all` |

### C.3 Static pages (home, `/shop`, `/services`, `/about`, `/contact`, `/quote`, `/projects`)

| # | Check |
|---|---|
| S1 | The `.in` equivalent 301s here (home ← `/`, services ← the six Wix service pages, about ← `/our-team`, …) |
| S2 | Title and description are unique and say what the page is for, with the brand in the template, not repeated |
| S3 | Everything the `.in` page said that is still true is said here. Compare `.in`'s *Material Processing Facilities*, *Range of Analysis*, *Materials Testing* and *Our Team* pages line by line against `/services` and `/about` |
| S4 | Organization / LocalBusiness facts (address, phone, founding year, `sameAs`) match Google Business Profile and LinkedIn exactly |
| S5 | One H1. Every section reachable by an anchor that the redirects use (`/services#…`) |

### C.4 Blog (`/blog/<slug>`) and projects (`/projects/<slug>`)

| # | Check |
|---|---|
| B1 | Each of the 26 `.in` posts is either re-published on `.com` and mapped exactly in the generator, or knowingly left to `/blog` |
| B2 | Articles follow docs/blog/MASTER-PROMPT.md. They link to the products they discuss, and those products link back |
| B3 | Article + BreadcrumbList JSON-LD; author with a real profile |

---

## D. Off-site checklist (owner)

In order. Each item is a few minutes once the one before it is done.

1. **DNS cutover** — DOMAIN-CONSOLIDATION.md §3.1–§3.4.
2. **Search Console Change of Address** `.in` → `.com`. Submit `https://www.metnmat.in/sitemap.xml`
   (the old URLs, so Google recrawls them now) in the `.in` property, submit the `.com` sitemap,
   and request indexing for the top pages (§3.5). Bing *Site Move* likewise.
3. **Google Merchant Center**: move any `.in` product feed to `.com`.
4. **Retire the Wix copy**: indexing off in Wix SEO settings (§3.6).
5. **Profiles that link to `metnmat.in`**: change the website field to
   `https://www.metnmat.com` on Google Business Profile, LinkedIn (company page and each
   employee's "Website" field), YouTube, Facebook, Instagram, the Amazon storefront, Justdial,
   Internshala, IndiaMART/TradeIndia if listed, NSRCEL/IIM-B and any incubator or supplier
   directory, email signatures, PDF datasheets and quotation templates.
6. **Backlink report** (Ahrefs/Semrush free tier or Search Console → Links): list the sites
   that link to `.in` and ask the important ones to update the URL.

---

## E. Tracker

Update this table at the end of every session. Dates are absolute.

| Item | State | Date | Evidence / next action |
|---|---|---|---|
| Diagnosis | ✅ | 2026-10-26 | DOMAIN-CONSOLIDATION §1 — Google results, 42/134 indexed |
| `.in` → `.com` map: every live product mapped, none to `/shop/all` | ✅ in repo | 2026-10-26 | 119/119; generator fails on any gap |
| One-hop 301 rules for the `.in` host | ✅ in repo | 2026-10-26 | `legacy-domain.mjs`; tests; verified on a prod build |
| `.in`'s own sitemap of every old URL (181) + permissive robots.txt, to speed Google's recrawl | ✅ in repo | 2026-10-27 | `app/legacy-in/`; verified on a prod build. Submit `https://www.metnmat.in/sitemap.xml` in the `.in` Search Console property at cutover (DOMAIN-CONSOLIDATION §3.5) |
| Caddy serves `metnmat.in` | ✅ in repo | 2026-10-26 | Applied by *Bootstrap v2 host* at cutover |
| 3 renamed pump URLs that 404ed | ✅ in repo | 2026-10-26 | Added to the map |
| DNS cutover | ⏳ owner | — | DOMAIN-CONSOLIDATION §3 |
| Change of Address + sitemaps + Merchant Center | ⏳ owner | — | §3.5 |
| Wix copy de-indexed | ⏳ owner | — | §3.6 |
| Off-site profiles → `.com` | ⏳ owner | — | Part D.5 |
| Product titles + meta descriptions | 📝 plan ready | 2026-10-26 | [`product-seo-plan.csv`](./product-seo-plan.csv) shows current and proposed values side by side for all 134 products. **132 proposed**: 95 are the `.in` page's own title and description (live `.in` titles are ≤ 50 characters, descriptions 108–152), and 37 were written from the catalogue record where no single `.in` page describes that exact SKU. All unique and within length. Apply **after the cutover**, after owner review: `npx tsx scripts/set-product-seo.ts scripts/seo-plans/products-2026-10.json --target=prod --dry-run`, then `--confirm`. It only fills empty fields |
| 3 truncated shortDescs (P5) | ⏳ | — | Fix in CMS |
| 17 placeholder spec tables (P6) | ⏳ needs datasheets | — | |
| 12 products without images (P8) | ⏳ needs photos | — | |
| Catalogue data errors found while writing titles | ⏳ owner | 2026-10-26 | N212 lists N117's thickness (~183 µm). `l-shaped-glassy-carbon-electrode-peek-rod-3mm` is named PEEK but its spec says PTFE (no title proposed until fixed). 3 pumps priced ₹0 (KPK200, 150 RPM dual, KK1800 Wi-Fi), which puts a ₹0 offer in their Product schema. 11 third-party products (Fumasep, Fumion, Sustainion, PiperION, Kamoer) carry brand "METNMAT". All are flagged in the plan CSV |
| 9 `.in` products missing on `.com` | ⏳ | — | List in DOMAIN-CONSOLIDATION §6 |
| Published "Test" product (`/shop/p/test`, ₹54) | ⏳ owner decision | 2026-10-26 | Indexable and in a real category. Unpublish it or set noIndex |
| Empty indexable category `/shop/c/h-cell` | ⏳ | 2026-10-26 | Fill or noindex |
| Sibling-SKU duplicate pages (P13) | ⏳ needs owner decision | — | |
| 26 legacy blog posts | ⏳ decision | — | Re-publish or leave to `/blog` |
| Static-page parity (C.3) | ⏳ | — | |
| Category intros (K3) | ⏳ | — | |
