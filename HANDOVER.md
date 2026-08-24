# METNMAT — Project Handover & Deployment Guide

Handover document for **METNMAT Research & Innovations** — production website, admin
dashboard (CMS), and AI customer-support chatbot.

> **Audience:** the engineering team that will own and deploy this project.
> No prior context required.
>
> **Production runs on a single AWS EC2 instance** in `ap-south-1` (Mumbai), behind Caddy.
> Migrated off Google Cloud Run on **2026-08-20**; GCP is dead and must not be revived.
> Deep detail lives in [`CLAUDE.md`](CLAUDE.md) (gotchas, data model) and
> [`deploy/README.md`](deploy/README.md) (runbook). Env reference:
> [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md).

---

## 1. What this project is

Three applications plus external services.

```
3 codebases                              External services (production)
─────────────────────────────────        ──────────────────────────────────
1. Website   — public marketing + shop   • MongoDB Atlas    — database
2. Dashboard — admin CMS (Payload)       • AWS S3           — media (private bucket)
3. Chatbot   — AI customer agent         • Resend           — transactional email
                                         • Razorpay         — payments
                                         • OpenAI           — chat + embeddings
                                         • Pinecone         — vector search
                                         • Upstash Redis    — rate limiting
```

### How they connect

The website never talks to MongoDB. It reads the CMS over REST (`NEXT_PUBLIC_CMS_URL`);
GraphQL is disabled. Media is uploaded to S3 by the CMS and served back through the CMS at
`/api/media/file/<filename>`. The chatbot is independent of both and uses its **own database**.

### Live URLs and the shared instance

Everything runs on **one** box: `i-0b7f49ca3e9852d4b` · t3.medium · `ap-south-1` ·
Elastic IP `15.206.25.71` · AWS account `976134557584`. Caddy terminates TLS and routes by
hostname.

| Port | PM2 process | Public domain |
|---|---|---|
| 3100 | `metnmat-website` | `www.metnmat.com` (apex 308s to `www`) |
| 3200 | `metnmat-cms` | `admin.metnmat.com` |
| 3002 | `metnmat-chatbot` | `chat.metnmat.com` |
| 3000 | `metnmat-dashboard` | ⚠️ **internal command-center — a DIFFERENT project** |

> ### 🚨 Never run `pm2 restart all`
> Port 3000 hosts an unrelated internal tool that shares this instance. Every command in this
> repository names its process explicitly or uses `--only`. Keep it that way.

---

## 2. Source code locations

| App | Repo / folder | Framework | Local port |
|-----|---------------|-----------|-----------|
| **Website** | `MetnmatEnergy/METNMAT-WEBSITE` → `apps/website` | Next.js 15 / React 19 | 3000 |
| **Dashboard (CMS)** | same monorepo → `apps/dashboard` | Next.js 15 + Payload CMS 3 | 3001 |
| **Chatbot** | `MetnmatEnergy/METNMAT-chatbot` | Bun + Express + Mastra | 3002 |

Website + dashboard share one **pnpm 11.5.1 + Turborepo** monorepo. The chatbot is a separate
repository with its own Bun runtime and its own deploy workflow — it is now under git with full
history (this was an open audit item and is closed).

---

## 3. Prerequisites

- **Node.js** ≥ 20 (developed on 22.x) and **pnpm** 11.5.1 — monorepo
- **Bun** ≥ 1.3 — chatbot (installed per-user on the instance at `~/.bun`)
- **AWS access** to account `976134557584` — for Secrets Manager and SSM, not for deploying
- Company-owned accounts: GitHub, AWS, MongoDB Atlas, Resend, OpenAI, Pinecone, Razorpay, Upstash

You do **not** need SSH. All instance access is via **AWS Systems Manager (SSM)**, so there is no
key to distribute or rotate and no port 22 exposed.

---

## 4. How deployment works

**Every deploy is manual.** Nothing ships on push — `workflow_dispatch` only. This is deliberate:
one instance serves four applications, including one that belongs to another team.

| Workflow | What it deploys | Repo |
|---|---|---|
| `deploy-website-ec2.yml` | website | this one |
| `deploy-cms-ec2.yml` | CMS | this one |
| `deploy-chatbot-ec2.yml` | chatbot | `METNMAT-chatbot` |

All three follow the same shape:

```
build on a GitHub runner → upload artifact to private S3 → release over SSM
  → pm2 reload <app> from the ecosystem FILE → health check → auto-rollback on failure
```

Releases are timestamped directories with a `current` symlink, so rollback is a symlink swap and
does not rebuild. **Rollback restores the previous release's configuration as well as its code** —
an earlier version restored only code and silently reintroduced a fixed bug.

`ci.yml` runs lint → typecheck → test → build on pushes and PRs. It is a **quality gate, not a
deploy**, and does not currently block merges (see §10).

### Supporting workflows

| Workflow | Use |
|---|---|
| `preflight-aws.yml` | ~50 checks across IAM, secrets, instance, Caddy, DB, memory. **Run this first when anything looks wrong.** |
| `bootstrap-ec2.yml` | One-time server prep: directories, swap, PM2 boot persistence, Caddy config, instance role |
| `reload-app.yml` | Restart one app so it re-reads Secrets Manager |
| `resize-ec2.yml` | Change instance type |
| `diagnose-aws.yml` | Broad read-only AWS inventory |

⚠️ **`bootstrap-ec2.yml` requires `public_tls: true` on every run that installs the Caddy config.**
Left false it stages `tls internal` over site blocks currently serving real certificates. The
script now refuses to downgrade, but do not rely on that.

### Superseded — do not use

`deploy-aws.yml` (ECS/Fargate) and `infra/aws/*` describe infrastructure that **was deleted**.
Applying that Terraform would build a second, parallel copy of the platform and collide with the
live one. `terraform-aws.yml` refuses `apply`; `plan` and `output` still work, because those files
are the only record of what a cancelled 2026-08-10 apply created and are what an orphaned-resource
audit reads. GCP Cloud Build / Cloud Run are likewise dead (project billing disabled).

---

## 5. Shipping a change safely

**Website / CMS code change:**

1. Branch off `main` and make the change.
2. Mirror CI locally — this is the only gate between an edit and production:
   ```bash
   pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```
3. Open a PR, let CI go green, merge to `main`.
4. **Run the deploy workflow manually** (Actions → *Deploy website to EC2* / *Deploy CMS to EC2*).
5. Smoke-test the live URL.
6. **Rollback:** automatic on a failed health check. To roll back a *healthy but wrong* release,
   re-run the deploy workflow against the previous commit.

**Chatbot:** same, from the `METNMAT-chatbot` repo.

**Changed a secret?** Secrets are read at **process start**, not build time — so run
`reload-app.yml`, not a rebuild. A rebuild would take fifteen minutes to produce a byte-identical
artifact.

**Content / product / price change:** edit in `admin.metnmat.com` — live immediately, no deploy.
CMS writes to Mongo; the website reads it and revalidates by cache tag.

---

## 6. Environment variables and secrets

Authoritative list: [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md). Mapping to AWS:
[`docs/AWS-SECRETS-MAPPING.md`](docs/AWS-SECRETS-MAPPING.md).

In production, values come from **AWS Secrets Manager**, fetched at process start by
`deploy/bin/with-secrets.sh`. There are no on-disk `.env` files in production.

| Prefix | Consumers |
|---|---|
| `metnmat/prod/*` | website + CMS |
| `metnmat/chatbot/*` | chatbot only |

The chatbot has its **own prefix for a reason**: it needs a different `MONGODB_URI`. Its data lives
in database `metnmat`; the CMS lives in `metnmat_cms`. Sharing a prefix would guarantee one of them
points at the other's data — which has happened before and left stray Payload collections in the
chatbot's database.

**Authentication to AWS is by EC2 instance role** (`metnmat-dashboard-role`), for both S3 media and
Secrets Manager. **No AWS access keys exist on the instance.** Setting `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` would defeat this — leave them unset.

`NEXT_PUBLIC_*` values are **baked into the client bundle at build time** and cannot be supplied at
runtime; they are set in the deploy workflow, not in Secrets Manager.

### Two variables that must never be server configuration

| Variable | Why |
|---|---|
| `DIRECTOR_RESET=true` | Deletes every staff account except the director **on every boot** — including an unattended PM2 memory-restart. Run as a deliberate one-off only. |
| `SEED_PRUNE_PLACEHOLDERS=true` | Deletes products and categories whose slug isn't in the bundled catalogue. |

`with-secrets.sh` refuses to inherit either.

---

## 7. Post-deploy verification

```bash
for u in https://www.metnmat.com/ https://metnmat.com/ \
         https://admin.metnmat.com/admin https://chat.metnmat.com/health; do
  curl -s -o /dev/null -w "%{http_code} %{ssl_verify_result} $u\n" "$u"
done
```

Expect `200`, `308`, `200`, `200`, each with `ssl_verify_result` of `0`.

- [ ] CMS `/admin` loads and you can log in; products and categories present
- [ ] Website product pages show images — proves website → CMS → S3 end to end
- [ ] Quote/order submission sends a confirmation email (Resend)
- [ ] Money path: shop → cart → checkout → Razorpay → confirmation
- [ ] `curl -s https://chat.metnmat.com/widget.js | head -c 200` returns script, not 404 —
      the website injects exactly this, so a 404 means the bubble silently never appears
- [ ] Ask the bot "what products do you sell?" → a real answer (proves OpenAI + Mongo + Pinecone)
- [ ] `INTERNAL_API_KEY` identical in website and CMS
- [ ] Run `preflight-aws.yml` — expect zero failures

---

## 8. Known constraints and production notes

**Operational**

- **One instance, four apps, ~400 MB headroom.** `sharp` allocates outside the V8 heap, so PM2's
  memory caps do not bound an image-processing spike. A 2 GB swapfile and `sharp.concurrency(1)`
  exist to keep a bulk upload from triggering the kernel OOM killer — which chooses its victim by
  memory footprint, not by fault, and could take the other team's dashboard down.
- **`imageSizes` are generated at upload only.** Five derivatives per image, never regenerated.
  Changing the ladder does not touch existing media — settle it **before** a catalogue upload, or
  changing it later means re-uploading everything.
- **The media bucket is empty by decision.** GCS media was deliberately not migrated; the catalogue
  is being uploaded fresh.
- **MongoDB Atlas Network Access** must allow the instance's Elastic IP `15.206.25.71`.
- **Seed runs on every CMS boot** but is create-if-missing, not sync — staff edits survive.
  Globals seed only when unset, so changing a value already set in production requires a one-shot
  migration in `seed.ts`, not a seed-data edit.

**Security**

- **`PAYLOAD_PIN_PEPPER = 5970`** is deliberately weak so existing staff PIN logins keep working —
  an accepted risk. The strong-pepper + PIN-re-save migration needs a maintenance window.
- **Customer sessions are stateless JWTs.** Logout clears the `mm-customer` cookie, but an issued
  token stays valid until its 7-day expiry; there is no server-side revocation. To add force-logout
  or revoke-on-password-reset, add a `tokenVersion` field to `customers` and check it in an auth
  hook — do not re-enable Payload sessions.
- **Staff login lockouts are per-account, not per-source.** Payload applies its default
  `maxLoginAttempts: 5` to the `Users` collection, and the PIN route (`/pin-login`) adds its own
  IP-keyed brute-force lock. Neither stops one source from spreading attempts across many
  accounts — acceptable given `/admin` is not publicly advertised, but worth knowing.
- ~~Rate-limit client IP is spoofable~~ — **fixed.** `clientIp()` strips trusted proxy hops from the
  right of `X-Forwarded-For` and takes the rightmost remaining token, which under Caddy is always
  the connecting peer. Caller-supplied values sit to the left and are unreachable. Covered by
  `test/client-ip.test.ts`.

**Still open**

- **`metnmat.in` is still live, fully indexable and self-canonical.** It competes with
  `metnmat.com` for the same content and splits ranking authority. This is the highest-value
  remaining item for a global launch — redirect it 301 to `metnmat.com`.
- **No uptime monitoring or alerting.** Nothing notices if a service dies; this has happened once
  unattended. Any external monitor on the four URLs in §7 would close it.
- **Seven optional secrets still hold placeholders** — the features they gate (Google sign-in,
  WhatsApp/Messenger integration, analytics geo) are dark until set. Everything each app *requires*
  is populated; `preflight-aws.yml` distinguishes the two.

---

## 9. Credentials handover (do NOT commit)

Provide the company a **separate secure document** (password manager or sealed doc) with real
values for every variable in `ENVIRONMENT_VARIABLES.md`, plus logins for AWS, MongoDB Atlas,
Resend, OpenAI, Pinecone, Razorpay, Upstash and GitHub. Then:

1. **🔑 Rotate every key.** Development keys were used throughout and must be regenerated into
   Secrets Manager. Treat as compromised anything that ever sat in an OneDrive-synced `.env`.
2. **👤 Transfer account ownership** to company email addresses for every external service.
3. **🗑️ Revoke personal access** once the company confirms everything works — including the
   `metnmat-migration` IAM user created for the migration, and any GitHub Actions access keys, in
   favour of OIDC (`AWS_DEPLOY_ROLE_ARN`).

---

## 10. Day-2 operations

- **Content, products, prices:** `/admin` — live, no redeploy
- **Bulk catalogue load** (many products or photographs at once): [`docs/CATALOGUE.md`](docs/CATALOGUE.md).
  Run it from a laptop, not the server — image processing happens wherever the upload is handled.
- **After code changes:** merge to `main`, then run the deploy workflow (§5)
- **Logs:** `reload-app.yml` prints recent output, or via SSM:
  `sudo -u ec2-user pm2 logs metnmat-website --lines 40 --nostream`
  — always name the app; never `pm2 logs` unqualified on this box
- **Diagnosis:** run `preflight-aws.yml` before forming a theory. It has repeatedly found the
  actual cause in one run where reasoning from symptoms went the wrong way.
- **Rollback:** automatic on failed health check (§5)

### Enable branch protection on `main` (one-time)

Settings → Branches → Add ruleset for `main`:

1. **Require a pull request before merging**
2. **Require status checks to pass** → select the `build` check from `ci.yml`
3. **Require branches to be up to date before merging**
4. (Recommended) **Do not allow bypassing**, including administrators

Deploys are manual, so this does not gate production directly — but it keeps `main` deployable,
which is what the manual deploy assumes.

---

*Source of truth: this file + [`CLAUDE.md`](CLAUDE.md) + [`deploy/README.md`](deploy/README.md) +
[`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md). Keep them updated as the system evolves.*
