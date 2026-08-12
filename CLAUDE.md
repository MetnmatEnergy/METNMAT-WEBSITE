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

**Migrating GCP → AWS. Both paths exist in the repo; read `deploy/README.md` before touching
either.**

*Today (GCP, currently dark):* push to `main` → **Cloud Build** → **Cloud Run** (`asia-south1`).
No PR gate; `ci.yml` runs but does **not** block. Website deploys take ~3–5 min, images pushed to
a mutable `:latest` tag. ⚠ The GCP project is **billing-disabled**, so every service 503s at the
Google Frontend while reporting healthy in the control plane, and the three Cloud Build triggers
are queued — they fire the moment billing returns.

*Target (AWS):* `deploy-website-ec2.yml` — build on a GitHub runner, artifact to private S3,
release over SSM onto the shared EC2, `pm2 reload metnmat-website`, health check, auto-rollback.
Inert until `AWS_DEPLOY_ROLE_ARN` (secret) + `EC2_INSTANCE_ID` + `ARTIFACT_BUCKET` (vars) are set.
**Never `pm2 restart all`** — the internal command-center dashboard shares that instance.

`deploy-aws.yml` (ECS/Fargate) and `infra/aws/{ecs,alb,network}.tf` are **superseded**: that
infrastructure was deleted and must not be recreated.

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
4. **Seed runs on every boot** (`payload.config.ts` `onInit`) — but it is create-if-missing, not
   sync. Staff edits survive: products are never updated once created, and every global seeds only
   when unset (hardened 2026-07-13, "catalog ownership = CMS staff"). The destructive path is
   opt-in — `SEED_PRUNE_PLACEHOLDERS=true` makes `pruneStale` delete products and categories whose
   slug isn't in the bundled catalogue. The only unconditional deletion is `cleanupMalformed`,
   which removes products with an empty or missing slug; products auto-generate slugs specifically
   to survive it.
5. **`DIRECTOR_RESET=true` deletes every staff account except the director on every boot** — not
   just on deploy, so a PM2 memory-restart triggers it too. Never leave it in server config; run it
   as a deliberate one-off. `deploy/bin/with-secrets.sh` refuses to inherit it.
6. **Globals seed only when unset**, so admin edits persist: `company`/`contact`/`social`/`seo` via
   `seedGlobalIfUnset`, and `homepage`/`navigation`/`commerce` behind their own emptiness checks.
   The corollary is what actually bites — to change a value already set on prod you need a one-shot
   migration in `seed.ts` (see `rebrandHomepageCopy`, `refineHeroHeadline`), because editing the
   seed data alone will never overwrite it.
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

🔴 **As of 2026-08-12 the production site is DOWN.** `www`, apex, `admin` and the chatbot all
return 503 from Google Frontend because GCP billing is disabled — Cloud Run reports every service
`Ready` with 100% traffic, but requests never reach a container, so control-plane health is not
evidence here. Restoring billing ends the outage *and* unblocks the media copy. Ironically the only
METNMAT site currently serving is the legacy `metnmat.in`.

⚠ **All production media is in GCS and is the only copy** (`gs://metnmat-media-prod`: product
photography, blog/project covers, datasheets, customer RFQ attachments). The project is in a
billing grace period; the S3 bucket is empty. The five derivative sizes per image are generated at
upload only and **cannot be rebuilt**. Copy procedure: `deploy/bin/migrate-media.sh`.

See `docs/upgrade/AUDIT.md` for the full Phase 0 audit, findings register and Lighthouse
baselines, and `deploy/README.md` for the migration runbook. **AUDIT.md is a dated snapshot
(2026-07-31) — several findings have since been fixed; read its "Status since this audit" section
before acting on any row.** Of its two P0s, one remains: `metnmat.in` is still live, fully
indexable and self-canonical. The other (no redirect map) is resolved on the side we control —
`next.config.mjs` now ships 122 legacy redirects from `legacy-redirects.mjs`.
