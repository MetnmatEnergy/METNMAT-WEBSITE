# GCP → AWS migration: runbook

Implements the Website / CMS Migration Blueprint (12 Aug 2026): the public
website and Payload CMS move from GCP Cloud Run onto the existing AWS EC2
instance, running under PM2 behind Caddy.

**Current status: the site is down.** `www.metnmat.com`, `admin.metnmat.com`
and the chatbot all return 503 from Google Frontend because GCP billing is
disabled. Cloud Run reports every service healthy; the requests never reach a
container. Restoring billing ends the outage *and* unblocks the media copy —
it is one action that fixes two problems, which is why it is step 1 below and
not step 12.

## What is in here

| Path | What it is | Runs where |
|---|---|---|
| `bin/release.sh` | Download → verify → swap → reload → health-check → rollback | EC2, via SSM |
| `bin/with-secrets.sh` | Loads `metnmat/prod/*` into the env, then execs the app | EC2, at process start |
| `bin/migrate-media.sh` | GCS → S3 copy with count + byte verification | Anywhere with both CLIs |
| `pm2/ecosystem.config.cjs` | PM2 process definitions | EC2 |
| `caddy/metnmat.Caddyfile` | Site blocks for www + admin | EC2 |
| `../.github/workflows/deploy-website-ec2.yml` | Build and release pipeline | GitHub runner |

---

## ⚠ Environment variables that must never be set on the server

Two variables make the CMS **delete production records at boot**, and a PM2
memory-restart is a boot. `bin/with-secrets.sh` actively unsets both, but do
not rely on that alone — keep them out of Secrets Manager, shell profiles and
the PM2 dump.

| Variable | What it does on every boot |
|---|---|
| `DIRECTOR_RESET=true` | Deletes **every staff account** except the director |
| `SEED_PRUNE_PLACEHOLDERS=true` | Deletes products and categories not in the bundled catalogue |

Both are legitimate one-off, human-supervised operations. Neither is server
configuration. Run them deliberately or not at all.

For the record, the rest of the boot-time seed is safe by design (hardened
2026-07-13, `seed.ts`): products are create-if-missing and never updated, the
four settings globals seed only when unset, and the only unconditional deletion
is of products with a missing or empty slug — records that are already broken.
Note that `CLAUDE.md` gotchas #4 and #6 still describe the old, more
destructive behaviour and are out of date.

## Runtime environment contract

Supplied by `with-secrets.sh` from `metnmat/prod/<NAME>` at process start:

| Variable | Notes |
|---|---|
| `MONGODB_URI` | ⚠ database name must be **`metnmat_cms`**. `/metnmat` is the *chatbot's* database — pointing the CMS at it empties the shop and 500s every `depth=1` query. |
| `PAYLOAD_SECRET` | Boot fails on `PLACEHOLDER_SET_ME`; that literal is committed in `infra/` and therefore public. |
| `PAYLOAD_PIN_PEPPER` | ≥16 chars. |
| `CMS_URL` | Public origin. Without it cors/csrf fall back to localhost and Payload rejects its own auth cookie on every admin write. |
| `STORAGE_PROVIDER` | `s3` after the media copy; `gcs` until then. |
| `S3_BUCKET`, `S3_REGION` | Required when provider is `s3`. **Do not set `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`** — omitting them makes the SDK use the instance role, which is the whole point. |
| `INTERNAL_API_KEY`, `RESEND_*`, `RAZORPAY_*`, `UPSTASH_*` | As before; provider-independent. |

Set at **build** time, not runtime — `NEXT_PUBLIC_*` is inlined into the client
bundle and cannot come from Secrets Manager:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CMS_URL` | `https://admin.metnmat.com` (public hostname, so unchanged by the DNS cutover) |
| `NEXT_OUTPUT` | `standalone` |

---

## Order of operations

Steps marked 🔴 need console access or credentials and **cannot be automated
from this repo**.

### Phase 1 — end the outage (do first)

1. 🔴 **Rotate the leaked AWS key.** An `AKIA…` key and its secret were pasted
   into a chat transcript. IAM → Users → Security credentials → Make inactive →
   Delete. Check CloudTrail for use.
2. 🔴 **Find the GCS grace-period expiry date** and write it down. It is the
   only hard deadline in this migration; everything else is schedulable.
   `gs://metnmat-media-prod` is the sole copy of all product photography, blog
   and project covers, datasheets and customer RFQ attachments.
3. 🔴 **Confirm MongoDB Atlas backup / PITR is enabled.** It is the only
   recovery path for the CMS database, and nothing in this migration protects it.
4. 🔴 **Re-authenticate `energy@metnmat.com`** (`gcloud auth login`). The
   deployer service account cannot edit Cloud Build triggers, and the `energy@`
   token is expired — so this must happen *before* step 5, not after.
5. 🔴 **Disable the three Cloud Build triggers** in the console (region:
   global). Do it in the console rather than the CLI: Cloud Build API calls can
   fail with `BILLING_DISABLED`, which is a chicken-and-egg with step 6.
   Backups of all three are in `infra/backups/2026-08-10/triggers/`.
6. 🔴 **Restore GCP billing.** The site comes back. Media becomes readable.

> On step 5: the blueprint frames these triggers as a hazard because they would
> redeploy to Cloud Run. In the current state that is mostly *desirable* — the
> site is down and Cloud Run is the only rollback target. `main` currently
> contains only CI, Terraform and docs commits, no application changes, so a
> redeploy produces substantially the same site. Disable them anyway for
> control, but do not treat it as the emergency the document implies.

### Phase 2 — copy the media

```bash
./deploy/bin/migrate-media.sh inventory   # baseline first — prints a cost estimate
./deploy/bin/migrate-media.sh copy        # resumable, deletes nothing
./deploy/bin/migrate-media.sh verify      # count AND bytes AND spot checks
```

Keys are copied one-to-one. Do not reorganise them: the database stores only
the filename, and the five derivative sizes per image **cannot be regenerated**
— Payload creates them at upload time only.

### Phase 3 — stand up the website on EC2

7. 🔴 Create `/home/ec2-user/web/{releases,logs,bin}` and copy
   `bin/with-secrets.sh` + `pm2/ecosystem.config.cjs` onto the instance.
8. 🔴 Grant the instance role: `s3:GetObject` on the artifact bucket,
   `s3:GetObject/PutObject` on the media bucket, and
   `secretsmanager:GetSecretValue` + `ListSecrets` scoped to `metnmat/prod/*`.
9. 🔴 Set the repo settings the workflow needs — secret `AWS_DEPLOY_ROLE_ARN`,
   vars `EC2_INSTANCE_ID` and `ARTIFACT_BUCKET`. Until these exist the workflow
   is inert and exits with a notice.
10. Push to `main`, or dispatch **Deploy website to EC2** manually. The build
    runs the full gate (typecheck, lint, test) before anything is published.
11. 🔴 Append `caddy/metnmat.Caddyfile` to the instance's Caddy config,
    `caddy validate`, then `systemctl reload caddy`.

### Phase 4 — cutover

12. 🔴 **Lower the GoDaddy TTL to 300s several days ahead.** Not in the
    blueprint, and it is what decides whether a rollback takes five minutes or
    five hours. Do this before anything else in this phase.
13. 🔴 Move the A records for `metnmat.com`, `www` and `admin` to the
    instance's Elastic IP. **www and admin must move together** — they are a
    pair, and the CMS origin is compiled into the website.
14. Caddy issues certificates on first request per hostname. It cannot do so
    until DNS resolves here, so there is a window between the DNS move and the
    first successful issuance where users see TLS errors. Cut over at low
    traffic, or pre-issue with a DNS-01 challenge using GoDaddy API credentials.
15. Verify, then leave GCP alone. It is the only rollback target until the AWS
    stack has been proven.

---

## Deviations from the blueprint, and why

**Health check runs against localhost, not `https://metnmat.com`.** The
blueprint specifies the public URL, but the deploy (step 10) happens before the
DNS move (step 13) — so that URL still resolves to GCP and would report the
*old* stack healthy while a completely broken release sat on the box.
`release.sh` checks `127.0.0.1:3100` with a `Host:` header instead, which
exercises the same code paths on the connection that actually matters.

**Resize to t3.medium before adding the CMS, not after an OOM.** The
blueprint's own numbers — 834 MB available against 400–600 MB for the website
plus 500–800 MB for the CMS — say both do not fit. "Do not upgrade
preemptively" is right when you lack evidence; here the evidence already
exists. The CMS entry in `ecosystem.config.cjs` is commented out for this
reason. Also worth investigating rather than accepting: the blueprint records
the dashboard's Next.js process at "734 MB **and gradually growing**", which is
a leak, and a leak on a box you are about to fill is what turns a tight fit
into an OOM cascade.

**CloudFront is a regression to accept, not a feature to defer.** The
blueprint lists it `NOT REQUIRED`, but GCP has Cloud CDN today. Dropping it
moves every image byte onto EC2 egress (~$0.109/GB in Mumbai), puts image
streaming on the same 2 GB box as page rendering, and slows assets for Indian
users. Fine as a starting point — but record it as a known regression with a
trigger to reverse, not as a feature you never had.

---

## Still open

- **The chatbot is in scope, and the blueprint says "NEEDS VERIFICATION".** The
  website embeds it (`frontend/components/chat/chat-widget.tsx`,
  `chat-cart-bridge.tsx`). Decommission GCP without moving it and the storefront
  ships a broken widget. It deploys from a separate repository, so it is a
  separate migration — but it cannot be dropped from the billing decision.
- **`metnmat.in` is missing from the blueprint entirely.** It is live, fully
  indexable, self-canonical, with no redirect to `.com` — and right now, with
  `.com` down, it is the only live face of the brand. You are about to do DNS
  work; that is the moment to add the redirect.
- **`next.config.mjs` still allow-lists `https://storage.googleapis.com`** in
  its CSP. Media streams through the CMS so the browser should never hit
  storage directly, which suggests this is vestigial — but confirm no URL
  depends on it before removing, after the S3 switch.
- **The CMS import map.** Switching the storage adapter changes its entries.
  Regenerate with **no dev server running** (a live `next dev` rewrites it to
  zero handlers and the production admin then renders blank), count the entries,
  and deploy that change on its own.
- **Delete `deploy-aws.yml`, `terraform-aws.yml` and `infra/aws/{ecs,alb,network}.tf`**
  once EC2 is proven. They are neutered, not removed — that is a call for you,
  not me.
