# METNMAT ranking master prompt: top of the field, on Google and in AI answers

Version 1.0, 2026-11-04. The owner's brief: *improve metnmat.com SEO and GEO, add the keywords and
everything needed to be at the top of the field METNMAT works in, understand why competitors such as
DekResearch come above us, and build what they do well into the site so we beat them in every aspect.*

This takes over from [`MASTER-PROMPT.md`](./MASTER-PROMPT.md), which covered the move from metnmat.in
to metnmat.com. That move is done (redirects live 2026-10-27, Change of Address accepted 2026-10-28,
15 blog posts moved 2026-11-03). Its hard rules still apply.

| Part | What it is |
|---|---|
| A. Where we stand | Measured facts, with dates |
| B. Why competitors rank | What they have that we lack |
| C. Keyword map | Which page owns which search |
| D. Operating prompt | Paste into a session to carry on the work |
| E. Page standards | What a finished page has |
| F. GEO checklist | Being named in AI answers |
| G. Owner actions | What only the owner can do |
| H. Tracker | Done and next |

---

## A. Where we stand

Search Console, 3 months to 2026-10-31, read 2026-11-04:

| | metnmat.in (old) | metnmat.com (new) |
|---|---|---|
| Non-brand queries | 987 | 33 |
| Non-brand clicks | 121 | 0 |
| Non-brand impressions | 15,500 | 132 |

Bing AI Performance, 3 months: metnmat.in 347 Copilot citations (220 of them blog posts), metnmat.com 0.

Google India on 2026-11-04, 8 searches: metnmat.in is on page one for 5 of them, metnmat.com for none.
The rankings are .in's, and they reach .com only as Google re-reads each old URL. **So the first job
is to give that authority strong pages to land on.**

**Nobody can promise a Google position.** Google decides, competitors keep moving, and backlinks and
reviews take time. The promise this plan makes is narrower: no page of ours is weaker than the
competitor's for the same search, and progress is measured weekly on the scoreboard below.

Scoreboard, Google India, 2026-11-04 (position; "–" means not in the first results read):

| Search | metnmat.com | metnmat.in | DekResearch | Electrochemistry Store |
|---|---|---|---|---|
| ag/agcl reference electrode price | – | 2 | – | 4 |
| platinum electrode price | – | – | – | 3 |
| h type electrochemical cell | – | – | 5 | 7 |
| electrochemical cell supplier india | – | – | – | – |
| co2 electrolyzer flow cell india | – | 1 | – | – |
| proton exchange membrane price india | – | 2 | – | – |
| glassy carbon electrode price | – | 5 | 9 | 1 |
| nickel foam price | – | 3 | – | 4 |

DekResearch appears in only 2 of the 8, and metnmat.in already beats it on one. The real rival in
India is Electrochemistry Store. The job is to move .in's positions to .com, then gain the rest.

Where the demand is (.in, 3 months, non-brand):

| Topic | Impressions | Clicks | Avg. position |
|---|---:|---:|---:|
| Metals and alloys (informational) | 7,011 | 18 | 10.8 |
| R&D and innovation (informational) | 2,166 | 0 | 21.1 |
| Platinum electrodes | 1,295 | 7 | 9.3 |
| Zinc and aluminium sheet | 1,248 | 7 | 7.4 |
| Microstructure analysis | 1,190 | 0 | 15.8 |
| "price" searches, any product | 976 | 12 | 7.1 |
| Ag/AgCl electrodes | 830 | 14 | 7.0 |
| Other reference electrodes | 543 | 11 | 7.6 |
| Graphite and glassy carbon | 477 | 5 | 7.4 |
| Electrode holders | 436 | 15 | 4.9 |
| Cells and reactors | 293 | 13 | 6.9 |
| Nickel and copper foam | 266 | 5 | 10.5 |
| Presses | 245 | 0 | 15.8 |
| Membranes | 240 | 7 | 11.6 |
| Pumps | 139 | 7 | 8.8 |

Topics overlap, so the rows do not add up. Three readings: buyers type the product name, very often
with **"price"**; most commercial terms sit at position 4 to 10, where moving up a few places
multiplies clicks; and electrode holders, at position 4.9, prove that a specialist page can win.

---

## B. Why competitors rank

The Google India results of 2026-11-04 show who competes, as the page teardown of the same date shows:

| Competitor | Where it appears | What it does well |
|---|---|---|
| **electrochemistrystore.com** | 5 of 8 searches; #1 for glassy carbon electrode price | INR prices with tax wording, shipping stated, ratings (4.88 from 25), compatibility notes ("not suitable for alkaline solution", with a link to the right product), repair guides linked from products |
| **DekResearch** (dekresearch.com, in.dekresearch.com) | H-cell and glassy carbon | A separate **India site in ₹**, plus au/ca/ie versions. Product pages of about 2,570 words against our 745 (whole page, H-cell, measured 2026-11-04): Details, Specifications, Shipping and FAQ tabs, 6 product Q&As, 10 recommended products, size selector, "Product Includes", AggregateRating, 60-day warranty, per-country shipping table. Titles begin "Buy …" |
| mtxlabsglobal.com | #1 H-cell | Video on product pages, "What's in the box", named testimonials with institutions |
| vritratech.com | #1 nickel foam | Spec table, buy online in ₹, GSTIN visible |
| Ossila | Several | About 500 useful words per product, alternatives table, 2-year warranty, dispatch promise, packs of 1/5/10 |
| pspinstruments.in, phadkeinstruments.co.in, matlabs.in | Indian manufacturers | Exact-match pages per product; thin copy |
| Amazon, IndiaMART, TradeIndia, Justdial | Almost every search | Domain authority. Beat them with better pages, and also be listed on them |

What this means:

- **Domain age is not the problem.** metnmat.com was registered in 2019; DekResearch and
  Electrochemistry Store in 2021.
- **The gap is pages and proof.** They have more words per page, more answers and reviews, and they
  rank in their own name, while METNMAT's rankings still sit on metnmat.in. Links could not be
  measured without a paid tool: check them in Search Console → Links.
- **None of the pages read had datasheet downloads or paper citations.** That is open ground where
  METNMAT can lead. (Structured data could not be read by the teardown tool; DekResearch's product
  page does carry Product and AggregateRating.)
- **What METNMAT can offer that marketplaces cannot:** one specialist catalogue with listed prices,
  custom builds through "Request for Customization", real R&D expertise, a GST invoice and free
  shipping within India.

---

## C. Keyword map

One page owns each search, so pages do not compete with each other.

| Search intent | Page that owns it |
|---|---|
| reference electrode; reference electrode price | `/shop/c/reference-electrodes` |
| ag/agcl reference electrode (price) | hub, then the Ag/AgCl products |
| calomel electrode price; saturated calomel | `/shop/c/reference-electrodes`, then the SCE products |
| hg/hgo reference electrode price | `/shop/c/reference-electrodes`, then the Hg/HgO products |
| platinum electrode (price); pt counter electrode | hub `platinum-electrodes`, then `/shop/c/counter-electrodes` |
| platinum mesh / wire / plate electrode | the matching products |
| graphite rod electrode; graphite electrode | `/shop/c/counter-electrodes`, then the rods |
| glassy carbon electrode price | `/shop/c/working-electrodes` |
| electrode holder; ptfe electrode holder | `/shop/c/electrode-holders` |
| h cell; h type electrochemical cell | `/shop/c/h-cell` |
| electrochemical cell supplier india | `/shop/c/reactor-cell`, then the home page |
| swagelok cell; battery test cell | `/shop/c/battery-reactors` |
| co2 electrolyzer; gas diffusion flow cell | `/shop/c/co2-electrolysis` |
| pem electrolyzer price; zero gap electrolyzer | `/shop/c/water-splitting-reactors` |
| proton exchange membrane price; N117 | `/shop/c/pem-membranes` |
| anion exchange membrane; fumasep; piperion | `/shop/c/aem-membranes` |
| nickel foam (price); gdl; carbon cloth; graphite felt | `/shop/c/carbon-gdl`, then the products |
| peristaltic pump price | `/shop/c/peristaltic-pumps` |
| hot press; 30 ton hydraulic press | `/shop/c/mea-fabrication` |
| zinc sheet; pure zinc sheet | the High Purity Zinc Sheet product |
| metals and alloys; alloy composition; uses of alloys | the blog posts moved from .in |
| microstructure analysis; metallurgical testing | `/services`, and the moved posts |

---

### Every product, in the buyer's words

[`product-keywords.csv`](./product-keywords.csv) lists all 141 products with the names people type
for them, and `frontend/lib/product-terms.ts` is the source. Buyers do not search
"Hg/HgO Reference Electrode (Ø4 × 60 mm, PEEK Rod)": they search "hgo reference electrode", "pt wire
electrode", "sce electrode", "ni foam", "gce electrode", "teflon electrode holder", and "aluminium"
with the Indian spelling. Terms come from Google India autocomplete and Search Console, never from
guesses. They appear in the "Also known as" line under the H1, the price FAQ, `alternateName` in the
Product data, the meta keywords, the Merchant feed and the shop's own search. A new product needs a
rule there, or `test/product-terms.test.ts` should gain it.

---

## D. Operating prompt

<!-- BEGIN operating-prompt -->
You are the SEO and GEO engineer for METNMAT (metnmat.com), an Indian supplier of
electrochemistry lab equipment and a materials R&D company. Read CLAUDE.md and
docs/seo/RANKING-MASTER-PROMPT.md before doing anything. Work the tracker (Part H) top down.

GOAL
metnmat.com is the first result for every search in the keyword map (Part C), and the source AI
answers cite, above DekResearch, Electrochemistry Store and the marketplaces.

ORDER OF WORK
1. Read the latest numbers first: Search Console queries for both properties, Bing AI Performance,
   Merchant Center status. Compare with Part A. State what moved.
2. Land the old authority: pages that the .in redirects reach must be the strongest on the site.
3. Category pages, then hubs, then product pages, in order of impressions in Part A.
4. Beat each row of Part B, feature by feature.
5. Blog: link posts to products and products to posts, then new articles (docs/blog/MASTER-PROMPT.md).

HARD RULES
- Nothing fabricated. Every claim traces to a CMS field, a real page, a datasheet, standard textbook
  science, or the owner's words. Prices and counts are computed from live products, never typed.
- No aggregateRating or review markup without real reviews. No invented certifications, customers or
  delivery times. Say "not stated" and ask the owner.
- N117, N115 and N212 are PFSA membranes. Never call them Nafion: the name appears only to say they
  belong to the same polymer family, until the owner confirms otherwise.
- Keywords go in titles, headings and the first sentence in natural language. No stuffing, no hidden
  text, no doorway pages. A hub must list real products and say something a category page cannot.
- Keep /api/ blocked for Googlebot in robots.ts: a US crawl with /api/geo open would see USD prices.
- Never bulk-fetch /merchant-image on production. Sample one or two.
- Production CMS writes go through a script with a dry run, run by the owner with an Atlas IP
  allowance. Blog changes must never use /api/posts/ingest, which emails staff (no-email rule).
- Code goes through a branch and PR, passes typecheck, lint, build and test. The website deploys from
  main; the CMS only when deploy-cms.yml is dispatched.
- Measure before and after, and report what could not be measured.
<!-- END operating-prompt -->

---

## E. Page standards

**Category page:** title with the buyer's words and India or price; H1 as buyers say it; a first
sentence that defines the thing; live count and price range; buying guide; FAQs with FAQPage data;
related categories. Guarded by `test/category-seo.test.ts`.

**Product page, to beat DekResearch's 2,570 words honestly:**

| Block | Status |
|---|---|
| Price with GST and shipping stated | ✅ |
| Spec table from real data | ✅ most; check the placeholder ones |
| Product, Offer, Breadcrumb, FAQ structured data | ✅ |
| Replacement policy on the page | ✅ |
| "What's in the box" and "what you also need" | ⏳ needs owner facts |
| Compatibility and "not suitable for" notes with links | ⏳ |
| Technical FAQs per product family | ⏳ |
| How to use and care for it | ⏳ |
| Datasheet PDF download | ⏳ needs the files; no competitor has this |
| Papers that used the product | ⏳ needs the list; no competitor has this |
| Real reviews | ⏳ needs customers |
| Recommended products with prices | check against Dek's 10 |

---

## F. GEO checklist

AI answers quote pages that state facts plainly, and they lean on Bing and Google's index.

| Item | Status |
|---|---|
| AI crawlers not blocked in robots.txt | ✅ allowed by the `*` group |
| llms.txt with the catalogue and live prices | ✅ this batch |
| Definitions in the first sentence of each category | ✅ this batch |
| FAQs with FAQPage data on categories | ✅ this batch |
| Organization data with `knowsAbout` and `sameAs` | ✅ |
| IndexNow, so Bing hears of changes at once | ✅ this batch; run after deploys |
| Bing AI Performance read every Monday | ✅ |
| Citeable facts: reference potentials, RHE conversion, electrode areas | ✅ this batch |
| Comparison content: "Ag/AgCl vs SCE", "PEM vs AEM", "H-cell vs flow cell" | ⏳ blog |
| Wikidata, LinkedIn and directory entries that agree on the facts | ⏳ owner |

---

## G. Owner actions

Ranked by effect:

1. **Reviews.** Ask 10 to 20 real customers for a Google review and a product review. This is what
   DekResearch and Electrochemistry Store have that we cannot write.
2. **Google Business Profile and LinkedIn:** set the website to `https://www.metnmat.com`.
3. **Datasheets and manuals as PDF**, one per product family.
4. **Papers that used METNMAT products**, as a list of DOIs. Researchers trust this most, and it also
   earns links.
5. **Listings with a link to metnmat.com:** IndiaMART, TradeIndia, Justdial, and a page on each
   university or lab supplier list you can reach.
6. **Confirm for the product pages:** what comes in each box; warranty; typical dispatch time; whether
   N117/N115/N212 are genuine Nafion or equivalent; delivery promise for the site.
7. **A short video** of a cell being assembled (MTX Labs does this).

---

## H. Tracker

| Item | State | Date | Evidence / next |
|---|---|---|---|
| Keyword research and competitor teardown | ✅ | 2026-11-04 | Parts A to C |
| 24 category landing pages | ✅ live | 2026-11-04 | `frontend/lib/category-seo.ts`, PR #59 |
| Home, shop, services titles and headings | ✅ live | 2026-11-04 | PR #59 |
| llms.txt catalogue, IndexNow | ✅ live | 2026-11-04 | `scripts/indexnow.mjs`; all 213 URLs sent, Bing answered 200 |
| Full crawl of all 213 pages | ✅ | 2026-11-04 | All 200, one H1 each, no duplicate titles or descriptions, canonicals correct, every image has alt text |
| Product tabs in the HTML for crawlers | ✅ in PR | 2026-11-04 | Specifications, Documents and Shipping were missing from what crawlers read |
| 26 over-long descriptions, 8 long blog titles, bare /about and /contact titles | ✅ in PR | 2026-11-04 | |
| Audit of all 141 products | ✅ | 2026-11-04 | [`product-audit.csv`](./product-audit.csv): every product and what it needs |
| Written content for all 141 products: what it is, typical uses, care and handling | ✅ in PR | 2026-11-04 | `frontend/lib/product-copy.ts`, 78 families; product pages now about 1,150 to 1,490 words. Standard science only: per-model facts still want datasheets |
| "Compare other models" price table on product pages | ✅ in PR | 2026-11-04 | Same plain name, live prices |
| Free reference electrode to RHE converter | ✅ in PR | 2026-11-04 | `/tools/potential-converter`; none of the competitors read has one. Tell your researchers: this is what earns links |
| 4 comparison guides (`/guides`) | ✅ in PR | 2026-11-04 | Reference electrodes, PEM vs AEM, H-cell vs flow cell, three-electrode setup |
| Speed check | ✅ | 2026-11-04 | Real throttled mobile LCP 1.9 s (good). Lighthouse's simulated 4.9 s is an artefact; SEO 100, accessibility 97 to 100. No work needed |
| "Crawled - currently not indexed": 37 pages (report dated 2026-10-23) | watch | | Google's verdict on thin pages; re-read the report after the new content is crawled |
| 5 topic pages `/shop/t/*`: platinum, Ag/AgCl, Hg/HgO, graphite, glassy carbon | ✅ in PR | 2026-11-04 | `frontend/lib/topic-seo.ts`; cheapest first, price list table, own guide, sitemap, linked from `/shop`, categories and products |
| Price list tables on category and topic pages | ✅ in PR | 2026-11-04 | Not found on any competitor page read |
| Product search description leads with the live price | ✅ in PR | 2026-11-04 | `productSearchDescription` |
| Product pages: family guide, family FAQs, 8 related products, links to topics | ✅ in PR | 2026-11-04 | Hg/HgO page now 9 FAQs, about 1,140 words |
| Blog articles link to the shop and `/services` | ✅ in PR | 2026-11-04 | `components/blog/shop-links.tsx`; in-text links still to do |
| `<html lang="en-IN">` | ✅ in PR | 2026-11-04 | |
| After merge: run `scripts/indexnow.mjs`, request indexing of topics and top categories | ✅ | 2026-11-04 | 218 URLs sent; queued first in the daily task; IndexNow runs in STEP E |
| Buyer's search words on all 141 products | ✅ in PR | 2026-11-04 | `product-terms.ts`, `product-keywords.csv` |
| Country of origin claimed "India" on third-party products | ✅ in PR | 2026-11-04 | The CMS default also fed the FAQ on FUMATECH, Versogen, Dioxide Materials and Kamoer items |
| Topic pages for gold electrodes and nickel foam | ✅ in PR | 2026-11-04 | |
| Product titles: "Buy" and "Price" | next | | Only 13 of 141 titles leave room; needs a CMS plan and dry run |
| Per-product compatibility, what's in the box, care | next | | Needs owner facts (Part G) |
| In-text links from the 15 moved posts to products | next | | CMS write by script, never through ingest |
| `/services` page for microstructure analysis and metallurgical testing | next | | 1,190 impressions; check .in's old pages for what was offered |
| More topic pages when Search Console shows demand | next | | Candidates: gold electrodes, calomel, nickel foam |
| Sibling duplicate products | owner | | e.g. Platinum Sheet 20 × 20 × 0.1 mm and Noble metal plate platinum 20 × 20 × 0.1 mm |
| Catalogue prices that look wrong | owner | | Platinum mesh 10 × 10 mm ₹41,300 vs 20 × 20 mm ₹29,500; platinum sheet 10 × 10 mm ₹23,600 vs 15 × 20 mm ₹18,880. Now visible side by side in the price lists |
| Zinc sheet SEO title says 99.9%, spec says 99.99% to 99.995% | owner | | 1,248 impressions on this topic; confirm purity, then fix through the SEO script |
| Aluminium sheet title says 99.9%, spec says at least 99.8%; gas bag title says PVDF, spec says PVF | owner | | Confirm, then fix through the SEO script |
| Country of origin on METNMAT-brand products | owner | | Every product reads India by default; confirm it is true of METNMAT-brand items |
| "ISO-aligned R&D" badge on every product page | owner | | Confirm it is true, or remove it |
| Delivery promise against "Made to order" | owner | | Merchant Center says 0 to 1 days for all products, but 71 of 141 are made to order. Decide a true figure; the feed and JSON-LD say in stock |
| 12 products with no photo, 18 with one | owner | | Without a photo a product stays out of Google Shopping; see `product-audit.csv` |
| 71 products with no SKU, 3 with no price, 4 with placeholder specs | owner | | `product-audit.csv` |
| Reviews, datasheets, papers | owner | | Part G |
