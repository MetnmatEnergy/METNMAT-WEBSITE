# Phase 0 — Discovery Audit

**Date:** 2026-07-31 · **Scope:** read-only. No application code was modified.
**Method:** repo read + live probes against `https://www.metnmat.com`, `https://admin.metnmat.com`, `https://www.metnmat.in`, `gcloud`, and the committed build output (`.next/prerender-manifest.json`, BUILD_ID `PcbEm1Aigv689Z1Cf8LB8`).

> Every row below was observed. Anything not observed is marked `UNVERIFIED`.

---

## 1. Stack

| Item | Value |
|---|---|
| Frontend | Next.js **15.1.6**, App Router, React **19.0.0**, Tailwind |
| CMS | Payload **3.85.1**, `@payloadcms/db-mongodb` |
| DB | MongoDB Atlas — `metnmat_cms` (CMS) · `metnmat` (chatbot, separate) |
| Media | `@payloadcms/storage-gcs` → **private** GCS bucket (anon GET → 403) |
| Monorepo | pnpm **11.5.1** + turbo · `apps/website`, `apps/dashboard`, `packages/types` |
| Node | 22 (CI) |
| GraphQL | **Disabled** (`/api/graphql` → 404). REST is the only surface. |

**Scripts (root):** `dev · build · lint · typecheck · test · start · format · format:check`
Per app: `dev · build · start · lint · typecheck`; dashboard adds `generate:types · generate:importmap · payload`.

## 2. Hosting & CI

| Item | Value |
|---|---|
| Platform | GCP Cloud Run, project `metnmat-website`, region `asia-south1` |
| Services | `metnmat-website` · `metnmat-dashboard` · `metnmat-chatbot` — all `payload-storage-sa`, maxScale 3, ingress all, `allUsers` invoker |
| Deploy | 3 Cloud Build triggers on `^main$`; images pushed to mutable **`:latest`** only |
| CI | GitHub Actions `ci.yml`: lint → typecheck → test → build. **Not a deploy gate** |
| Env vars | 64 distinct names across both apps. **No `NEXT_PUBLIC_*` carries a secret** ✓ |

## 3. Routes

81 routes: 34 pages, 39 API handlers, 8 special files, 3 layouts, 3 `loading.tsx`, 2 error boundaries.

- **22 prerendered** (20 ISR@60s, 3 pure-static: robots/manifest/llms.txt); everything else dynamic `ƒ`.
- **`generateStaticParams` appears zero times** — all 111 catalog/article/project URLs render per-request (backed by the 60s tagged fetch cache; live TTFB 0.15–0.65s).
- Live probe: **37/37 public routes 200**, 4 bogus slugs correctly 404, `/account/*` + `/checkout/*` correctly 307 → `/login`.
- `generateMetadata` on 6 routes + root layout. **11 pages ship no metadata** (7 are `"use client"`, which cannot export it) → generic tab title.

## 4. Payload

**39 collections + 9 globals.**

| Aspect | State |
|---|---|
| Drafts/versions | **Only 3** collections: `posts`, `products`, `projects` |
| `_status` read gate | `posts` ✓, `projects` ✓, **`products` ✗ (P1 — see below)** |
| SEO fields | `posts` full 6 ✓ · `projects` 3/6 · **every other collection incl. `products`: none** |
| Slug uniqueness | All slugs `unique + index` ✓ |
| Slugify hook | products/projects/posts/blog-* ✓ · **`services`, `categories` ✗** |
| Access control | Generally tight and honestly built (field-level gates on `Users.pin`, `Customers.googleId`…). Live: customers 403, orders 403 ✓ |
| Anonymous create | 3 collections: `enquiries`, `enquiry-uploads`, `customers` — and `payload.config.ts` sets **no `rateLimit`** |

## 5. Media

- Served via CMS `/api/media/file/<filename>`, absolutised by `mediaUrl()` to `NEXT_PUBLIC_CMS_URL`.
- `Media.ts` declares a 5-step 4:3 webp ladder (micro/thumb/card/pdp/zoom) — **0 of 50 live docs have any of them.** Only a legacy width-640 `card` exists; `thumbnailURL` is null on every asset.
- **Live product masters are 1536×1024 (ratio 1.50)** — they violate the 4:3/≥2400px spec the CMS now enforces on upload.

## 6. Legacy parity — `metnmat.in`

**The legacy Wix site is live, fully indexable, and self-canonical.** 160 sitemap entries (33 pages, 100 `/product-page/*`, 26 `/post/*`).

| Metric | Value |
|---|---|
| Legacy → .com same-path | **6 of 33** (`/`, `/about`, `/projects`, `/services`, `/contact`, `/shop`, `/blog`) |
| Legacy product slugs matching a `/shop/p/` slug | **12 of 100** — the other 88 → 404 |
| Legacy blog slugs on .com | **0 of 26** (new blog has 3 articles) |
| Legacy pages with no .com equivalent | 11 types incl. `/our-team`, `/our-research`, `/case-studies`, `/productinfo`, `/shipping`, 4 service-detail pages |
| Redirect map | **None on either side.** No `redirects()` in `next.config.mjs`; middleware only does apex→www 308 |

Legacy also self-cannibalises: `/home-1`, `/home-2`, `/projects-1` ("Copy of Projects"), `/shop-1`, `/services-1`, `/blank-2` all 200 + self-canonical. `/blank-1` 301s to `/terms`, **which 404s**.

## 7. Baseline — Lighthouse (live prod, 2026-07-31)

| Page | Mobile | Desktop | Mobile LCP | CLS |
|---|---|---|---|---|
| `/` | **94** | 99 | 2.8 s | 0 |
| `/shop` | **74 / 90 / 95** ⚠️ | 99 | **6.0 / 3.4 / 2.0 s** | 0 |
| `/shop/p/…` | **99** | 99 | 2.1 s | 0.001 |
| `/shop/c/electrodes` | **99** | 99 | 2.1 s | 0 |
| `/blog/co2-fuel-cells` | **98** | 100 | 2.3 s | 0 |

`/shop` was run 3× — the spread is real, caused by the `_next/image` cold-miss on the hero banner (Cloud Run's ephemeral FS doesn't persist Next's image cache). **CLS is 0 everywhere.**

## 8. Current breakage

**Suppression surface is exceptionally clean:** zero `@ts-ignore`, zero `@ts-expect-error`, zero `as any`, zero `: any`, zero `console.log` across `apps/*/src`. Both apps `strict: true` with no `ignoreBuildErrors`. Only 25 narrow single-line `eslint-disable`s, mostly `no-img-element` in the Payload admin shell.

Hydration: **one** real issue — `site-footer.tsx:164` renders `new Date().getFullYear()` in a server component, so the year freezes at build time on prerendered routes. All other `localStorage`/`window` reads were checked and are correctly post-mount.

---

## 9. Findings register

### P0 — blocks launch

| # | Finding | Evidence |
|---|---|---|
| **P0-1** | **`metnmat.in` is fully indexable and self-canonical** — direct duplicate-content and brand cannibalisation against `.com`. No noindex, no cross-domain canonical; product pages emit explicit `<meta name="robots" content="index">`. | `curl metnmat.in/robots.txt` → `Allow: /`; homepage `<link rel=canonical href="https://www.metnmat.in">` |
| **P0-2** | **No redirect map exists on either side** — 100% of legacy link equity is stranded. 88 legacy product URLs and all 26 blog posts 404 on `.com`. | No `redirects()` in `next.config.mjs`; `middleware.ts` only does apex→www |

### P1 — fix before launch

| # | Finding | Evidence |
|---|---|---|
| **P1-1** | **`products` has drafts enabled but no `_status` read gate** — an unpublished product is anonymously readable and rendered by the live shop + sitemap. Latent today (0 drafts), live the moment staff save one. | `Products.ts:20-26` `read: publicRead` + `versions:{drafts:true}` vs `Posts.ts` `publishedOnlyRead` |
| **P1-2** | **GST invoices ship without seller GSTIN or CIN** — `COMPANY_GSTIN`/`COMPANY_CIN` unset in prod. India compliance issue. | `invoice/route.ts:36,39-40`; `gcloud run services describe` shows neither |
| **P1-3** | **Image ladder doesn't exist on any live asset**; admin thumbnails all null. | `/api/media?limit=50` → non-null sizes `{"card":48}`, `thumbnailURL:null` on all |
| **P1-4** | **11 legacy page types have no `.com` equivalent** (`/our-team`, `/our-research`, `/case-studies`, 4 service-detail pages…) | curl loop → all 404 on `.com` |
| **P1-5** | **26 legacy blog posts have no counterpart** (new blog has 3, zero slug overlap) | legacy `blog-posts-sitemap.xml` = 26 `<loc>` |
| **P1-6** | **Live broken redirect on legacy**: `/blank-1` → 301 → `/terms` → **404** | `curl -I metnmat.in/blank-1` |

### P2 — major

| # | Finding |
|---|---|
| P2-1 | **ISR HTML served with browser `max-age=3600`** — defeats `/api/revalidate` for returning visitors (up to 1h stale). Added by GCP infra, not the repo. |
| P2-2 | **4 unauthenticated, unthrottled public API routes**: `/api/search`, `/api/products/resolve` (1:50 amplifier — 50 parallel CMS fetches), `/api/product-by-sku`, `/api/geo` |
| P2-3 | `/api/products` is a **live public endpoint serving placeholder stub data** with zero callers |
| P2-4 | **`products` has zero SEO fields** — no per-product title/description/canonical/OG/noindex override |
| P2-5 | `services` + `categories` slugs never normalised — a hand-typed slug can produce a broken public URL |
| P2-6 | 3 collections accept **anonymous create direct against the CMS**, bypassing the website's rate limiter (no Payload `rateLimit`) |
| P2-7 | **Duplicate Cloud Build trigger `…WExqs` still enabled** — every push builds twice |
| P2-8 | **CI is not a deploy gate** — a failing Actions run still deploys |
| P2-9 | Images deployed as mutable **`:latest`** — no commit traceability |
| P2-10 | **CMS media served with no `Cache-Control`** — conditional request on every view |
| P2-11 | Live product masters (1536×1024) **violate the spec the CMS now enforces** — re-uploading one is rejected |
| P2-12 | `images.unsplash.com` in CSP but **missing from `remotePatterns`** — 8 service photos locked out of `next/image` |
| P2-13 | Legacy site cannibalises itself — 6 indexable duplicate pages |

### P3 — minor
`/blank-1`-style auth redirects discard deep links · 11 pages without metadata · `loading.tsx` on the wrong routes · declared `revalidate` overridden by inner fetch revalidate · footer year baked at build · legacy `.eslintrc` + `next lint` (breaks on Next 16) · `apps/dashboard/scripts/` excluded from typecheck · `packages/types` has no tsconfig · dead `backend/` stub layer (`getDb()` throws) · 8 purpose-scoped internal keys all collapse to one · `CMS_LOGS_KEY` outbound-only · Turnstile vars with zero consumers · HEAD on media → 404 · `.env.example` omits ~15 real vars · all 9 globals `publicRead` incl. `commerce` · `team`/`clients` ignore their own `active` flag · `return-requests.rmaNumber` not unique/required/generated · no extra-strict TS flags.

---

## 10. Decisions required before Phase 1

1. **`metnmat.in` (P0-1/P0-2).** This is the single biggest risk and it is **not fixable from this repo** — it needs Wix-side changes. Options: (a) 301 the whole legacy domain to `.com` per-path, (b) canonical legacy → `.com` and keep it live, (c) noindex legacy. Needs your call + Wix access.
2. **Legacy content gap (P1-4/P1-5).** 11 page types + 26 blog posts don't exist on `.com`. Migrate the content, or redirect to the nearest relevant page and accept the loss?
3. **`COMPANY_GSTIN` / `COMPANY_CIN` (P1-2)** — I need the real values set as Cloud Run env vars (by you; I won't handle them).
4. **Staging.** There is none. Phases that write data can't be tested safely without it.
