# METNMAT — Project Handover & Deployment Guide

Handover document for **METNMAT Research & Innovations** — production website, admin
dashboard (CMS), and AI customer-support chatbot.

> **Audience:** the engineering team that will own and deploy this project.
> Everything needed to run it in production is in this document. No prior context required.
>
> **Production runs entirely on Google Cloud Run** (project `metnmat-website`, region
> `asia-south1` / Mumbai). The step-by-step infra runbook is `DEPLOY-GCP.md` in the
> chatbot repo (`Metnmat-customer-agent-main/DEPLOY-GCP.md`); this file is the high-level
> map. Full env-var reference: `ENVIRONMENT_VARIABLES.md`.

---

## 1. What this project is

Three independent applications plus external services.

```
3 codebases                              External services (production)
─────────────────────────────────       ──────────────────────────────────
1. Website   — public marketing + shop   • MongoDB Atlas         — database
2. Dashboard — admin CMS (Payload)        • Google Cloud Storage  — media/assets (private bucket)
3. Chatbot   — AI customer agent          • Resend                — transactional email
                                          • Groq                  — chatbot AI model
                                          • Razorpay              — payments
                                          • Upstash Redis         — rate-limit store
```

> **Note:** Supabase Storage was used during early development only. **Production media
> lives in a private GCS bucket** (`metnmat-media-prod`), served through Payload at
> `admin.metnmat.com/api/media/file/…`. The Supabase keys are migration-only, never deployed.

### How they connect

```
                ┌──────────────── WEBSITE (Next.js) ────────────────┐
   visitor ───▶ │  content/images ──▶ Dashboard (CMS)               │
                │  chat bubble    ──▶ Chatbot (/widget.js)          │
                │  quote/order    ──▶ Resend (email) · Razorpay (pay)│
                └───────────────────────────────────────────────────┘
   DASHBOARD ──▶ MongoDB Atlas (metnmat_cms) + GCS (media)
   CHATBOT   ──▶ MongoDB Atlas (metnmat)     + Groq (AI)
```

The three apps are **separate Cloud Run services**. They communicate over HTTPS via URLs
only — they are **never** merged into one folder or one deployment.

### Live URLs

| Service | Cloud Run service | Public domain |
|---|---|---|
| Website | `metnmat-website` | `metnmat.com` / `www.metnmat.com` |
| Dashboard (CMS) | `metnmat-dashboard` | `admin.metnmat.com` |
| Chatbot | `metnmat-chatbot` | `chat.metnmat.com` |

---

## 2. Source code locations

| App | Repo / folder | Framework | Local port |
|-----|---------------|-----------|-----------|
| **Website** | `METNMAT-WEBSITE` monorepo → `apps/website` | Next.js 15 / React 19 | 3000 |
| **Dashboard (CMS)** | `METNMAT-WEBSITE` monorepo → `apps/dashboard` | Next.js 15 + Payload CMS 3 | 3001 |
| **Chatbot** | `Metnmat-customer-agent-main` (separate repo) | Bun + Express + Mastra | 3002 (3001 default) |

- The **website + dashboard** live in one **pnpm monorepo** (`METNMAT-WEBSITE` on GitHub:
  `MetnmatEnergy/METNMAT-WEBSITE`), managed by Turborepo.
- The **chatbot** is a **separate repository** (its own `package.json`, Bun runtime, and
  `deploy/` scripts).
  - ⚠️ **The chatbot is currently NOT under git version control.** Initialise it and push it
    to the company GitHub org before relying on it in production — there is no history or
    rollback today, and it holds live secrets on disk. (See `PRODUCTION_AUDIT_REPORT.md`
    DEVOPS-01.)

---

## 3. Prerequisites (for whoever builds/deploys)

- **Node.js** ≥ 20 (developed on 22.x)
- **pnpm** 11.5.1 (`npm i -g pnpm@11.5.1`) — for the monorepo
- **Bun** ≥ 1.2 (`https://bun.sh`) — for the chatbot
- **Google Cloud SDK** (`gcloud`) + access to the `metnmat-website` GCP project (billing enabled)
- Accounts (company-owned): GitHub, GCP, MongoDB Atlas, Resend, Groq, Razorpay, Upstash

---

## 4. How deployment works (CI/CD)

Production is **Google Cloud Run**. Images are built by **Cloud Build**, stored in
**Artifact Registry** (`asia-south1-docker.pkg.dev/metnmat-website/metnmat/…`), with
secrets in **Secret Manager** and a dedicated least-privilege runtime service account
(`payload-storage-sa`).

There are **three deploy paths — know which one applies:**

### Path A — GitHub Actions CI (quality gate, NOT a deploy)
`.github/workflows/ci.yml` runs `lint → typecheck → test → build` on every push to `main`
and every PR. **It does not deploy.** It only tells you whether the code is healthy.

### Path B — Cloud Build push-to-`main` triggers (auto-deploy: website + dashboard)
On every push to `main`, Cloud Build triggers build the image and `gcloud run deploy` it:

| Trigger | Config file | Service |
|---|---|---|
| `metnmat-website-auto-deploy` | `cloudbuild.website.deploy.yaml` | `metnmat-website` |
| `rmgpgab-metnmat-dashboard-…` | `cloudbuild.dashboard.deploy.yaml` | `metnmat-dashboard` |

- The deploy is **image-only**: env vars, secrets, and the runtime service account are
  **inherited** from the existing service. **Adding a new env var or secret is NOT picked up
  by a push** — you must run `gcloud run services update …` (or the deploy script) once.
- `NEXT_PUBLIC_*` values are **baked into the website image at build time** (client bundle +
  CSP headers). Changing a public URL requires a rebuild with new `--build-arg`, not just a
  Cloud Run env change. The trigger hard-codes the production domains, so this only matters
  if domains change.
- ⚠️ **Known cleanup item:** a second, auto-generated "Deploy to Cloud Run" trigger
  (`rmgpgab-metnmat-website-…`, no config file → builds the root `Dockerfile`) **also**
  deploys the website on every push. So today **two triggers race to deploy the website**.
  Both build a correct image, but it doubles build minutes and the winning revision is
  nondeterministic. **Fix:** disable one of the two (keep `metnmat-website-auto-deploy`):
  `gcloud builds triggers update rmgpgab-metnmat-website-asia-south1-MetnmatEnergy-METNMAT-WExqs --region=global` … or delete it in Cloud Console → Cloud Build → Triggers.

### Path C — Manual script (the chatbot, and break-glass for all three)
`Metnmat-customer-agent-main/deploy/deploy-gcp.ps1` is the idempotent one-shot that can
build + deploy any/all services, push secrets, create infra, and map domains. **The chatbot
only goes live this way** (it has no auto-deploy trigger).

```powershell
cd C:\Users\ritik\OneDrive\Desktop\Metnmat-customer-agent-main\deploy
.\deploy-gcp.ps1 -Only chatbot      # build + deploy just the chatbot
.\deploy-gcp.ps1 -SkipBuild         # redeploy existing images (config/secret change)
.\deploy-gcp.ps1                     # full build + deploy of all three
```

### Branch protection (do this — see §10)
Because Path A (CI) and Path B (deploy) fire **independently**, a change that fails lint or
tests **still deploys** as long as its Docker build succeeds. Protect `main` so nothing
merges red. Setup steps in §10.

---

## 5. Shipping a change safely (runbook)

**Website / dashboard code change:**
1. Branch off `main`; make the change.
2. Locally mirror CI: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
3. Open a PR; let GitHub Actions CI go green.
4. Merge to `main` → Cloud Build auto-builds & deploys (~5–15 min).
5. Watch it: `gcloud builds list --region=global --limit=5`.
6. Smoke-test the live URL.
7. **Rollback if needed** (instant, no rebuild):
   `gcloud run services update-traffic metnmat-website --to-revisions=<PREV_REVISION>=100 --region=asia-south1`
   (list revisions: `gcloud run revisions list --service=metnmat-website --region=asia-south1`).
8. If you **added a secret/env var**, attach it once with `gcloud run services update` — the push alone won't apply it.

**Chatbot code change:** edit → `./deploy-gcp.ps1 -Only chatbot`. (Commit it to git first.)

**Content / product / price change (no code):** edit in `admin.metnmat.com` → live
immediately, **no deploy** (Payload writes to Mongo; the website reads it).

---

## 6. Environment variables

The full, authoritative list is in **`ENVIRONMENT_VARIABLES.md`**. In production these come
from **GCP Secret Manager** (referenced via `--set-secrets` on Cloud Run), never on-disk
`.env` files. Summary of where each app's values live:

- **Website** (`metnmat-website`): `INTERNAL_API_KEY`, `RAZORPAY_*`, `RESEND_API_KEY`,
  `QUOTE_*`, `OPEN_EXCHANGE_RATES_APP_ID`, `UPSTASH_REDIS_REST_*`. `NEXT_PUBLIC_*` are
  build-time args. `INTERNAL_API_KEY` **must match the dashboard's**.
- **Dashboard** (`metnmat-dashboard`): `MONGODB_URI`, `PAYLOAD_SECRET`, `PAYLOAD_PIN_PEPPER`,
  `INTERNAL_API_KEY`, `GCS_BUCKET`/`GCS_PROJECT_ID`, `CMS_URL`, `WEBSITE_URL`, `RESEND_API_KEY`.
- **Chatbot** (`metnmat-chatbot`): `MONGODB_URI`, `GROQ_API_KEY`, `JWT_SECRET`,
  `ALLOWED_ORIGINS`, `PUBLIC_URL`, `UPSTASH_REDIS_REST_*`, `Meta_WA_*`.

> Every value that ever lived in an OneDrive-synced `.env` / `secrets.env` must be **rotated**
> (see `PRODUCTION_AUDIT_REPORT.md` and `ENVIRONMENT_VARIABLES.md`).

---

## 7. Post-deploy verification checklist

- [ ] All three Cloud Run services return HTTP 200 (`gcloud run services list --region=asia-south1`).
- [ ] Dashboard `/admin` loads; you can log in; products / categories present.
- [ ] Website loads; product pages show images (proves Website→Dashboard→GCS link).
- [ ] Submit a quote/order → confirmation email arrives (proves Resend).
- [ ] Money path: shop → cart → checkout → pay (Razorpay) → confirmation.
- [ ] Chatbot `/health` returns `ready`; chat bubble appears bottom-right on the website.
- [ ] Send the bot "what products do you sell?" → real product answer (proves Groq + Mongo).
- [ ] `INTERNAL_API_KEY` is identical in website and dashboard.
- [ ] All "public URL" env vars / build-args point to the real domains, not localhost.

---

## 8. Known constraints & production notes

- **Image-only auto-deploy** — see §4 Path B. New secrets/env vars need a one-time `gcloud run services update`.
- **Two website triggers race** — see §4; disable the duplicate.
- **Chatbot is not in git** — no rollback/history; `git init` + push to the company org (DEVOPS-01).
- **`PAYLOAD_PIN_PEPPER = 5970`** — deliberately weak so staff PIN logins keep working; an
  accepted risk. Schedule the strong-pepper + PIN-re-save migration in a maintenance window
  (`PRODUCTION_AUDIT_REPORT.md` §3).
- **Groq tier limits** — upgrade to a paid tier before heavy traffic (`console.groq.com/settings/billing`).
- **MongoDB Atlas Network Access** must allow Cloud Run egress (`0.0.0.0/0` is simplest; or use the project's egress IPs).
- **Rollback** is per-service via Cloud Run revisions (§5 step 7) — Cloud Run retains old revisions.

---

## 9. Credentials handover (do NOT commit)

Provide the company a **separate secure document** (password manager / sealed doc) with the
real values for every variable in `ENVIRONMENT_VARIABLES.md`, plus logins for GCP, MongoDB
Atlas, Resend, Groq, Razorpay, Upstash, and GitHub. Then:

1. **🔑 Rotate every key** — all dev keys were used during development and must be regenerated, then loaded into Secret Manager.
2. **👤 Transfer account ownership** to a company email for every external service and GitHub.
3. **🗑️ Revoke** personal access once the company confirms everything works.

---

## 10. Day-2 operations

- **Edit site content / products / prices:** Dashboard `/admin` — live, no redeploy.
- **After website/dashboard *code* changes:** merge to `main` → auto-deploys (§5).
- **After chatbot changes:** `./deploy-gcp.ps1 -Only chatbot` (§4 Path C).
- **Logs:** `gcloud run services logs read <service> --region=asia-south1 --limit=100`.
- **Builds:** `gcloud builds list --region=global --limit=10` (and `gcloud builds log <ID>`).
- **Rollback:** §5 step 7.

### Enable branch protection on `main` (GitHub UI — one-time)
1. GitHub → repo **Settings → Branches → Add branch ruleset** (or *Add rule*) for `main`.
2. Enable **Require a pull request before merging**.
3. Enable **Require status checks to pass before merging** → select the **`build`** check
   (from `.github/workflows/ci.yml`).
4. Enable **Require branches to be up to date before merging**.
5. (Recommended) **Do not allow bypassing** / include administrators.

This makes the CI gate (§4 Path A) actually block bad code from reaching `main`, and
therefore from auto-deploying.

---

*Source of truth for deployment: this file + `DEPLOY-GCP.md` + `ENVIRONMENT_VARIABLES.md`.
Keep them updated as the system evolves.*
