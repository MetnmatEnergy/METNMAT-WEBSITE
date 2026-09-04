# AWS production readiness report

**Date:** 2026-08-11 · **Account:** 976134557584 · **Region:** ap-south-1 (Mumbai)
**Scope:** migration from GCP Cloud Run to AWS ECS Fargate + ALB.

Every claim here was verified against repository files or a live HTTP probe. Where
something could not be verified, that is stated rather than assumed.

---

## 0. Headline: the migration is not finished, and cannot be

Two statements need correcting before anything else, because the plan depends on
them.

**The AWS stack is not serving.** As of this report:

```
www.metnmat.com    /  -> 200   (via ALB, Host header)
admin.metnmat.com  /  -> 500
```

The CMS has never successfully served a page from AWS. All 22 secrets in AWS
Secrets Manager still hold the literal string `PLACEHOLDER_SET_ME`, so Payload
cannot connect to MongoDB (`MongoParseError: Invalid scheme`). The website's 200
is graceful degradation, not proof the stack works — the storefront renders when
the CMS is unreachable by design.

**GCP cannot be switched off yet.** All production media lives in GCS
(`metnmat-media-prod`). The AWS S3 media bucket is empty. There is no copy
tooling in the repository. And GCP billing is currently **disabled**, so GCS is
unreadable right now:

```
ERROR: ... This API method requires billing to be enabled ... reason: BILLING_DISABLED
```

This is the single thing standing between the current state and "AWS-only". It is
also the one case the brief already allows for — GCP retained *temporarily, for
data migration*. Concretely: **GCP billing must be restored long enough to copy
the media out.** Nothing else in the repository still requires GCP at runtime.

---

## 1. Remaining blockers

| # | Blocker | Severity | Can I fix it in the repo? |
|---|---|---|---|
| 1 | 22 secrets hold `PLACEHOLDER_SET_ME`; CMS 500s | **P0** | No — console/CLI action |
| 2 | Media unserviceable: GCS configured, Fargate has no Google credential, and no credential path exists | **P0** | Partly — see §2 |
| 3 | GCS unreadable (GCP billing disabled) so media cannot be copied | **P0** | No — billing decision |
| 4 | Apex `metnmat.com` unroutable from GoDaddy to an ALB | **P1** | ALB side done (`7f88925`); DNS side is a decision |
| 5 | No rollback target — Cloud Run is down on billing | **P1** | No |
| 6 | `chat.metnmat.com` has an ECS service and ALB rule but no image is ever built here | **P1** | No — separate repository |

### Fixed during this pass

| Commit | What |
|---|---|
| `fd4e939` | Restored 6 env vars silently lost vs Cloud Run; removed `ignore_changes` that froze all env config; `/api/ready` + post-deploy serve probe; keep-alive; access logs; `deregistration_delay` |
| `123fc81` | **Reverted `HTTP_308` → `HTTP_301`.** Self-inflicted in `fd4e939`: ELBv2 accepts only 301/302, so `terraform validate` failed and *no* infra change could be applied |
| `ac96a5d` | Refuse to run on `PLACEHOLDER_SET_ME` in both apps + both `safeKeyEqual` implementations; 4 new tests |
| `7f88925` | Apex listener rule, so the apex→www 308 can run at cutover |

---

## 2. The media problem, in detail

This is the largest remaining functional gap and it deserves precision.

`infra/aws/ecs.tf` sets `GCS_BUCKET` / `GCS_PROJECT_ID` and leaves the S3 trio
commented out. `storage-config.ts:80` defaults an unset `STORAGE_PROVIDER` to
`"gcs"`, so the task resolves to GCS and `payload.config.ts` builds
`gcsStorage({ keyFilename: undefined })` — which means Application Default
Credentials.

**ADC does not exist on Fargate.** google-auth-library tries, in order:
`GOOGLE_APPLICATION_CREDENTIALS` → the gcloud well-known file → the GCE metadata
server. None exist in an `awsvpc` task. There is no credential in
`service_secrets`, none in `var.secret_names`, and `Dockerfile.dashboard` installs
no gcloud and copies no key.

**And there is no supported way to add one.** Both `GCS_KEY_FILENAME` and
`GOOGLE_APPLICATION_CREDENTIALS` are *filesystem paths*. ECS injects environment
variables only — no volume, no init container, no entrypoint script. Adding a
secret would resolve to a path that does not exist.

**The failure is invisible until a user hits it.** The GCS client is constructed
lazily on first use, so nothing authenticates at boot: `/api/health` passes,
`/api/ready` passes (it queries Mongo, not storage), ECS reaches steady state, and
the deploy gate goes green. The first request to `/api/media/file/<name>` is the
first thing that touches GCS. Worse, `describeStorage()` logs
`credentials=ADC (attached service account)` at boot — a reassuring line that is
false on Fargate. All four collections set `disableLocalStorage: true`, so there
is no fallback: media is absent, not degraded.

### Required sequence — order matters

1. **Restore GCP billing** (temporarily; this is the sanctioned data-migration exception).
2. **Copy** `gs://metnmat-media-prod` → `s3://metnmat-media-prod`, then verify **object count and total bytes match**. Object keys are flat and shared across all four collections — the copy must be 1:1. Do not "tidy" the key layout during the copy; it would orphan every existing file.
3. **Add `S3ClientUploadHandler` to `importMap.js` and deploy that alone, first.** Payload's `initClientUploads` registers the client handler regardless of whether `clientUploads` is enabled, so switching provider without the import map entry makes the module unresolvable and renders `/admin` **blank** (CLAUDE.md gotcha #2). Currently the file has 2 `GcsClientUploadHandler` entries and 0 S3.
4. **Then** flip `ecs.tf` to `STORAGE_PROVIDER = "s3"`, `S3_BUCKET`, `S3_REGION` and drop the GCS vars. `terraform apply`, then deploy.
5. Verify: `curl -H 'Host: admin.metnmat.com' https://<alb>/api/media/file/<known-file>` returns **200 with image bytes**, not 500.

Media URLs do not change: Payload sets neither `disablePayloadAccessControl` nor
`generateFileURL`, so it keeps emitting CMS-relative `/api/media/file/<name>`
under either provider. **No website change, no database change.**

The IAM task role already grants the dashboard the right S3 actions
(`iam.tf`), so step 4 needs no permission work.

---

## 3. Security

| Item | State |
|---|---|
| Placeholder secrets accepted as real | **Fixed** (`ac96a5d`) — both apps refuse to boot; both `safeKeyEqual` reject it |
| `INTERNAL_API_KEY` = public string on an internet-facing ALB | **Open until secrets are populated.** The value is in git |
| Secrets in task definition | Correct — injected by the ECS agent via `valueFrom`, never in state or console |
| Execution role vs task role | Correctly separated. Execution role reads only this stack's secrets, by ARN |
| `iam:PassRole` | Correctly scoped to the two roles, conditioned on `ecs-tasks.amazonaws.com` |
| GitHub OIDC trust | Pins **both** repo and branch (`refs/heads/main`) — not repo-only |
| S3 media bucket | Private, encrypted, versioned, public access blocked. Holds unpublished manuscripts, so this is load-bearing |
| Bootstrap access key | **Still live.** Delete it once `AWS_DEPLOY_ROLE_ARN` is set. One such key was pasted into a chat transcript and must be treated as compromised |
| **SEC-02** | Legacy Supabase S3 key revocation still **unconfirmed**. The Supabase mentions in `ENVIRONMENT_VARIABLES.md` / `PRODUCTION_READINESS_CHECKLIST.md` are this open item — **not** a code coupling. Do not "clean them up"; that would erase a tracked finding |
| No WAF | Accepted gap |

`PAYLOAD_SECRET` can be regenerated safely — no collection uses encrypted fields,
so it only invalidates sessions. **`PAYLOAD_PIN_PEPPER` cannot be regenerated
casually:** a staff password *is* `HMAC(pepper, pin)`. `DIRECTOR_EMAIL` (restored
in `fd4e939`) is what lets the seed find the director on boot. PIN-only staff get
a synthetic `@staff.metnmat.local` address and cannot receive a password reset.

> **⚠ Correction, 2026-09-04.** This paragraph originally said the boot seed
> "re-derives the director's password", and the migration plan below still leans
> on that as the recovery path for a pepper change. **It never did.** In Payload
> 3.85.1 a password assigned in a collection `beforeChange` hook is dead code on
> update — the value is snapshotted at the top of `updateDocument()`, before those
> hooks run. `ensureDirectorAccount` updates through that path, so the director's
> credential was frozen at whatever the account was CREATED with, and a boot after
> a pepper change would have logged success while leaving everyone locked out.
>
> Fixed in `hooks/pin-credential.ts` (a `beforeOperation` hook, which runs before
> the snapshot), with the ordering asserted against the installed Payload in
> `test/pin-credential.test.ts` so a version bump cannot silently undo it. The
> ordering advice above — `DIRECTOR_EMAIL` before any pepper change — is still
> right, but it was not sufficient on its own and is not a rotation plan; see
> `docs/upgrade/pin-pepper-rotation.md`, which carries its own correction banner.

## 4. IAM review

Well-shaped. Two roles per the ECS model, least privilege on the task role (only
the dashboard gets S3; the website and chatbot get none). Added
`elasticloadbalancing:DescribeLoadBalancers` in `fd4e939` for the new deploy
probe — without it the probe would break the moment deploys switch from the
bootstrap key to OIDC.

**Recommended:** delete the bootstrap key after setting `AWS_DEPLOY_ROLE_ARN`;
add a CI-only read role for the diagnostic workflow rather than reusing the
deploy identity.

## 5. Secrets review

22 secrets at `metnmat/prod/<NAME>` in **Secrets Manager**. Note
`docs/AWS-SECRETS-MAPPING.md` tells the operator to use **SSM Parameter Store** —
following it populates nothing. That doc needs correcting (P1).

`aws_secretsmanager_secret_version.app_placeholder` carries
`lifecycle { ignore_changes = [secret_string] }`, so `terraform apply` will not
overwrite populated values. Worth confirming empirically with a `plan` after
populating.

**Recovery paths**, since GCP Secret Manager is unreadable: Atlas console
(`MONGODB_URI` — must end `/metnmat_cms`, not `/metnmat`, which is the chatbot's
database), Razorpay, Resend, Upstash, Google Cloud Console (OAuth), openexchangerates.
`PAYLOAD_SECRET` / `INTERNAL_API_KEY` / `CMS_OAUTH_KEY` can be regenerated — the
last two must **match** between website and dashboard.

## 6. ECS review

Sizing is sensible per workload (website 0.5/1GB, dashboard 1/2GB, chatbot
0.25/0.5GB). Circuit breaker with rollback is enabled; `minimum_healthy_percent`
100 / `maximum_percent` 200 means an unhealthy task never takes traffic.

- **`desired_count = 1` everywhere, no autoscaling** — a capacity and availability regression from Cloud Run's `maxScale 3`. A single task is also a single AZ. **P1.**
- The chatbot service runs at `desired_count 1` against a `:bootstrap` tag that is never pushed — permanently unstartable from this repo.
- `ignore_changes = [container_definitions]` removed in `fd4e939`; Terraform owns the family, CI owns the image, the service still ignores `task_definition`.

## 7. ALB review

One ALB, host-routed — correct call, since the ALB's fixed hourly charge is the
largest fixed cost.

| Setting | State |
|---|---|
| `idle_timeout` 300s vs Node keep-alive | **Fixed** (`fd4e939`) — was the classic 502 reuse race |
| HTTP→HTTPS `HTTP_301` | Correct; 308 is not available on ELBv2. HSTS `preload` covers browsers |
| Apex rule | **Added** (`7f88925`) |
| Access logs | **Added** (`fd4e939`), 90-day expiry |
| `deregistration_delay` | 30s → 60s |
| Health check depth | Deliberately shallow (liveness). Readiness is `/api/ready`, gated in CI, not on the ALB — a transient Atlas blip must not drain every task at once |
| Deletion protection | Enabled |

## 8. Monitoring & logging

- CloudWatch log groups per service, 30-day retention. ALB access logs now land in S3 with 90-day expiry.
- **No CloudWatch alarms and no SNS topic anywhere.** Nothing pages anyone. **P1** — minimum useful set: ALB 5xx rate, target-group unhealthy host count, ECS running-task count below desired, Secrets Manager placeholder detection.
- Container Insights deliberately disabled (billed per metric).
- `/api/ready` gives a real readiness signal; it deliberately does **not** check storage, which is why the media failure would still deploy green. Extending it to touch storage is the natural next step (**P1**).

## 9. Cost optimisation

- NAT Gateway **off** — the single biggest saving, valid because Atlas allows `0.0.0.0/0`. This is parity with Cloud Run (which also has no stable egress IP), not a downgrade; inbound is still SG-locked to the ALB.
- ECR lifecycle keeps 15 tagged images, expires untagged after 3 days.
- Log retention bounded (30d CloudWatch, 90d access logs, 90d noncurrent S3 versions).
- **Honest note:** this migration *increases* compute cost. Cloud Run at `minScale=0` costs ~₹0 idle; Fargate provisions continuously. ALB + always-on tasks are the floor. That is the price of leaving, not a design fault.
- No CDN. Every media byte re-streams through a single 1-vCPU task. CloudFront would cut both cost and latency (**P2**, but it also solves the apex — see below).

## 10. Performance & scalability

- Add **Application Auto Scaling** on ECS (target-tracking on CPU) and raise `desired_count` to 2 for the website so it spans AZs. **P1.**
- Add **CloudFront** in front of the ALB. It gives an apex-capable alias target, caches static assets and media, terminates 307/308 if plaintext POST ever matters, and reduces ALB LCU. This is the highest-leverage single addition.
- The CDN previously clamped browser `max-age` to ~3600; on AWS you control that directly.

## 11. Disaster recovery & backup

This is the weakest area.

- **No rollback exists.** Cloud Run is down on billing, so the documented fallback is unavailable. Until GCP billing is restored or a second AWS revision is proven good, a bad cutover has no fast undo.
- **MongoDB Atlas is external and unaffected** by the migration — the one genuinely good DR story here. Confirm the Atlas backup/PITR tier separately; it is not visible from this repository.
- **Media has no backup once copied.** S3 versioning is on (90-day noncurrent expiry), which covers overwrite/delete, not bucket loss. Consider cross-region replication after the copy.
- Terraform state is in S3, versioned, DynamoDB-locked. Good.
- ECR immutable tags give a real image rollback target: re-deploy a previous `:$COMMIT_SHA`.
- **Recommended:** write an actual rollback runbook. There is none. Minimum: how to re-point DNS, how to redeploy a prior image tag, who decides.

---

## 12. Migration plan

### P0 — before production traffic

1. Populate the 22 secrets at `metnmat/prod/<NAME>` (Plaintext), then **redeploy** — ECS resolves secrets only at task start.
2. `terraform apply` to pick up the restored env vars, then deploy. Order matters: `DIRECTOR_EMAIL` must land before any pepper change.
3. Restore GCP billing → copy media → verify counts → importMap S3 entry → flip to S3 → verify a real image returns 200.
4. Decide the apex: Route 53 (move the zone) or CloudFront. GoDaddy cannot do it.
5. Confirm `www` and `admin` cut over **together** — `NEXT_PUBLIC_CMS_URL` is baked at build time and points at `admin.metnmat.com`.

### P1 — immediately after

Autoscaling + multi-AZ · CloudWatch alarms + SNS · extend `/api/ready` to storage ·
fix `docs/AWS-SECRETS-MAPPING.md` (SSM → Secrets Manager) · fix `CLAUDE.md`,
`HANDOVER.md`, `CONTEXT.md`, which still name Cloud Build → Cloud Run as *the*
deploy path · `deploy-aws.yml` `fetch-depth: 2` silently skips a service on a
multi-commit push · gate ECS deploys on CI passing · delete the bootstrap access key.

### P2 — technical debt

CloudFront · WAF · chatbot image pipeline (or scale its service to 0) · retire the
root `cloudbuild*.yaml` and `infra/cloudbuild-triggers/` **after** the GCS copy —
note the three live Cloud Build triggers **re-arm the instant billing is restored**,
so disable them in the console during the copy window · `TRUSTED_PROXY_IPS` still
defaults to Google's LB IP · `terraform.tfvars.example` contradicts the applied NAT
decision · `x-vercel-ip-country` in `api/geo/route.ts` is inert on AWS (one of three
CDN header fallbacks; harmless).

**Do not delete** `infra/backups/**` or `docs/AWS-*.md`. They are point-in-time
evidence — the Cloud Run backups are the only surviving record of the production
env vars, and were the source for restoring the six lost in `fd4e939`.
