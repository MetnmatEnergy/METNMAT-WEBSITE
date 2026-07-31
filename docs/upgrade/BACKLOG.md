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
| Phase 4 | P2 | 41 of 100 legacy products land on `/shop/all`, not a product | No provable equivalent in the 68-product catalogue. Closes only when the missing products are added to the CMS (decision 2) |
| Phase 4 | P2 | 26 legacy blog posts all land on `/blog` | Zero slug overlap with the 3 posts on `.com`. Closes when the posts are migrated (decision 2) |
| Phase 4 | P3 | `/blank-4`, `/blank-5` redirect to auth-gated `/account/orders` | Logged-out crawlers see 308→307→`/login`. Intended (they were order-tracking pages) but it is a chain |
| Phase 4 | P3 | Redirect map is a build-time snapshot of the Wix sitemaps | Regenerate via `apps/website/scripts/build-legacy-redirects.mjs` if the legacy site changes before it is retired |
