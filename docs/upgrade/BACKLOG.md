# Upgrade backlog

Out-of-scope items found during a phase. Logged, not fixed (operating rule 5).

| Found in | Severity | Item | Note |
|---|---|---|---|
| Phase 0 | P3 | Dead `apps/website/src/backend/` stub layer (`getDb()` throws) | Delete with `/api/products` |
| Phase 0 | P3 | `packages/types` has no tsconfig — not typechecked by turbo | |
| Phase 0 | P3 | `apps/dashboard/scripts/` excluded from typecheck | |
| Phase 0 | P3 | Legacy `.eslintrc.json` + `next lint` | Breaks on Next 16 / ESLint 10 |
| Phase 0 | P3 | 8 purpose-scoped internal keys all fall back to `INTERNAL_API_KEY` | |
| Phase 0 | P3 | Turnstile env vars documented, zero consumers | |
| Phase 0 | P3 | `.env.example` omits ~15 vars the code reads | |
| Phase 0 | P3 | HEAD on `/api/media/file/*` returns 404 while GET returns 200 | Breaks link checkers |
| Phase 0 | P3 | `return-requests.rmaNumber` not unique/required/generated | |
| Phase 0 | P3 | `team` / `clients` ignore their own `active` flag in read access | |
| Phase 4 | P2 | 35 of 100 legacy products land on `/shop/all`, not a product | No provable equivalent in the 68-product catalogue. Closes only when the missing products are added to the CMS (decision 2) |
| Phase 4 | P3 | Redirect map depends on CMS spec labels `Body Material` vs `Body / Material` | The two mean different things (polymer vs form factor) and one product spells it `Body Mateirial`. Normalising the labels in the CMS would make the generator simpler and less fragile |
| Phase 4 | P2 | 26 legacy blog posts all land on `/blog` | Zero slug overlap with the 3 posts on `.com`. Closes when the posts are migrated (decision 2) |
| Phase 4 | P3 | `/blank-4`, `/blank-5` redirect to auth-gated `/account/orders` | Logged-out crawlers see 308→307→`/login`. Intended (they were order-tracking pages) but it is a chain |
| Phase 4 | P3 | Redirect map is a build-time snapshot of the Wix sitemaps | Regenerate via `apps/website/scripts/build-legacy-redirects.mjs` if the legacy site changes before it is retired |
| Phase 8 | P2 | `/` is the heaviest page at ~903 KiB and scores worst on mobile (73) | Hero canvas, stat band and imagery. The next lever once the maintenance banner is retired |
| Phase 8 | P3 | A custom Next `cacheHandler` does NOT cover `/_next/image` on 15.1.6 | Proven from installed source: `next-server.js` builds its own `ImageOptimizerCache` for `RouteKind.IMAGE`; both built-in handlers throw `invariant image should not be incremental-cache`. nextjs.org documents the opposite because it serves v16 docs. Do not attempt without upgrading Next |
| Phase 8 | P3 | Mobile Lighthouse here varies ±20 points run to run | `/shop` measured 63/69/82/86 inside one session. Single-run comparisons against the Phase 0 baseline are not trustworthy — compare page weight, which is stable |
| Phase 12 | P2 | CSP `script-src` still carries `unsafe-inline`; brief asks for nonces | Everything else in Phase 12 passes. Migration path: move the CSP from `next.config.mjs` headers() (static) into `middleware.ts` (per-request nonce), thread the nonce to the inline theme script in `layout.tsx` AND to every `<JsonLd>` (4+ per page — Chrome applies script-src to `application/ld+json`), and let Next nonce its own runtime. Deliberately not attempted at the end of a long session: a mistake blocks every script on every page, and the failure can be browser- or path-specific. Needs a focused session with a staged rollout |
| Phase 3 | **P1** | `/shop/p/*` and `/blog` are served `no-store` — no CDN or browser caching at all | Highest-traffic pages re-render and re-fetch the CMS on every view. Neither declares force-dynamic nor reads cookies/headers, so something deeper opts them into dynamic rendering; not yet traced. Fix shape: short `s-maxage` + `stale-while-revalidate`, relying on the existing `revalidateTag("cms")` to keep price/stock correct. See CACHING.md |
| Phase 2 | P2 | Products has no SEO field group (Posts and Projects do) | Brief asks for reusable `title`/`description`/`canonical`/`ogImage`/`noIndex`/`keywords` on every content collection. Product metadata is currently derived from name/shortDesc in code, so staff cannot override it |
| Phase 2 | P3 | Services has a slug but no drafts/versions | Posts, Products and Projects have both; Services edits go live with no draft step and no version history |
| Phase 6 | **P1** | **62 of 68 products have no image in the CMS** | Only 6 products carry a gallery. Product pages render a placeholder, `Product` schema has no `image`, and the image sitemap can only cover 6 URLs. Content gap — needs real product photography uploaded; nothing in code can fix it |
