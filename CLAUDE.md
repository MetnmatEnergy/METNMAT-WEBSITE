# CLAUDE.md — METNMAT platform

Facts a new session needs so it doesn't re-discover them. Keep this current.

## What this is

pnpm + turbo monorepo powering **https://www.metnmat.com** (storefront + marketing) and
**https://admin.metnmat.com** (Payload CMS). A third service, `metnmat-chatbot`, is deployed
from a separate codebase.

```
apps/website     Next.js 15.5 · App Router · React 19 · Tailwind
apps/dashboard   Payload CMS 3.89 on Next 16 (webpack build, see Deploy) · MongoDB · admin at /admin
packages/types   shared TS types (transpiled by the website; no tsconfig of its own)
test/            vitest suites, run from the repo root
deploy/v2/       the production host: systemd units, secret fetcher, release script, Caddy, nftables
docs/upgrade/    audit, backlog and release notes for the production upgrade
docs/incident/   the 2026-09 React2Shell compromise: investigation, runbook, credential checklist
```

## Commands

```bash
pnpm build        # turbo: builds both apps
pnpm typecheck    # tsc --noEmit in both apps
pnpm lint         # next lint (website) + flat-config eslint (CMS; Next 16 dropped `next lint`)
pnpm test         # vitest (root)
```
Per-app: `cd apps/website && npx next build|next lint|tsc --noEmit`.
Dashboard extras: `pnpm --filter dashboard generate:types|generate:importmap`.

**Gate before every commit:** typecheck + lint + build + `pnpm test`.

## Deploy

**The v2 host on AWS EC2 is the only live path.** Read `deploy/v2/README.md` before touching any
of it. The host was rebuilt from `deploy/v2` after the September 2026 React2Shell compromise
(`docs/incident/2026-09-react2shell/`): four apps, four Linux users (`mm-web`, `mm-cms`, `mm-chat`,
`mm-cc`), four hardened systemd units, one Secrets Manager entry per app, root-owned releases, no
SSH (Session Manager only), **no PM2, no `.env` files on disk**.

⚠ **The two are not triggered the same way, and assuming they are wastes a debugging session.**

| | Website | CMS |
|---|---|---|
| On push to `main` | **auto-deploys** (`deploy-web.yml`) when `apps/website/**`, `packages/**`, `deploy/v2/**` or the lockfiles change | never |
| Manual | `gh workflow run deploy-web.yml --ref main` | **the only way:** `gh workflow run deploy-cms.yml --ref main -f sha=<sha>` |

So a push that changes CMS code ships nothing. A CMS change — including anything in `seed.ts`,
which is what moves categories and globals — reaches production **only** when someone dispatches
*Deploy CMS (v2 host)* by hand. A merge that touches both apps is **two deploys, website first**;
run the CMS one straight after, or the website shows new behaviour against the old CMS, which
looks like a caching bug and is not one. (The enquiries fix of 2026-09-17 was exactly this shape:
the website rendered its new error state for the minutes until the CMS caught up.)

Three services, three workflows, one shared instance:

| Workflow | Unit · user · port | Repo |
|---|---|---|
| `deploy-web.yml` — *Deploy website (v2 host)* | `metnmat-web.service` · `mm-web` · :3100 | this one |
| `deploy-cms.yml` — *Deploy CMS (v2 host)* | `metnmat-cms.service` · `mm-cms` · :3200 | this one |
| `deploy-chatbot.yml` — *Deploy chatbot (v2 host)* | `metnmat-chat.service` · `mm-chat` · :3002 | `MetnmatEnergy/METNMAT-chatbot` |

The Command Center (`metnmat-cc.service` · `mm-cc` · :3000, `command-center.metnmat.com`) is a
**different project** (`MetnmatEnergy/Metnmat_Dashboard`, private) on the same instance.

All three follow the same shape: build on a GitHub runner (OIDC role `metnmat-github-deploy`,
deliberately no static keys) → `<app>-build.tgz` + `.sha256` to
`s3://metnmat-deploy-artifacts-976134557584/<app>/<sha>/` → `ssm send-command` runs
`/usr/local/sbin/metnmat-release <app> <sha>` as root → checksum → symlink swap →
`systemctl restart` → health check → auto-rollback to the previous release. The workflows guard on
repo variables `PROD_INSTANCE_ID` and `ARTIFACT_BUCKET` and secret `AWS_DEPLOY_ROLE_ARN`; `deploy-cms.yml`
takes an optional `sha` input (blank = HEAD of the ref).

**The CMS build must be webpack** (`next build --webpack`, which the dashboard's `build` script
already is). A Turbopack bundle passes `/api/health` and then 500s every page inside the
`pnpm deploy --legacy` release, because Next 16 Turbopack emits hashed externals that do not
resolve there. `deploy-cms.yml` also refuses Next < 16 and an `importMap.js` without its 4
upload-handler entries (gotcha 2).

Secrets are fetched at **process start**: `metnmat-fetch-secrets <app>` (root, `ExecStartPre`)
reads the one JSON secret `metnmat/<app>/env` into tmpfs `/run/metnmat/<app>.env`, and the app
never holds AWS credentials. A changed secret needs `systemctl restart metnmat-<app>` over SSM, not
a rebuild. `deploy/v2/etc/<app>.required` lists the keys the fetcher must find, or it refuses to
start the unit. Logs: `journalctl -u metnmat-<app>`. There is no "restart all" — every command
names its unit.

Supporting workflows: `bootstrap-host.yml` (idempotent host prep over SSM: units, Caddyfile,
nftables, secret fetcher; never touches release directories; creating the instance itself is
`deploy/v2/aws/launch-instance.sh`), `preflight-aws.yml` and `diagnose-aws.yml` (read-only checks
that run in CI so no laptop needs AWS keys), `resize-ec2.yml` (a 2-4 minute outage for every app;
its PM2 precondition predates v2, so re-read it before relying on it), `terraform-aws.yml`
(`plan`/`output` only).

**Never touch the old host.** `i-0b7f49ca3e9852d4b` (EIP `15.206.25.71`) is the compromised
instance, stopped in quarantine SG `sg-0890559606eea14f8`. Do not start it, and do not reuse any
value that ever lived on it (`docs/incident/2026-09-react2shell/07-credential-checklist.md` is
the register of what was burned and what replaced it).

**Dead paths, kept only as records:** `deploy/README.md` and `deploy/bin/*` (the pre-incident
PM2 + `with-secrets.sh` layout; `with-secrets.sh` is deleted, `preflight.sh` is still run by
`preflight-aws.yml`), GCP Cloud Build/Cloud Run (project billing-disabled), `deploy-aws.yml`
(ECS/Fargate) and `infra/aws/*` — that infrastructure was deleted and **must not be recreated**.
`terraform-aws.yml` refuses `apply` for this reason; `plan`/`output` remain available for
auditing orphaned resources.

## Data

| | |
|---|---|
| CMS DB | MongoDB Atlas **`metnmat_cms`** — 53 collections, 9+ matching `src/collections/*.ts` (`audit-logs`, `blog-authors`, `analytics-events`…). Dev copy: `metnmat_cms_dev` (47). |
| Chatbot DB | **`metnmat`** — *different database, do not point the CMS at it*. 236 collections: `agent_usage`, `ai_reply_drafts`, `amazon_financial_events`, `amazon_settlement_*`. Verified by inspection 2026-08-14. |
| Media | Private S3 bucket `metnmat-media-prod` (ap-south-1) via `@payloadcms/storage-s3`, served through the CMS at `/api/media/file/<filename>`. Auth is the dedicated IAM user **`metnmat-cms-media`** (bucket-only policy, `deploy/v2/aws/cms-media-user-policy.json`) whose `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` live inside `metnmat/cms/env` and nowhere else; the instance role deliberately has **no** media access, so a compromised app cannot reach the bucket through the metadata service (v2 isolation layer 5). Selected by `STORAGE_PROVIDER=s3`, which **defaults to `gcs` when unset** — `deploy/v2/etc/cms.conf` and the CMS deploy workflow both set it, at run time and build time respectively. |
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
   just on deploy, so a systemd restart (a `MemoryMax` kill, a reboot, a secret reload) triggers it
   too. Never leave it in `metnmat/cms/env`; set it, restart the unit once, remove it, restart again.
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
11. **"Invalid key" for the right PIN means the stored credential is out of step, not a typo.**
    A staff password is `HMAC(PAYLOAD_PIN_PEPPER, pin)`; the account is found by `pinLookup`. The
    two can disagree — a pepper rotation (Sept 2026) or a PIN edit made before `hooks/pin-credential.ts`
    leaves the lookup current and the hash stale, and sign-in then fails identically to a wrong PIN.
    Boot now repairs this (`resyncStaffCredentials` + `decideDirectorCredential`, 2026-09-19): it
    verifies each hash against the PIN its lookup encodes and re-derives when they disagree; the
    director is repaired from `DIRECTOR_PIN` even after a rotation. **Changing `DIRECTOR_PIN` in
    Secrets Manager is honoured on the next CMS restart** (`cms_bootstrap_state` records which value
    was last applied, so a secret change is told apart from a PIN the director set in the UI, which
    is preserved). Accounts whose lookup predates the pepper are logged as unreachable — a
    super-admin sets them a new PIN. There is **no
    `admin@metnmat.com`**: the director is the `DIRECTOR_EMAIL` in `metnmat/cms/env`, and the
    email/password form only works for accounts created without a PIN. Five misses from one IP pause
    PIN sign-in for 15 minutes (`pin_login_throttle`); the login screen shows the countdown.
11. **The quote form's Turnstile is two halves in two places.** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
    is a GitHub repository *variable* inlined at **build** time by `deploy-web.yml`;
    `TURNSTILE_SECRET_KEY` is runtime, in `metnmat/web/env`. With the secret set, `/api/quote`
    refuses every submission that has no valid token — so setting the secret without rebuilding
    with the site key locks every visitor out of the form. Set both or neither; `instrumentation.ts`
    logs the mismatch at boot. Without either, the form falls back to a signed timing token from
    `/api/quote/token` (`backend/lib/form-guard.ts`). The "Thank you" auto-reply is separately
    budgeted (2 per address per day, 5 per IP per hour) and withheld for addresses that fail
    syntax or have no mail server — the enquiry is still filed and sales still notified, tagged
    `[possible spam]`.

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
- Internal-key reads of customer-keyed data return a `where` constraint, never `true`. The
  website server reads `enquiries` only through `?where[email][equals]=<one address>`
  (`internalOwnEmailOrManageSales`, shape check in `lib/own-email-scope.ts`), so a leaked key
  cannot list the collection. The website helper treats a non-2xx as an error result, not an
  empty list, because a 403 on every request once hid for months as "no quote requests yet".

## Current state

🟢 **Live on the rebuilt v2 host since 2026-09-16/17.** The original AWS host (live from
2026-08-20) was compromised through React2Shell — exploited from 2026-08-13, found 2026-09-14 —
and every secret it held was treated as burned (`docs/incident/2026-09-react2shell/`). All four
services now serve publicly from the replacement instance `i-0b446863ec28109b0` (t3.medium,
ap-south-1, EIP `52.66.54.7`, AL2023, IMDSv2, no SSH) behind Caddy with real certificates:

| | | |
|---|---|---|
| `www.metnmat.com` | :3100 | website — apex 308s to www (`deploy-web.yml`, CI deploys verified 2026-09-17) |
| `admin.metnmat.com` | :3200 | Payload CMS (`deploy-cms.yml`; first CI deploy landed 2026-09-17) |
| `chat.metnmat.com` | :3002 | chatbot (`MetnmatEnergy/METNMAT-chatbot`; chat models on DeepSeek since PR #2, same account as the Command Center; `DEEPSEEK_API_KEY` in `metnmat/chat/env`) |
| `command-center.metnmat.com` | :3000 | Command Center — **a different project** (`MetnmatEnergy/Metnmat_Dashboard`) |

Website and CMS are credential-complete (Resend, Razorpay live, Google sign-in, internal keys).
Still open per `docs/incident/2026-09-react2shell/07-credential-checklist.md`: the Command
Center's third-party keys (Gmail first) and billing for the chatbot's LLM.

GCP is fully superseded. Cloud Run, Cloud Build and `deploy-aws.yml`/`infra/aws` (ECS/Fargate)
are all dead paths — see the SUPERSEDED banner in `infra/aws/README.md`.

📷 **The media bucket is empty by decision, not by omission.** GCS media was deliberately *not*
migrated; the catalogue is being re-uploaded fresh to `s3://metnmat-media-prod`. `migrate-media.sh`
exists but is not part of the plan. Two consequences worth knowing before a bulk upload:

- **The `imageSizes` ladder is frozen at upload time** (gotcha 8). Five derivatives per image are
  generated on upload and never regenerated. Changing the ladder afterwards means re-uploading
  every asset, so settle it *before* the catalogue goes in.
- Full procedure, including the naming convention and the database guards:
  `docs/CATALOGUE.md`.
- **`sharp` allocates outside the V8 heap**, so the CMS unit's `MemoryMax` (1200M) is what bounds
  an upload spike, and hitting it restarts the unit (which re-runs the seed, gotcha 4).
  `sharp.concurrency(1)` exists specifically to keep a bulk upload from that; the old host also
  carried a 2G swapfile for it — check the v2 host has one before a bulk upload.

See `docs/upgrade/AUDIT.md` for the full Phase 0 audit, findings register and Lighthouse
baselines, and `deploy/README.md` for the runbook. **AUDIT.md is a dated snapshot
(2026-07-31) — several findings have since been fixed; read its "Status since this audit" section
before acting on any row.** Of its two P0s, one remains: `metnmat.in` is still live, fully
indexable and self-canonical, which splits ranking authority with the site above. The other (no
redirect map) is resolved on the side we control — `next.config.mjs` ships 122 legacy redirects
from `legacy-redirects.mjs`.
