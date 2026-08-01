# Caching strategy

What each route type actually does, measured against production on 2026-07-31 —
not what the code intends. Re-measure with:

```bash
curl -sI https://www.metnmat.com/<path> | grep -iE 'cache-control|x-nextjs-cache'
```

## Measured today

| Route | `Cache-Control` | Cached? |
|---|---|---|
| `/`, `/shop` | `public, max-age=3600, s-maxage=60, stale-while-revalidate=31535940` | yes (ISR) |
| `/shop/p/<slug>` | `s-maxage=60, stale-while-revalidate=31535940` | yes (ISR) |
| `/blog` | `private, no-cache, no-store, max-age=0, must-revalidate` | no — reads `searchParams` for filtering |
| `/sitemap.xml`, `/sitemaps/*.xml` | `public, max-age=3600, s-maxage=3600` | yes |
| `/api/account/*`, `/api/blog/*`, `/api/a/*` | `no-store, max-age=0` | never (correct — these set cookies) |
| `/*.{png,webp,woff2,…}` in `/public` | `public, max-age=31536000, immutable` | yes, forever |

Two things worth knowing before changing any of it:

- **The CDN clamps browser `max-age` to ~3600** regardless of what the app
  sends. `s-maxage` is the number that actually governs the edge.
- Static assets are `immutable`, so **bust them by shipping a new filename**,
  never by editing a file in place.

## Freshness: how an edit reaches the site

Every CMS fetch is tagged `cms` (`api()` in `frontend/lib/cms.ts` sets
`next: { revalidate: 60, tags: ["cms"] }`). On save, 13 collections fire
`revalidateWebsiteAfterChange`, which calls `/api/revalidate` (gated by
`INTERNAL_API_KEY`) → `revalidateTag("cms")`.

Collections wired to revalidate: Posts, Products, Projects, Services,
Categories, Faqs, Media, Team, Clients, Documents, BlogAuthors, BlogCategories,
BlogContentTypes.

So a publish invalidates the tag immediately; without the webhook the worst case
is the 60s fetch revalidate.

`generateMetadata` runs on the same render as the body and reads the same tagged
fetches, so `<title>` and the visible content update together — they cannot drift
apart.

## Deliberate exceptions

- **Sitemap children are not prerendered.** The CMS can be cold during a Cloud
  Build, and baking that snapshot once dropped the entire product list. They
  render on first request against a warm CMS, then ISR-cache for the hour. A
  CMS-backed section that comes back empty returns **503 + no-store** rather
  than a cacheable empty 200, so a transient CMS failure can never teach Google
  the section has no pages.
- **`/shop` has no `loading.tsx`.** A Suspense boundary streams the shell and
  commits HTTP 200, so a later `notFound()` renders 404 content inside a 200 —
  a soft-404. Do not add one to any route that can call `notFound()`.
- **Optimised images use `minimumCacheTTL: 31536000`.** Note this only sets
  expiry and the browser `max-age`; it does nothing for persistence. Next 15.1.6
  has no pluggable image cache (see BACKLOG), so a cold Cloud Run instance
  re-optimises from scratch.

## Why product pages need BOTH revalidate and generateStaticParams

`/shop/p/<slug>` used to be served `private, no-cache, no-store` — the busiest
pages in the catalogue re-rendered and re-fetched the CMS on every hit.

The cause was not a `force-dynamic`, a `cookies()` call or anything in the
component tree; there are none. A dynamic segment simply never enters the ISR
path unless Next knows its params at build time. **`export const revalidate`
alone is inert here** — measured, the header stayed `no-store` until
`generateStaticParams` was added as well. If you ever add another dynamic
content route, it needs both.

Freshness did not change: `api()` already cached data for 60s, and a Product
save fires `revalidateTag("cms")` which purges immediately. The 60s window is
only the fallback for a failed webhook.

`generateStaticParams` degrades to an empty list if the CMS is cold during a
build, which is exactly the pre-fix behaviour, so a build-time fetch failure
costs nothing. `dynamicParams` stays default, so a product added after the build
is served on demand and then cached.

Re-check after touching this route, because it has produced a soft-404 before:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.metnmat.com/shop/p/not-a-product  # must be 404, repeatedly
```
