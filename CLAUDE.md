# CLAUDE.md — METNMAT platform

Facts a new session needs so it doesn't re-discover them. Keep this current.

## What this is

pnpm + turbo monorepo powering **https://www.metnmat.com** (storefront + marketing) and
**https://admin.metnmat.com** (Payload CMS). A third service, `metnmat-chatbot`, is deployed
from a separate codebase.

```
apps/website     Next.js 15.1.6 · App Router · React 19 · Tailwind
apps/dashboard   Payload CMS 3.85.1 · MongoDB · Payload admin at /admin
packages/types   shared TS types (transpiled by the website; no tsconfig of its own)
test/            vitest suites, run from the repo root
docs/upgrade/    audit, backlog and release notes for the production upgrade
```

## Commands

```bash
pnpm build        # turbo: builds both apps
pnpm typecheck    # tsc --noEmit in both apps
pnpm lint         # next lint in both apps
pnpm test         # vitest (root)
```
Per-app: `cd apps/website && npx next build|next lint|tsc --noEmit`.
Dashboard extras: `pnpm --filter dashboard generate:types|generate:importmap`.

**Gate before every commit:** typecheck + lint + build + `pnpm test`.

## Deploy

Push to `main` → **Cloud Build** → **Cloud Run** (`asia-south1`). No PR gate; GitHub Actions
`ci.yml` runs but does **not** block the deploy. Website deploys take ~3–5 min.
Images are pushed to a mutable `:latest` tag.

## Data

| | |
|---|---|
| CMS DB | MongoDB Atlas **`metnmat_cms`** |
| Chatbot DB | **`metnmat`** — *different database, do not point the CMS at it* |
| Media | Private GCS bucket via `@payloadcms/storage-gcs`, served through the CMS at `/api/media/file/<filename>` |
| Website → CMS | REST over `NEXT_PUBLIC_CMS_URL`; GraphQL is disabled |

## Gotchas (each of these has bitten before)

1. **`/metnmat` vs `/metnmat_cms`.** Pointing the CMS at `/metnmat` connects it to the *chatbot's*
   database — the shop goes empty and `depth=1` queries 500. The DB name is the whole bug.
2. **`importMap.js` must contain exactly 2 `GcsClientUploadHandler` entries.** A *running*
   `next dev` strips it to 0 and the prod CMS renders blank. Stop dev, `git checkout` the file,
   verify the count, never stage a 0.
3. **`loading.tsx` breaks 404 status codes.** A Suspense boundary streams the shell and commits
   HTTP 200, so a later `notFound()` renders 404 content inside a 200 → soft-404. This is why
   `/shop` has no `loading.tsx`.
4. **Seed runs on every boot** (`payload.config.ts` `onInit`). `pruneStale` deletes products whose
   slug isn't in the bundled catalogue, and `cleanupMalformed` deletes slug-less products.
   Products auto-generate slugs specifically to survive this.
5. **`DIRECTOR_RESET=true` deletes every staff account except the director on each deploy.** Set it
   once, then remove it.
6. **Settings globals are re-seeded on boot** — edit `seed.ts`, not the admin, for those.
7. **The CDN clamps browser `max-age` to ~3600** regardless of what the app sends.
8. **Payload only generates `imageSizes` at upload time.** Changing the ladder does not touch
   existing media.
9. **`_` -prefixed folders under `app/` are private** and produce no route — don't use them for
   throwaway test routes.
10. **Never `cat` a `.env`.** `grep '^KEY=' file` the one line you need.

## Conventions

- Product images render **only** through `frontend/components/commerce/product-image.tsx`
  (fixed 4:3, `object-fit: contain`, never `cover`).
- Structured data comes from `frontend/components/seo/json-ld.tsx`; the Organization node has a
  stable `@id` so emissions dedupe.
- Page metadata goes through `pageMetadata()` in `frontend/lib/seo.ts` — inline `metadata`
  objects silently inherit the root layout's Open Graph.
- Client-side overlays (cart rail, categories menu) close on outside click via a **capture-phase
  `pointerdown` listener that never calls `preventDefault`** — never a click-catching overlay,
  which swallows the click.
- No fabricated content. Structured data and copy must trace to a real CMS field or a real page.

## Current state

See `docs/upgrade/AUDIT.md` for the full Phase 0 audit, findings register and Lighthouse
baselines. Two P0s are open, both concerning the legacy **`metnmat.in`** site, which is still
live, fully indexable and self-canonical with no redirects to `.com`.
