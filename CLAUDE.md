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

**AWS EC2 is the only live path.** Read `deploy/README.md` before touching any of it.

Every deploy is **manual** (`workflow_dispatch`) — nothing ships on push. Three services, three
workflows, one shared instance:

| Workflow | App | Repo |
|---|---|---|
| `deploy-website-ec2.yml` | `metnmat-website` :3100 | this one |
| `deploy-cms-ec2.yml` | `metnmat-cms` :3200 | this one |
| `deploy-chatbot-ec2.yml` | `metnmat-chatbot` :3002 | `MetnmatEnergy/METNMAT-chatbot` |

All three follow the same shape: build on a GitHub runner → artifact to the private S3 bucket →
release over SSM → `pm2 reload <app>` from the ecosystem **file** (never by bare name, which
reuses the daemon's stale definition) → health check → auto-rollback, which restores the previous
release's config as well as its code.

Supporting workflows: `bootstrap-ec2.yml` (one-time server prep, Caddy config, instance role),
`preflight-aws.yml` (~50 checks before you trust anything), `reload-app.yml` (restart one app so
it re-reads Secrets Manager — secrets are fetched at **process start**, so a changed secret needs
a reload, not a rebuild), `resize-ec2.yml`, `diagnose-aws.yml`.

**Never `pm2 restart all`** — the internal command-center dashboard on :3000 belongs to a
different project and shares this instance.

⚠ **After cutover, `public_tls: true` is required on every bootstrap run that installs the Caddy
config.** Left false it stages `tls internal` over blocks currently serving real certificates. The
script now refuses to downgrade (it checks the installed block *and* Caddy's issued certificates),
but do not rely on that.

**Dead paths, kept only as records:** GCP Cloud Build/Cloud Run (project billing-disabled),
`deploy-aws.yml` (ECS/Fargate) and `infra/aws/*` — that infrastructure was deleted and **must not
be recreated**. `terraform-aws.yml` refuses `apply` for this reason; `plan`/`output` remain
available for auditing orphaned resources.

## Data

| | |
|---|---|
| CMS DB | MongoDB Atlas **`metnmat_cms`** — 53 collections, 9+ matching `src/collections/*.ts` (`audit-logs`, `blog-authors`, `analytics-events`…). Dev copy: `metnmat_cms_dev` (47). |
| Chatbot DB | **`metnmat`** — *different database, do not point the CMS at it*. 236 collections: `agent_usage`, `ai_reply_drafts`, `amazon_financial_events`, `amazon_settlement_*`. Verified by inspection 2026-08-14. |
| Media | Private S3 bucket `metnmat-media-prod` (ap-south-1) via `@payloadcms/storage-s3`, served through the CMS at `/api/media/file/<filename>`. Auth is the **EC2 instance role** — no access keys exist; setting `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` would defeat that. Selected by `STORAGE_PROVIDER=s3`, which **defaults to `gcs` when unset** — the PM2 ecosystem file and the CMS deploy workflow both set it, at run time and build time respectively. |
| Website → CMS | REST over `NEXT_PUBLIC_CMS_URL`; GraphQL is disabled |

## Gotchas (each of these has bitten before)

1. **`/metnmat` vs `/metnmat_cms`.** Pointing the CMS at `/metnmat` connects it to the *chatbot's*
   database — the shop goes empty and `depth=1` queries 500. The DB name is the whole bug.
   Re-confirmed by inspection 2026-08-14 after the opposite was asserted in good faith: `metnmat`
   holds 236 collections of `agent_usage`/`ai_reply_drafts`/`amazon_*`, while `metnmat_cms` holds 53
   that map to `src/collections/`. **It is not only a wrong read** — `seed()` runs in `onInit`, so a
   CMS booted against `/metnmat` *writes* Payload collections into the chatbot's database.
   `metnmat` already contains `_posts_versions`/`_products_versions`/`_projects_versions`, which is
   the residue of this having happened before. `deploy/bin/preflight.sh` now fails on it and prints
   the collection listing, so the question is settled by evidence rather than by argument.
2. **`importMap.js` must contain 2 `GcsClientUploadHandler` **and** 2 `S3ClientUploadHandler`
   entries.** A *running* `next dev` strips them to 0 and the prod CMS renders **blank** — the root
   admin provider becomes unresolvable, so it is not a broken upload button but a dead `/admin`.
   Both adapters are listed because `payload.config.ts` imports both and picks one at runtime.
   Stop dev, `git checkout` the file, verify with the command below, and never stage a 0:
   ```bash
   grep -c ClientUploadHandler "apps/dashboard/src/app/(payload)/admin/importMap.js"   # expect 4
   ```
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

🟢 **Live on AWS since 2026-08-20.** All three services serve publicly from the shared EC2
instance `i-0b7f49ca3e9852d4b` (t3.medium, ap-south-1, EIP `15.206.25.71`) behind Caddy with
real certificates:

| | | |
|---|---|---|
| `www.metnmat.com` | :3100 | website — apex 308s to www |
| `admin.metnmat.com` | :3200 | Payload CMS |
| `chat.metnmat.com` | :3002 | chatbot (deployed from `MetnmatEnergy/METNMAT-chatbot`) |

Port 3000 on the same instance is the internal command-center dashboard — **a different project**.
Never `pm2 restart all`; every command here names its app or uses `--only`.

GCP is fully superseded. Cloud Run, Cloud Build and `deploy-aws.yml`/`infra/aws` (ECS/Fargate)
are all dead paths — see the SUPERSEDED banner in `infra/aws/README.md`.

📷 **The media bucket is empty by decision, not by omission.** GCS media was deliberately *not*
migrated; the catalogue is being re-uploaded fresh to `s3://metnmat-media-prod`. `migrate-media.sh`
exists but is not part of the plan. Two consequences worth knowing before a bulk upload:

- **The `imageSizes` ladder is frozen at upload time** (gotcha 8). Five derivatives per image are
  generated on upload and never regenerated. Changing the ladder afterwards means re-uploading
  every asset, so settle it *before* the catalogue goes in.
- **`sharp` allocates outside the V8 heap**, so the PM2 memory caps do not bound an upload spike.
  `sharp.concurrency(1)` and a 2G swapfile exist specifically to keep a bulk upload from
  triggering the kernel OOM killer, which chooses its victim by RSS rather than by fault.

See `docs/upgrade/AUDIT.md` for the full Phase 0 audit, findings register and Lighthouse
baselines, and `deploy/README.md` for the runbook. **AUDIT.md is a dated snapshot
(2026-07-31) — several findings have since been fixed; read its "Status since this audit" section
before acting on any row.** Of its two P0s, one remains: `metnmat.in` is still live, fully
indexable and self-canonical, which splits ranking authority with the site above. The other (no
redirect map) is resolved on the side we control — `next.config.mjs` ships 122 legacy redirects
from `legacy-redirects.mjs`.
