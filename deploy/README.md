# AWS EC2 runbook (migration complete)

> ## ✅ Migration complete — 2026-08-20
>
> The website, Payload CMS and chatbot all run on the AWS EC2 instance under PM2 behind Caddy,
> serving publicly with real certificates. **GCP is abandoned**, not paused: the project stays
> billing-disabled, its Cloud Build triggers are irrelevant, and Cloud Run is **not** a rollback
> target. Rollback is a symlink swap on the instance, handled automatically by `release.sh`.
>
> This file was written as a *migration* runbook and is kept because the environment facts,
> the environment-variable contract and the operational procedures below remain accurate and
> load-bearing. **The phase ordering in "Order of operations" is history, not instructions** —
> Phases 1, 3 and 4 are done, and Phase 2 (media copy) was deliberately cancelled.
>
> For day-to-day operations start at [`../HANDOVER.md`](../HANDOVER.md). For gotchas and the data
> model, [`../CLAUDE.md`](../CLAUDE.md).

Originally implemented the Website / CMS Migration Blueprint (12 Aug 2026): the public website and
Payload CMS moving from GCP Cloud Run onto the existing AWS EC2 instance, running under PM2 behind
Caddy. The chatbot followed on 2026-08-20 from its own repository.

## Confirmed environment (2026-08-12)

| | |
|---|---|
| EC2 instance | `i-0b7f49ca3e9852d4b` · t3.small · ap-south-1 |
| Instance **Name** tag | `metnmat-website` |
| Instance role | `metnmat-dashboard-role` (has `AmazonSSMManagedInstanceCore`) |
| Public IP | `15.206.25.71` — ⚠ not confirmed to be an **Elastic** IP |
| AWS account | `976134557584`, deploy identity `iam::…:user/metnmat-migration` |
| Artifact bucket | `metnmat-deploy-artifacts-976134557584` |
| Media bucket | `metnmat-media-prod` — exists in ap-south-1, empty until the GCS copy runs |

⚠️ **`metnmat-deploy-artifacts-website` does not exist** — a console screenshot
suggested it did, but the deploy identity cannot see it. Live listing on
2026-08-12 found five buckets, two of which could serve as the artifact store:
`metnmat-deploy-artifacts-976134557584` (used — clean, account-scoped) and
`metnmat-deploy-artifacts-website-976134557584-ap-south-1-an` (unclear origin;
neither is Terraform-managed — `platform.tf` defines only the media and
alb-logs buckets). Set the `ARTIFACT_BUCKET` repository variable to override.

## Pre-flight: green (2026-08-12)

`27 passed · 5 warnings · 0 failed` — *Ready, with warnings.*

Verified against the live account, by the identity that deploys:

```
✓ every secret the website requires is populated (INTERNAL_API_KEY)
✓ instance role can GetObject from the artifact bucket
✓ instance role can read Secrets Manager        (granted by instance-role-policy.json)
✓ SSM agent online · port 3100 free · /home/ec2-user/web exists · caddy running
✓ DIRECTOR_RESET / SEED_PRUNE_PLACEHOLDERS unset on the box
```

All five warnings are expected and none blocks the website: 21 secrets still
placeholder (CMS and chatbot only), media bucket empty (both wait on GCP
billing), t3.small shared with the dashboard, ~649 MB free, and an IAM user
rather than an OIDC role.

**The website needs exactly one of the 22 secrets to boot** — `INTERNAL_API_KEY`,
per `instrumentation.ts`. It does not wait on Razorpay, Resend, WhatsApp or any
CMS value. `REQUIRED_SECRETS` in `pm2/ecosystem.config.cjs` and the same list in
`bin/preflight.sh` encode that, and must be kept in step with each other.

## Measured on the instance (2026-08-12, bootstrap report)

```
node v20.20.2 · pm2 7.0.3 · caddy v2.11.4 · aws-cli 2.33.15 · tar · curl
pm2 processes: metnmat-dashboard
memory: 1909 MB total, 654 MB available
disk:   9.5G used of 30G (32%)
```

✅ **It is the shared box.** The Name tag says `metnmat-website`, but
`metnmat-dashboard` is running on it. The blueprint's §2 decision holds and its
discipline applies in full: **never `pm2 restart all`**, always name the process.

⚠️ **654 MB available, not the 834 MB in §12.** The blueprint records the dashboard's
Next.js process as "gradually growing", and this is that growth showing up — 180 MB gone.
A website needing 400–600 MB against 654 MB and falling is not a configuration problem.
PM2 caps here are sized to the measured number (heap 448 MB, restart at 560 MB) so the
kernel OOM killer — which would pick its own victim, possibly the dashboard — is never
reached first. **The resize to t3.medium is now evidence-backed, not precautionary.**

⚠️ **Node majors differ between build and runtime, and cannot currently be aligned.**
The instance runs **Node 20.20.2**; the deploy builds on **Node 22**. Matching the runtime
was tried and fails outright: pnpm 11.5.1 (pinned by `packageManager`) requires Node
≥22.13 and dies on 20 with `No such built-in module: node:sqlite`. The build tool sets the
floor, not the app.

Tolerable because root `engines` declares `>=20`, the website bundle carries no native
modules (`sharp` is dashboard-only, so no ABI is compiled against the wrong major), and
GCP already builds *and* runs this app on `node:22`.

**The clean fix is to move the instance to Node 22** so the two match — but that box also
runs the command-center dashboard on Node 20, so it is a decision for whoever owns that
app. Until then, treat any "works in CI, fails on the server" report as this split until
proven otherwise. It matters more when the CMS moves: `sharp` *is* native and its ABI is
tied to the Node major.

⚠️ **Bucket versioning is on.** The blueprint assumes a 14-day artifact expiry. With
versioning enabled, a lifecycle rule must expire **noncurrent** versions too, or deleted
artifacts are retained and billed indefinitely.

⚠️ **Confirm the public IP is Elastic.** If it is a default public IP it changes on
stop/start, which would break DNS after any instance restart — including the resize in
step 11.

## What is in here

| Path | What it is | Runs where |
|---|---|---|
| `bin/preflight.sh` | Verifies everything the first release needs — run this before deploying | GitHub runner |
| `bin/bootstrap-server.sh` | One-time server prep: directories, PM2 boot persistence, Caddy blocks | EC2, via SSM |
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

## Order of operations — HISTORY, not instructions

> 🗄️ **All of this is done or cancelled.** It is kept as the record of how the migration ran and
> why particular choices were made. Do not work through it.
>
> | Phase | Outcome |
> |---|---|
> | 1 — end the outage | **Superseded.** The outage ended by moving off GCP entirely, not by restoring GCP billing. Steps 4–6 below (re-authenticate `energy@`, disable Cloud Build triggers, restore billing) were never needed and should not be done. |
> | 2 — copy the media | **Cancelled by decision.** GCS media was not migrated; the catalogue is being uploaded fresh to S3. `migrate-media.sh` still exists but is not part of the plan. |
> | 3 — website on EC2 | **Done** 2026-08-14. |
> | 4 — cutover | **Done** 2026-08-20, chatbot included. |
>
> **One item from Phase 1 is still genuinely open:** confirming MongoDB Atlas backup / PITR is
> enabled. It is the only recovery path for the CMS database and nothing in this migration
> protects it. See "Still open" at the end of this file.

Steps marked 🔴 need console access or credentials and **cannot be automated
from this repo**.

### Phase 1 — end the outage (historical)

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

7. Dispatch **Bootstrap EC2** with `mode=report` first — it changes nothing and
   tells you whether the dashboard shares this box, which sets the memory
   budget. Then run it with `mode=prepare` to create
   `/home/ec2-user/web/{releases,logs,bin}`. Add `install_caddy_config=true`
   when you want the site blocks in as well; that is safe before DNS moves,
   since Caddy only requests certificates once a name resolves here.
   `ecosystem.config.cjs` and `with-secrets.sh` are **not** copied manually —
   they ship inside every release artifact and `release.sh` installs them, so
   the config on the box can never drift from the code it runs.
8. 🔴 Grant the instance role: `s3:GetObject` on the artifact bucket,
   `s3:GetObject/PutObject` on the media bucket, and
   `secretsmanager:GetSecretValue` + `ListSecrets` scoped to `metnmat/prod/*`.
9. 🔴 Set the repo settings the workflow needs — secret `AWS_DEPLOY_ROLE_ARN`,
   vars `EC2_INSTANCE_ID` and `ARTIFACT_BUCKET`. Until these exist the workflow
   is inert and exits with a notice. Then dispatch **Pre-flight (AWS readiness)**
   and fix everything it reports before step 10. It checks the things that fail
   expensively — SSM agent offline, instance role denied on S3 or Secrets
   Manager, port 3100 taken, secrets still on `PLACEHOLDER_SET_ME`, and whether
   the box actually has the memory. Run it from Actions, not a laptop: it must
   be the deploy role asking, or it will pass checks the real deploy then fails.
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
exists. (Resolved: the instance was resized to t3.medium on 2026-08-20 and the CMS entry in
`ecosystem.config.cjs` was enabled; both apps now run there.) Also worth investigating rather than accepting: the blueprint records
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

## Locked out of the CMS PIN screen

PIN sign-in is throttled by an **atomic, Mongo-persisted** budget: 5 attempts per
IP and 40 across all addresses, per 15-minute window, in `pin_login_throttle`.
A TTL index expires the rows, so a lockout clears itself after 15 minutes.

⚠ **`pm2 reload metnmat-cms` no longer clears a lockout.** The counter used to
live in process memory, so a restart wiped it — which was an accidental escape
hatch, and also meant a restart wiped it mid-attack. It is deliberate that this
no longer works.

To clear it immediately, over SSM on the instance:

```bash
mongosh "$MONGODB_URI" --eval 'db.pin_login_throttle.deleteMany({})'
```

The throttle **fails open**: if Mongo is unreachable, attempts are allowed. That
is deliberate — an Atlas blip must never lock the only director out of their own
admin. The break-glass door is unaffected either way: Payload's own
email/password login at `/admin/login` carries no PIN budget.

Remember the CMS ships only via the manual **Deploy CMS to EC2** workflow; a push
to `main` deploys nothing for CMS code.

## Still open

Reviewed 2026-08-21. Items that were open during the migration and are now closed are kept with
their resolution, because "why is this not a problem any more" is the question a reader actually
has.

**Genuinely open**

- 🔴 **Confirm MongoDB Atlas backup / PITR is enabled.** The only recovery path for the CMS
  database. Nothing in this migration protects it, and nothing on the instance would help — the
  data does not live there. Highest-value unchecked item on this list.
- 🔴 **`metnmat.in` is still live, fully indexable and self-canonical**, with no redirect to
  `.com`. It now competes with a working `.com` for the same content and splits ranking
  authority — worse than when `.com` was down, not better. A 301 to the `.com` equivalent
  closes it; `legacy-redirects.mjs` already maps 122 paths for the receiving side.
- 🟡 **No uptime monitoring or alerting.** Nothing notices when a service dies, and one has died
  unattended. Any external monitor against the four URLs in `HANDOVER.md` §7 would close this.
- 🟡 **Seven optional secrets still hold placeholders.** Google sign-in, WhatsApp/Messenger and
  analytics geo stay dark until set. Everything each app *requires* is populated; `preflight.sh`
  reports the two groups separately so this cannot be confused with a broken deploy.
- 🟡 **Memory headroom is thin** — roughly 400 MB across four applications. Mitigated by a 2 GB
  swapfile and `sharp.concurrency(1)`, not solved. If the catalogue upload or ordinary traffic
  pushes it further, the answer is a larger instance, not more tuning.

**Closed**

- ~~The chatbot is in scope and unmigrated.~~ Deployed 2026-08-20 from
  `MetnmatEnergy/METNMAT-chatbot`; `chat.metnmat.com` serves with a real certificate and the
  website's widget loads from it.
- ~~`next.config.mjs` still allow-lists `https://storage.googleapis.com`.~~ Removed. Media is
  served through the CMS, so the browser never contacts object storage directly — and S3 does
  not replace the entry.
- ~~The CMS import map changes with the storage adapter.~~ Done: it carries both
  `GcsClientUploadHandler` and `S3ClientUploadHandler`, four entries total. The trap remains
  live — a running `next dev` rewrites it to zero and `/admin` then renders blank — so verify
  with `grep -c ClientUploadHandler` before staging.
- ~~Delete `deploy-aws.yml`, `terraform-aws.yml` and `infra/aws/{ecs,alb,network}.tf`.~~ Decided:
  **kept, not deleted.** `terraform-aws.yml` now refuses `apply`, and `infra/aws` is the only
  record of the ~92 resources the cancelled 2026-08-10 apply created — which is what an audit for
  orphaned, still-billing resources reads. Deleting would save nothing and lose that.
