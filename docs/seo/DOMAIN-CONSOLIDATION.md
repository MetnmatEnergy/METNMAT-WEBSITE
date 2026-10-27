# Consolidating `metnmat.in` → `metnmat.com`

**Decision taken 2026-08-05: consolidate.** `metnmat.com` becomes the single property;
`metnmat.in` stops being a destination and forwards everything it has earned.
**Decided 2026-10-26: do it without Wix.** `metnmat.in` points at our own host, and the
website answers every `.in` URL with one 301 to its `.com` page. Path B (Wix's redirect
manager) is kept at the end only as a fallback.

The master prompt that this is step one of: [`MASTER-PROMPT.md`](./MASTER-PROMPT.md).

---

## 1. Why — measured 2026-10-26

Google India, logged out:

| Query | `metnmat.in` | `metnmat.com` |
|---|---|---|
| `metnmat` | **#1** (homepage) | #2 (homepage), #6 (/about) |
| `zero gap electrolyzer for carbon dioxide reduction metnmat` | **#1–#4** (four product pages) | not on page 1 |
| `metnmat hg/hgo reference electrode` | **#1** | not on page 1 |
| `swagelok battery test fixture metnmat` | **#1** | #2 (a category page, not the product) |

`site:www.metnmat.com/shop/p` shows about **42 of 134** product pages indexed.

Two live sites from one company sell the same products. The older one has the history and
the inbound links; on 2026-10-26 its product sitemap was modified the day before, so it is
also still being worked on. For a product query, Google picks one of the two pages as the
original and the other as a duplicate. It picks `.in`. On-page work on `.com` cannot
overturn that while `.in` stays live. Only a 301 from each `.in` URL to its `.com` page can,
because it tells Google the two are one page that has moved.

**The legacy site, 2026-10-26:** 115 products, 36 pages, 26 blog posts, all `200` and
all self-canonical.

## 2. What the repo now does (no Wix involved)

| Piece | File | What it does |
|---|---|---|
| The map | [`apps/website/legacy-redirects.mjs`](../../apps/website/legacy-redirects.mjs) | Every `.in` URL → its `.com` page. **All 115 live products + 4 historical slugs** resolve: 40 exact, 14 exact after dropping Wix's `φ`, 3 truncated, 20 spec-matched, 41 hand-verified (name **and** price checked on both sites; 9 of them are products created on `.com` on 2026-10-27 from their `.in` pages, §6), 1 carried. **0 to a category, 0 to `/shop/all`.** Since the cutover the generator reads `.in`'s sitemaps from the 2026-10-26 snapshot in `apps/website/scripts/legacy-in-snapshot/`, because `.in` itself now redirects. |
| The generator | [`apps/website/scripts/build-legacy-redirects.mjs`](../../apps/website/scripts/build-legacy-redirects.mjs) | Rebuilds the map from the live Wix sitemaps + live catalogue. **Refuses to run** if any live `.in` product would fall to `/shop/all`, or any `.in` page is unmapped and 404s on `.com`. The map only grows. |
| Host rules | [`apps/website/legacy-domain.mjs`](../../apps/website/legacy-domain.mjs) | Requests whose Host is `metnmat.in` or `www.metnmat.in` get **one 301 to the absolute `https://www.metnmat.com/...` URL**. Query strings are kept. Two files are the exception (next row). |
| The old host's own sitemap + robots | `apps/website/src/app/legacy-in/` | `metnmat.in/sitemap.xml` lists **every URL the old site served** (181: 36 pages, 119 products, 26 posts; `legacyInPaths` in the map). Each of them 301s. `metnmat.in/robots.txt` allows everything and names that sitemap. Submitted in the `.in` Search Console property, this makes Google recrawl the old URLs, and so find their redirects, now rather than over weeks. Both are 404 on any other host. |
| Proxy | [`deploy/v2/caddy/Caddyfile`](../../deploy/v2/caddy/Caddyfile) | `metnmat.in, www.metnmat.in` → the website (:3100), with its own Host header and a TLS certificate. |
| Tests | `test/legacy-domain.test.ts`, `test/legacy-redirects.test.ts` | Every legacy URL resolves in **exactly one hop** on both `.in` hosts, its target is not itself a redirect, `.com` traffic is untouched, and no product lands on a different material. |

Verified against a production build (`next start`, Host header set) on 2026-10-26:

```
www.metnmat.in /                                         301 https://www.metnmat.com/
metnmat.in     /                                         301 https://www.metnmat.com/
www.metnmat.in /request-a-quote                          301 https://www.metnmat.com/quote
www.metnmat.in /product-page/mercury-oxide-…-%CF%866-70mm 301 https://www.metnmat.com/shop/p/hg-hgo-reference-electrode-6-70-mm
www.metnmat.in /product-page/kamoer-kcp-x-…?lang=en      301 https://www.metnmat.com/shop/p/compact-peristaltic-pump-knob-control-65-ml-min?lang=en
www.metnmat.in /product-page/graphite-felt-…             301 https://www.metnmat.com/shop/c/carbon-gdl
www.metnmat.in /category/all-products                    301 https://www.metnmat.com/shop/all
www.metnmat.in /a/b/c?x=1                                301 https://www.metnmat.com/a/b/c?x=1
www.metnmat.in /sitemap.xml                              200 application/xml — 181 old URLs
www.metnmat.in /robots.txt                               200 text/plain — Allow: /, Sitemap: https://www.metnmat.in/sitemap.xml
www.metnmat.com /legacy-in/sitemap.xml                   404
```

All of it is **inert until `metnmat.in` resolves to `52.66.54.7`**. Merging and deploying it
changes nothing anyone can see.

## 3. The cutover — Path A, no Wix (recommended)

`metnmat.in`'s DNS is hosted by Wix today (nameservers `ns0/ns1.wixdns.net`). It moves to
Cloudflare, next to `metnmat.com`.

### 3.1 Before anything — copy the records you must keep

Email for `metnmat.in` runs on GoDaddy, and Google verifies the property by a TXT record.
**Losing either breaks things that have nothing to do with the website.** Public DNS on
2026-10-26 shows:

| Type | Name | Value |
|---|---|---|
| MX 10 | `@` | `smtp.secureserver.net` |
| MX 20 | `@` | `mailstore1.secureserver.net` |
| TXT | `@` | `v=spf1 include:secureserver.net -all` |
| TXT | `@` | `google-site-verification=TYZ17ERen7rMgMFEaLAgImgDE2z2e1yUk7AbH9NpCjQ` |

Public DNS cannot list everything (DKIM selectors, `email`/`autodiscover` CNAMEs, …).
Open **Wix → Domains → metnmat.in → Manage DNS Records** and copy **every** record except
the Wix A/CNAME records for `@` and `www`. Screenshot it; that is the rollback.

### 3.2 Find the registrar

Wix hosts the DNS, but the domain may be registered elsewhere (GoDaddy is likely: the mail is
GoDaddy's). The registrar is where the nameservers are changed. If the domain was bought
*through* Wix, the nameserver change is made in Wix's domain settings instead. Either way,
**keep the domain registered and renewing for at least two years.** A redirect stops passing
anything the day the domain lapses.

### 3.3 Cloudflare zone

1. Cloudflare → **Add a domain** → `metnmat.in` → Free plan.
2. Review the records it imports. Delete the Wix A/CNAME records for `@` and `www`. Add:

   | Type | Name | Value | Proxy |
   |---|---|---|---|
   | A | `@` | `52.66.54.7` | **DNS only** (grey cloud) |
   | A | `www` | `52.66.54.7` | **DNS only** |

   DNS-only, as for `metnmat.com`: Caddy terminates TLS itself and gets its own certificate.
3. Confirm every record from §3.1 is present: MX, SPF, google-site-verification, and anything else copied from Wix.
4. Note the two Cloudflare nameservers it assigns.

### 3.4 Switch, in this order

1. **Merge this PR.** The website deploys on its own (`deploy-web.yml`). Nothing changes yet.
2. **Change the nameservers** at the registrar to the two from §3.3.
3. **Dispatch *Bootstrap v2 host*** (`bootstrap-host.yml`). It installs the new Caddyfile.
   Caddy starts requesting the `metnmat.in` certificate and retries until DNS has moved.
   Run it **right after** step 2, not days before. Caddy backs off between failed attempts,
   so an early run could leave `.in` without a certificate for hours after the switch.
4. **Watch it land** (a few minutes to a few hours):
   ```bash
   nslookup metnmat.in 8.8.8.8
   ```
   ```bash
   curl -sI https://www.metnmat.in/product-page/zero-gap-electrolyzer-for-carbon-dioxide-reduction
   ```
   Expect `52.66.54.7`, then `HTTP/2 301` with
   `location: https://www.metnmat.com/shop/p/zero-gap-electrolyzer-for-carbon-dioxide-reduction`.
   If DNS has moved but TLS still fails after an hour, dispatch *Bootstrap v2 host* again.
5. **Spot-check 10 URLs** from the old Wix sitemaps in a browser: each lands on a real
   `.com` page in one hop. The full list is the `source` column of `legacy-redirects.mjs`.

### 3.5 Tell Google — the same day

1. **Search Console → the `metnmat.in` property → Settings → Change of address →
   `https://www.metnmat.com`.** This is the strongest consolidation signal there is. It
   needs both properties verified, which is what the google-site-verification TXT records
   in §3.1 (and the one on `metnmat.com`) are for. Google checks that the homepage and a
   sample of URLs 301 correctly, which they now do.
2. **In the `metnmat.in` property → Sitemaps**, remove the old Wix sitemaps if they are
   listed (`store-products-sitemap.xml`, `pages-sitemap.xml`, …, which now redirect away) and
   **submit `https://www.metnmat.in/sitemap.xml`**. It lists all 181 old URLs, each of
   which redirects, so Google recrawls them and finds the redirects now instead of
   stumbling on them over weeks. Leave it submitted until `site:metnmat.in` shows nothing,
   then leave it anyway: it costs nothing.
3. In the `metnmat.com` property, submit `https://www.metnmat.com/sitemap.xml` (again, if it
   is already there) and run **URL Inspection → Request indexing** on the homepage, `/shop`
   and the 10 most important products.
4. **Bing Webmaster Tools** has its own *Site Move* tool. Do the same there, and submit the
   same `.in` sitemap.
5. If `metnmat.in`'s products feed **Google Merchant Center** (Wix Stores can sync them),
   move the feed to `metnmat.com` or remove the `.in` one. Shopping results otherwise keep
   pointing at the old domain.

### 3.6 Then retire the Wix site properly

Once the domain is gone, Wix serves the site at its free `*.wixsite.com` address, and
that copy is indexable unless told otherwise. In Wix: **Settings → SEO → "Let search
engines index your site" → off**, or unpublish the site. Do not delete it: it is the
reference copy of the legacy content (§6). Its premium plan can be cancelled once the
domain is no longer billed through it.

### 3.7 Rollback

Change the nameservers back to `ns0.wixdns.net` / `ns1.wixdns.net`. Wix serves the old site
again within the DNS TTL. Nothing on `.com` needs undoing.

## 4. What to expect

- **Days:** `site:metnmat.in` results begin dropping. Brand queries usually flip first.
- **2–8 weeks:** most product queries show the `.com` page where the `.in` page used to be.
  Google consolidates a URL when it next crawls it, so popular pages move first.
- **Keep the redirects for good.** Removing them stops the equity flowing. They cost nothing.

## 5. Do not

- **Do not let `metnmat.in` lapse** or point it anywhere else.
- **Do not forward the whole domain to the `.com` homepage** (registrar "domain forwarding"
  usually does exactly that). A mass redirect to `/` is treated as a soft 404 and passes
  little. Per-URL mapping is the whole point.
- **Do not change a `.com` product slug without a redirect.** Renamed slugs need a row in
  *Product Slug Redirects* (the CMS writes one automatically when the slug is edited in the
  admin). Three pumps were renamed outside the admin and their old URLs 404ed until this PR
  added them to the map.

## 6. Open items this does not close

- ~~**9 `.in` products have no `.com` page yet.**~~ **Closed 2026-10-27.** The 100+100 mL and
  30+30 mL H-type cells, the 100 mL water-jacketed single cell, the 50 mL single-chamber glass
  cell, graphite felt 200×200×3 mm, nickel fiber felt, the PEM hydrogen electrolyzer
  (60 mL/min), PiperION ionomer dispersion 5 wt % 20 mL and the PTFE 40 mL water-splitting
  reactor were created on `.com` from their own `.in` pages (copy, price, 26 photographs;
  `apps/dashboard/scripts/draft-products/metnmat-in-missing-2026-10.json`), and their old URLs
  moved from `CATEGORY` to `MANUAL` in the generator.
- **26 legacy blog posts** go to `/blog`. They are METNMAT's own 2023 articles. Re-publishing
  the ones still worth reading on `.com` and adding them to the map would keep their traffic.
- **Backlinks.** Profiles and listings that link to `metnmat.in` (LinkedIn, Justdial,
  Internshala, IndiaMART, YouTube, Google Business Profile, supplier directories) still pass
  through the redirect. Pointing them at `.com` directly is better.

## Appendix — Path B, Wix's URL Redirect Manager (fallback only)

If the DNS cannot move: [`wix-301-redirects.csv`](./wix-301-redirects.csv) is the same map in
Wix's import format (Marketing & SEO → SEO Tools → URL Redirect Manager → Import), plus
`/product-page/*` → `/shop/all` and `/post/*` → `/blog` as the last two rules. Its
limits are why it is the fallback. Wix's redirect manager **cannot redirect the homepage**,
which is the URL that ranks #1 for `metnmat`. The domain also stays on Wix and on its bill.
The CSV was regenerated from `legacy-redirects.mjs` on 2026-10-26 (147 rules); regenerate it again if the map changes.
