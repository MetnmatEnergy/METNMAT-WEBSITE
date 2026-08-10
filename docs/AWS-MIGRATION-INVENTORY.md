# AWS Migration — Phase 0 Discovery Inventory

**Status: DISCOVERY ONLY. Nothing has been migrated, modified or deleted.**

Compiled 2026-08-10 against the live GCP project `metnmat-website` (asia-south1)
and the repository at `HEAD`. Every figure here was measured or read from a
file; where something could not be established it says so rather than guessing.

---

## 0. Read this first — two things that change the plan

### 0.1 Production is currently DOWN

All three Cloud Run services return **503** at the Google Frontend, including
static assets like `/robots.txt`. This is not a code fault:

| Signal | Reading |
|---|---|
| `/robots.txt` also 503 | The container never starts — not an app bug |
| All 3 services, incl. the untouched chatbot | Project-wide, not service-specific |
| Revisions `Ready=True`, traffic 100%, generation reconciled | Configuration is correct |
| Project `ACTIVE`, run/build/artifactregistry APIs enabled | Not deleted or disabled |
| Last build SUCCESS 2026-08-06; last revision 2026-08-06 | Nothing deployed since |
| GFE message | *"The service you requested is not available yet."* |

**Leading hypothesis: billing** (suspended account or a hit budget cap). It could
not be confirmed — `gcloud billing` is denied to the deploy service account *and*
the Cloud Billing API is not enabled on the project. Cloud Logging is also denied.

**Why it matters to this migration:** the whole strategy below is a *parallel
run* — stand AWS up beside a working GCP, prove it, flip DNS, keep GCP as
instant rollback. **That requires GCP to work.** If GCP stays suspended you have
no rollback target and this becomes an emergency exit, which is a different and
riskier plan. Restoring GCP first is strongly recommended.

### 0.2 Two corrections to the brief

- **There is no OpenAI integration.** The chatbot uses **Groq**
  (`GROQ_API_KEY` is the only LLM key on `metnmat-chatbot`; no OpenAI key exists
  on any service). Nothing OpenAI-related needs migrating.
- **`metnmat-media-prod` is correct** — confirmed as the live `GCS_BUCKET` value.

---

## 1. Current architecture

```
                 GoDaddy DNS
                      │
      ┌───────────────┼────────────────┐
      │               │                │
 www.metnmat.com  admin.metnmat.com  chat.metnmat.com
      │               │                │
   Cloud Run       Cloud Run        Cloud Run          asia-south1
 metnmat-website  metnmat-dashboard metnmat-chatbot
   (Next.js 15)   (Payload CMS 3)   (Bun + Express)
      │               │                │
      └───────┬───────┴────────┬───────┘
              │                │
      MongoDB Atlas      GCS metnmat-media-prod
      (EXTERNAL SaaS)     (private bucket)
```

Supporting GCP services: Artifact Registry (2 repos), Cloud Build (3 triggers),
Secret Manager (22 secrets / 241 enabled versions).

**Ingress note:** whether a customer HTTPS Load Balancer sits in front is **NOT
established** — `compute.forwardingRules.list` is denied to this service account.
Response headers show only `server: Google Frontend`, which is consistent with
either a Cloud Run domain mapping *or* an HTTPS LB. **Human verification needed**
(§15).

---

## 2. Services — the runtime contract ECS must reproduce

| | metnmat-website | metnmat-dashboard | metnmat-chatbot |
|---|---|---|---|
| Source | this repo, `apps/website` | this repo, `apps/dashboard` | **separate repo** |
| Runtime | Next.js 15.1.6, React 19 | Payload CMS 3.85.1 on Next.js | Bun + Express 5 + Mastra |
| Dockerfile | `Dockerfile.website` | `Dockerfile.dashboard` | in the other repo |
| Build output | `output: standalone` | none — ships workspace | — |
| Start command | `node apps/website/server.js` | `sh -c "pnpm exec next start -p ${PORT:-8080}"` | — |
| Port | `8080` (`ENV PORT=8080 HOSTNAME=0.0.0.0`) | `8080` (`EXPOSE 8080`) | 8080 |
| Runs as | `USER nextjs` (non-root) ✅ | **root** ⚠️ | — |
| Health endpoint | **`/api/health`** ✅ | **NONE** ⚠️ | unknown |
| Cloud Run CPU/mem | 1 vCPU / 512Mi | 1 vCPU / 1Gi | 1 vCPU / 512Mi |
| minScale / maxScale | 0 / 3 | 0 / 3 | 0 / 3 |
| Concurrency | 80 | 80 | 80 |
| Timeout | 300s | 300s | 300s |

**Two gaps for ECS, both from the same cause — Cloud Run only probes the TCP
port, an ALB target group needs an HTTP path returning 200:**

- ⚠️ **The dashboard has no health endpoint.** An ALB target group needs one or
  the service will be marked unhealthy and drained. Options: add
  `apps/dashboard/src/app/api/health/route.ts`, or point the target group at a
  path that already returns 200. **This is a required code change — the only one
  besides storage.**
- ⚠️ **The dashboard runs as root.** Cloud Run does not care; it is poor practice
  on ECS and worth fixing during the move.

`/api/health` on the website is exactly what an ALB wants:

```ts
// apps/website/src/app/api/health/route.ts — GET /api/health, simple liveness probe
return NextResponse.json({ ok: true, service: "website-api", ts: ..., features: {...} });
```

---

## 3. The GCP-specific code surface — it is two lines

This is the headline finding of discovery. The application is almost entirely
cloud-agnostic already:

```
apps/dashboard/package.json:20        "@payloadcms/storage-gcs": "3.85.1",
apps/dashboard/src/payload.config.ts:6   import { gcsStorage } from "@payloadcms/storage-gcs";
```

…plus the adapter config block at `payload.config.ts:77,123`, gated on
`GCS_BUCKET` + `GCS_PROJECT_ID` being set.

**Nothing else in either application imports a Google SDK.** There are no
hardcoded Cloud Run URLs in application logic, and no GCS URLs baked into
content — see §7.

---

## 4. External dependencies — what does NOT move

Every one of these is a third-party SaaS reached over HTTPS. They work
identically from AWS. **Migrating them is not required and should not be
attempted.**

| Service | Used by | Evidence |
|---|---|---|
| **MongoDB Atlas** | dashboard, chatbot | `payload.config.ts:256` `mongooseAdapter`, `mongodb+srv://` |
| Upstash Redis | website, chatbot | `UPSTASH_REDIS_REST_URL/TOKEN` (REST, not TCP) |
| Resend | website, dashboard | `RESEND_API_KEY` |
| Razorpay | website | `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` |
| Groq | chatbot | `GROQ_API_KEY` |
| Meta WhatsApp | chatbot | `Meta_WA_*` (4 vars) |
| Open Exchange Rates | website, dashboard | `OPEN_EXCHANGE_RATES_APP_ID` |
| **Google Sign-In** | website | `apps/website/src/backend/lib/google-oauth.ts` |

> **Google Sign-In is not GCP infrastructure.** It is OAuth against
> `accounts.google.com`, and works unchanged from AWS. The only thing that
> matters is the authorised redirect URI — and since the domains are not
> changing, there is nothing to do. Do not confuse it with the GCP project.

**The database never moves.** That single fact removes the hardest and riskiest
part of most cloud migrations, and it is why this migration is tractable.

---

## 5. Databases

| Database | Owner | Note |
|---|---|---|
| `metnmat_cms` | Payload CMS | The CMS database |
| `metnmat` | chatbot | **A different database.** Pointing the CMS here empties the shop and 500s `depth=1` queries |
| `metnmat_cms_dev` | local dev only | Confirmed in `apps/dashboard/.env` |

In production `MONGODB_URI` is injected from Secret Manager and the database
name is carried inside the URI; there is no separate `MONGODB_DB` env var on the
Cloud Run service.

**Blocking prerequisite for AWS:** if the Atlas cluster restricts by IP,
AWS egress addresses must be allow-listed **before** anything on AWS can
connect, and **GCP's ranges must be retained** or rollback breaks. Requires
Atlas console access — see §15.

---

## 6. Storage

| | |
|---|---|
| Bucket | `metnmat-media-prod` (private) |
| Adapter | `@payloadcms/storage-gcs` 3.85.1 |
| Served via | the CMS at `/api/media/file/<filename>` — **not** directly from the bucket |
| Public read | `media` only. `documents`, `enquiry-uploads`, `blog-submission-files` are access-controlled |
| Cache header | `public, max-age=31536000, immutable` (added 2026-08-06, media only) |

**Bucket size could not be measured** — `gcloud storage` is denied to this
service account. A media figure of ~15.6 MiB was measured earlier via the CMS
API. Treat the copy as small but **verify object count and total bytes before
and after** (§8 of your brief).

**Critical for S3:** the three non-`media` collections must **not** become
publicly readable. `blog-submission-files` holds unpublished manuscripts. S3
Block Public Access must stay fully on, with the ECS task role granted read
access — never a public bucket policy.

---

## 7. URLs, SEO and why they survive

Media URLs are **derived at read time, not stored in MongoDB** — `mediaUrl()` in
`apps/website/src/frontend/lib/cms.ts:45` builds them from the CMS origin. So
switching GCS→S3 rewrites nothing in the database, and no content migration is
needed for media links.

Domains do not change, so these all continue to work untouched: canonical URLs,
the 132-URL sitemap, `robots.txt`, `llms.txt`, structured data, and the 122
legacy `metnmat.in` redirects in `legacy-redirects.mjs`.

---

## 8. Webhooks and background work

| Concern | Location |
|---|---|
| Razorpay webhook | `apps/website/src/app/api/checkout/webhook/route.ts` |
| Razorpay verify | `apps/website/src/app/api/checkout/verify/route.ts` |
| Revalidation hook | `apps/website/src/app/api/revalidate/route.ts` (CMS → website) |
| Meta WhatsApp webhook | chatbot service (separate repo) |

**No cron or scheduled jobs exist.** Grep hits for `cron|schedule|setInterval`
resolve to an admin UI auto-refresh component and analytics hooks — all
request-driven. Nothing time-driven needs an EventBridge rule.

⚠️ Payload's seed runs on **every boot** (`payload.config.ts` `onInit`), and
`pruneStale` deletes products whose slug is not in the bundled catalogue. A
misconfigured first ECS boot could therefore *mutate production data*. This is
the single most dangerous behaviour to get wrong on first deploy.

---

## 9. CI/CD today

| Trigger | Builds | Note |
|---|---|---|
| `metnmat-website-auto-deploy` | `cloudbuild.website.deploy.yaml` | |
| `rmgpgab-…website…WExqs` | root `Dockerfile`, `--no-cache` | **DUPLICATE** — races the above |
| `rmgpgab-…dashboard…obs` | `cloudbuild.dashboard.deploy.yaml` | |

All three fire on `^main$` with **no `includedFiles`**, so every push rebuilds
everything. Measured: 34 of 36 commits built 3×, median 5.0 min, on
`E2_HIGHCPU_8`. GitHub Actions `ci.yml` runs but gates nothing.

**For the migration:** the AWS pipeline must be **added alongside** these, never
replacing them, so both clouds stay deployable. Path filters should be applied
to the AWS workflow from day one.

---

## 10. GCP → AWS service mapping

| GCP | AWS | Notes |
|---|---|---|
| Cloud Run | **ECS Fargate + ALB** | ⚠️ See the economics warning below |
| Artifact Registry | ECR | Straight swap |
| Cloud Build | GitHub Actions + OIDC | No long-lived keys |
| Secret Manager | Secrets Manager *or* SSM Parameter Store | 22 secrets — compare cost |
| GCS | S3 | Adapter swap + one-time copy |
| Cloud Run domain mapping | ACM + ALB (+ CloudFront) | ACM for CloudFront must be **us-east-1** |
| Cloud Logging | CloudWatch Logs | |
| — | **VPC, subnets, NAT** | New concern; NAT Gateway is a real cost |
| MongoDB Atlas | **MongoDB Atlas** | Unchanged |

### ⚠️ The economics warning you need before choosing

Your Cloud Run services are all **`minScale=0` with CPU throttling on** — you
currently pay **nothing when idle**. Neither ECS Fargate nor App Runner
reproduces that:

- **ECS Fargate** bills per vCPU/GB-second for as long as a task runs. Scale-to-
  zero means `desiredCount=0`, i.e. the service is *off*.
- An **ALB** has a fixed hourly charge **even at zero traffic**.
- A **NAT Gateway** (needed if tasks sit in private subnets and must reach Atlas,
  Razorpay, Resend, Groq) has a fixed hourly charge **plus** per-GB processing.
- **App Runner** does not scale to zero either.

**Expect AWS to cost more at this traffic level than Cloud Run does.** That is
not an argument against migrating — but you should decide with the number in
front of you, not discover it on the first invoice. Detailed modelling belongs in
`AWS-COST-ESTIMATE.md`; the fixed-cost floor (ALB + NAT + Fargate minimum) is the
figure that matters most.

---

## 11. Proposed AWS architecture (simplest production-safe shape)

```
GoDaddy DNS ──► ACM cert ──► Application Load Balancer (public subnets)
                                   │
                    ┌──────────────┼──────────────┐
              target group    target group   target group
                 website        dashboard       chatbot
                    │               │               │
                 ECS Fargate service (private subnets)
                    │               │               │
                    └───────────────┴───────────────┘
                                   │
                            NAT Gateway ──► internet
                                   │
                    MongoDB Atlas · S3 · Razorpay · Resend · Groq
```

Host-based routing on one ALB keeps this to a single load balancer rather than
three. Region recommendation and its justification belong in
`AWS-ARCHITECTURE.md`; the obvious candidate is **`ap-south-1` (Mumbai)** since
current production is `asia-south1` (also Mumbai) and the user base and offices
are in India — same city, so latency and any Atlas region pairing are preserved.

---

## 12. Migration risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Split-brain writes.** Both stacks share ONE Atlas cluster. The invoice serial counter is an atomic `Counters` document — two live CMS instances could issue **duplicate GST invoice serials**, a tax problem, not a bug | **CRITICAL** | Only ONE cluster may serve writes. The GCP CMS must be out of DNS or read-only the moment AWS takes over |
| R2 | Seed `onInit` + `pruneStale` runs on every boot and can delete products | **CRITICAL** | Verify env and DB name before first ECS boot; snapshot Atlas first |
| R3 | Wrong database name (`metnmat` vs `metnmat_cms`) | HIGH | Assert the DB name in the URI before deploying |
| R4 | Atlas IP allowlist blocks AWS, or GCP is removed from it | HIGH | Add AWS egress **before** deploy; never remove GCP's |
| R5 | Media uploaded on AWS is invisible to GCP after rollback | HIGH | Single-writer rule + sync back before returning |
| R6 | Dashboard has no health endpoint → ALB drains it | HIGH | Add one before the ECS service is created |
| R7 | GCP currently down, so there is no rollback target | HIGH | Restore GCP before cutover |
| R8 | Cost surprise from ALB + NAT + non-zero-scale Fargate | MEDIUM | Model before deploying |
| R9 | Razorpay webhook / OAuth redirect not updated | MEDIUM | Domains unchanged, so likely no-op — **verify** |
| R10 | `importMap.js` must keep exactly its 2 `GcsClientUploadHandler` entries | MEDIUM | Do not run `next dev`; verify before every build |

---

## 13. Phases (as per your brief)

Phase 0 Discovery **← you are here** · 1 Backup · 2 Architecture · 3 AWS
foundation · 4 Containers · 5 Storage · 6 Secrets · 7 DB connectivity ·
8 Domain/SSL · 9 App testing · 10 Perf/security · 11 **DNS cutover** ·
12 Monitoring · 13 Rollback window · 14 Decommission (only on explicit approval).

---

## 14. Rollback strategy (summary)

Rollback is a **DNS change**, which is why TTL must be lowered *before* cutover,
not after. Full runbook goes in `AWS-ROLLBACK-PLAN.md`.

1. Lower all record TTLs to 60s and wait out the previous TTL **before** cutover.
2. Cut over. Observe.
3. If AWS misbehaves: repoint DNS to GCP. Recovery ≈ one TTL.
4. Sync media uploaded on AWS back to GCS before declaring the return complete.
5. **Nothing on GCP is deleted during the rollback window.**

---

## 15. Unknowns requiring human verification

These cannot be resolved with the access available here.

| # | Unknown | Why it is blocked | How to resolve |
|---|---|---|---|
| U1 | **Why production is 503** | Billing API not enabled + denied; Logging denied | Console → Billing; Cloud Run → Logs |
| U2 | Whether an HTTPS Load Balancer fronts the domains | `compute.forwardingRules.list` denied | Console → Network services → Load balancing |
| U3 | GCS bucket object count and total bytes | `gcloud storage` denied | `gcloud storage du -s gs://metnmat-media-prod` as an owner |
| U4 | Artifact Registry size / image count | `gcloud artifacts` denied | Console → Artifact Registry |
| U5 | Atlas IP allowlist contents and cluster tier | No Atlas credentials here | Atlas → Network Access |
| U6 | Whether an AWS account exists, and its region/billing | No AWS credentials in this environment | You |
| U7 | Actual current traffic (needed for honest cost modelling) | Cloud Monitoring denied | Console → Cloud Run → Metrics |
| U8 | GoDaddy DNS record inventory and current TTLs | No registrar access | GoDaddy → DNS management |

---

## 16. What was NOT done

Per your instructions, and stated explicitly:

- No production change of any kind.
- No DNS change.
- No deletion or modification of any GCP resource.
- No code change — the two required changes (S3 adapter, dashboard health
  endpoint) are **identified only**, not implemented.
- No secret value was read, printed or written anywhere. Only names appear.
