# METNMAT — AI / Developer Context (single-file brief)

> **New session? Read this file and you have everything.** It's the one-stop brief for
> understanding the project, running it locally, and shipping changes live.
> Deeper detail lives in `HANDOVER.md`, `ENVIRONMENT_VARIABLES.md`,
> `PRODUCTION_AUDIT_REPORT.md`, and `Metnmat-customer-agent-main/DEPLOY-GCP.md`.
> _Last updated: 2026-06-30._

---

## 1. What this is
**METNMAT Research & Innovations** — a production e-commerce + content website for
electrochemical hardware. **Globally used; this is the company's main site — ship carefully.**

Three independent apps, all on **Google Cloud Run**, GCP project **`metnmat-website`**,
region **`asia-south1`** (Mumbai):

| App | Source | Cloud Run service | Live URL |
|-----|--------|-------------------|----------|
| **Website** (Next.js 15 / React 19, shop+accounts+checkout) | `METNMAT-WEBSITE` monorepo → `apps/website` | `metnmat-website` | metnmat.com / www.metnmat.com |
| **Dashboard / CMS** (Payload CMS 3 on Next.js 15) | same monorepo → `apps/dashboard` | `metnmat-dashboard` | admin.metnmat.com |
| **Chatbot** (Bun + Express + Mastra + Groq) | `Metnmat-customer-agent-main` (separate, **not in git**) | `metnmat-chatbot` | chat.metnmat.com |

Monorepo: **pnpm 11.5.1 + Turborepo, Node 22**, shared pkg `@metnmat/types`.
Data: **MongoDB Atlas** (`metnmat_cms` for CMS, `metnmat` for chatbot). Media: **private GCS
bucket `metnmat-media-prod`** via Payload. Also: Resend (email), Razorpay (payments), Groq
(AI), Upstash Redis (rate-limit), Google OAuth (sign-in).
GitHub: `MetnmatEnergy/METNMAT-WEBSITE` (only the monorepo; chatbot is local-only).

Local paths: monorepo `C:\Users\ritik\OneDrive\Desktop\METNMAT` (main checkout); chatbot
`C:\Users\ritik\OneDrive\Desktop\Metnmat-customer-agent-main`. Sessions work in a git
worktree under `…\METNMAT\.claude\worktrees\<name>` on a feature branch.

---

## 2. Run it locally (safe — isolated dev DB, no prod impact)
Gitignored env files already exist: `apps/dashboard/.env` and `apps/website/.env.local`.
They point at an **isolated dev database `metnmat_cms_dev`** on the Atlas cluster (prod
`metnmat_cms` untouched), local-disk media, **email off**, **Razorpay TEST keys**, and real
Google creds. (If missing on a fresh clone, rebuild from `Metnmat-customer-agent-main/deploy/secrets.env` + the `.env.example` templates.)

```bash
pnpm install --frozen-lockfile
pnpm --filter dashboard dev   # → http://localhost:3001  (Payload; auto-seeds 68 products/20 cats/8 services on boot)
pnpm --filter website dev     # → http://localhost:3000
```
First CMS admin: create at `http://localhost:3001/admin` (dev allows first-user bootstrap).
Test card: `4111 1111 1111 1111`, any future expiry/CVV. No real charges or emails locally.

---

## 3. Ship a change to production (the workflow we use)
`gcloud` in the shell is authed (SA `metnmat-deployer@`). **`gh` is NOT installed** → merge to
`main` via git, not PR CLI. Pushing to **`main`** is what triggers the Cloud Build deploy.

```bash
# 1) work on the session's feature branch; mirror CI before merging:
pnpm --filter website typecheck && pnpm --filter website lint   # (+ dashboard, + pnpm build)
git add … && git commit -m "…" && git push                      # push the feature branch

# 2) merge branch → main (main is checked out in the MAIN dir), which auto-deploys:
DIR="/c/Users/ritik/OneDrive/Desktop/METNMAT"
git -C "$DIR" fetch origin --quiet
git -C "$DIR" merge --ff-only origin/main
git -C "$DIR" merge --no-ff origin/<feature-branch> -m "Merge: <desc>"
git -C "$DIR" push origin main          # ← triggers Cloud Build

# 3) monitor + verify:
gcloud builds list --region=global --ongoing                                  # wait until empty (triggers are GLOBAL)
gcloud run services describe metnmat-website --region=asia-south1 --format='value(status.latestReadyRevisionName)'
curl -s -o /dev/null -w '%{http_code}\n' https://www.metnmat.com/
# rollback if needed:
gcloud run services update-traffic metnmat-website --to-revisions=<REV>=100 --region=asia-south1
```
**Gotchas:** deploy is **image-only** (a NEW secret/env var needs a manual
`gcloud run services update --update-secrets=…`; a push won't add it). `NEXT_PUBLIC_*` are
baked at build. CI (GitHub Actions) and Cloud Build fire independently — a test-failing change
still deploys if the Docker build passes (no branch protection yet). Content/product/price
edits in `/admin` are live with **no deploy**.

⚠️ **Duplicate website trigger:** `metnmat-website-auto-deploy` AND
`rmgpgab-metnmat-website-…` both deploy the website → **two builds per push** (harmless,
wasteful). Disable the `rmgpgab` one to clean up — not yet done.

---

## 4. Notable feature: Google Sign-In (live as of 2026-06-30)
Server-side OAuth2 + PKCE. Website: `apps/website/src/backend/lib/google-oauth.ts` +
`src/app/api/account/google/{start,callback}/route.ts` + button on `/login`. Dashboard:
`apps/dashboard/src/collections/Customers.ts` has `googleId/authProvider/emailVerified/avatarUrl`,
`auth.useSessions:false`, and a `POST /api/customers/oauth` mint endpoint (internal-key gated,
**auto-links by verified email**). Prod secrets `GOOGLE_CLIENT_ID/SECRET` (+ recommended
`CMS_OAUTH_KEY`) are in Secret Manager on `metnmat-website`.
**Pending:** confirm a live consent click works — the Google OAuth client must list
`https://www.metnmat.com/api/account/google/callback` as an Authorized redirect URI (Console →
Credentials). If a real sign-in shows `redirect_uri_mismatch`, that URI is missing.

---

## 5. Current state & open items (2026-06-30)
- **Live & healthy:** Google Sign-In (configured), shop banner carousel (5 uniform 1600×680
  WebP, `apps/website/public/site/shop-banner-1..5.webp`, component
  `src/frontend/components/commerce/shop-showcase.tsx`). `main` ≈ commit `47cb877`,
  website rev ~`00087`, dashboard rev ~`00043`.
- **Optional / not done:** confirm live Google consent (§4); disable the duplicate build
  trigger (§3); SEO / a11y / performance fixes from the audit (catalogued in
  `PRODUCTION_AUDIT_REPORT.md` and the chat history) — available on request.
- **Secrets** live only in gitignored `.env`/`secrets.env` files + GCP Secret Manager —
  never in code or this file.

---

## 6. How to use me next session
Just say what you want changed ("add X", "fix Y"). I'll: understand the codebase from this
file + auto-loaded memory, build it on a branch, run it locally against the dev DB to verify,
then on your go merge to `main` so it deploys to production via Cloud Build / GitHub.
