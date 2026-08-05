# Consolidating `metnmat.in` → `metnmat.com`

**Decision taken 2026-08-05: Option B — consolidate.** `metnmat.com` becomes the
single property. `metnmat.in` stops being a destination and forwards its link
equity across.

This work is **outside this repo** — `metnmat.in` is a Wix site. Everything the
repo can do is already done (§3). What follows is the part only you can apply.

---

## 1. Why this, and what it buys

`metnmat.in` currently returns `200`, self-canonicals to itself, and points
nothing at `.com`. Two live properties for one company means the older one keeps
the history and the newer one competes with it. 301-ing `.in` to `.com` ends
that: Google consolidates the signals onto one domain instead of splitting them.

**Measured 2026-08-05 — the legacy site is almost entirely intact:**

| Status on `metnmat.in` | Count |
|---|---|
| `200` live | **118** of 120 |
| `3xx` already redirecting | 2 |
| `404` gone | 0 |
| unreachable | 0 |

That is the strongest argument for consolidating. Nearly every legacy URL is
still live and indexable, so nearly every one of them is still competing with
its `.com` equivalent — and still holding whatever equity points at it.

> A methodology note, because it nearly became a wrong conclusion in this
> document: the first pass ran 8 concurrent requests, Wix rate-limited them into
> connect timeouts, and 91 URLs looked "already gone". They were not. The table
> above is a sequential re-run with retries. Connect timeouts are not 404s.

What it does **not** buy: instant rankings. `metnmat.com`'s first commit is
2026-06-05 and its SEO layer landed 2026-07-31. Consolidation removes a
handicap; it does not substitute for the months a new site needs. Expect
movement over 3–6 months, not weeks.

---

## 2. What to apply in Wix

### 2.1 The 90 literal redirects

[`wix-301-redirects.csv`](./wix-301-redirects.csv) — two columns,
`Old URL,New URL`, ready for **Wix → Marketing & SEO → SEO Tools → URL
Redirect Manager → Import**.

Derived from [`apps/website/legacy-redirects.mjs`](../../apps/website/legacy-redirects.mjs),
which maps legacy URLs from product *specification* data — chemistry, body
material, form factor, dimensions — not slug similarity. Each entry there is
tagged with its confidence basis (`exact`, `truncated`, `spec-match`,
`verified`).

122 entries reduce to 90 rows because 30 product slugs contain `φ` and appear
twice, once literal and once percent-encoded. Those are the same Wix page, and
Wix rejects two rules with one source path — so they are collapsed. Verified:
30 collapsed groups, 0 false merges.

### 2.2 The 2 wildcard rules — add these LAST

Order matters. Wix evaluates rules in order, so these catch-alls must sit
**after** the literals or they will swallow the specific mappings.

| Pattern | Destination |
|---|---|
| `/product-page/*` | `https://www.metnmat.com/shop/all` |
| `/post/*` | `https://www.metnmat.com/blog` |

`/post/*` goes to the blog index rather than to specific articles on purpose:
the 26 legacy posts share zero slugs with the 3 on `.com`, so inventing
equivalences would send readers to unrelated articles.

### 2.3 Root and apex

`metnmat.in` already 301s to `www.metnmat.in`. Leave that in place — it means
one rule set on `www` covers both.

Finally, redirect the `.in` homepage itself: `/` → `https://www.metnmat.com/`.
This is not in the CSV because it is the rule most likely to be applied by
mistake before the others are in place, which would strand every other legacy
URL. **Apply it last.**

---

## 3. What the repo already handles

No further code change is needed on the `.com` side.

- `legacy-redirects.mjs` (122 entries) is wired through `next.config.mjs:103`,
  so any legacy URL that arrives at `.com` directly — from an old bookmark, an
  inbound link, or a stale index entry — already resolves.
- **No redirect chains.** Sampled 24 legacy URLs across every mapping kind —
  static pages, products, plus both wildcard fallbacks and a deliberately
  nonexistent product — and **24/24 reach a `200` in exactly one `301` hop**.
  This matters for the Wix step: `.in` → `.com` will be hop 1, and hop 2 lands
  on real content rather than another redirect. Equity is not leaking to a
  chain, and crawlers are not being made to walk one.
- All 65 unique destinations return `200`, verified live. One exception was
  found and fixed in this pass: `/blank-4` and `/blank-5` (the legacy "Order
  Tracking" and "tracking-status" pages) pointed at `/account/orders`, which is
  `Disallow: /account` in robots.txt *and* 307s to a login wall — unfollowable
  by a crawler and useless to a logged-out visitor. Both now go to `/support`.
- The sitemap index and its 6 sections (132 URLs) are live and valid.

---

## 4. Order of operations

1. **Import the 90 literal redirects** (§2.1).
2. **Add the 2 wildcard rules** (§2.2) — after the literals.
3. **Spot-check ~10** legacy URLs in a browser; confirm each lands on a real
   `.com` page and not the homepage.
4. **Verify `metnmat.com` in Google Search Console and Bing Webmaster Tools**,
   and submit `https://www.metnmat.com/sitemap.xml`. Do this *before* step 6 —
   without GSC you cannot see whether consolidation is being picked up.
5. **Add `metnmat.in` to GSC too**, and use *Change of Address* if the property
   is verified. This is the strongest consolidation signal available and it only
   works while `.in` is still verifiable.
6. **Redirect the `.in` homepage** `/` → `https://www.metnmat.com/` (§2.3).
7. **Leave the redirects up for at least 12 months.** Equity transfer is not
   instant; removing them early discards it.

---

## 5. Do not

- **Do not delete the `.in` site or let the domain lapse.** A redirect only
  passes equity while it resolves. Deleting the site throws away exactly what
  this exercise is for.
- **Do not redirect everything to the `.com` homepage.** A mass redirect to `/`
  is treated as a soft-404 and passes little. That is the whole reason for the
  per-URL mapping.
- **Do not apply the homepage rule first** (§2.3).

---

## 6. Open item I could not check

Your brief's backlink figures do not say **which domain** they point at. That
changes how much this is worth: if the referring domains point at `.in`, this
consolidation is the single highest-value action available. If they already
point at `.com`, the gain is smaller and the story is even more purely about
site age.

Checking needs SEMrush/Ahrefs, which I have no access to. Run a backlink report
per domain before step 1 so you know what you are moving.
