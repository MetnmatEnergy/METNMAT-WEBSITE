# Phase 2 — Architecture Decision: App Runner vs ECS Fargate + ALB

**No AWS resources have been created. No production, DNS, GCS or MongoDB change
has been made.** This is analysis only, per the gate.

Compiled 2026-08-10 for the architecture discovered in Phase 0.

---

## Part 1 — Migration-readiness gate

### 1.1 Is the project actually billing-enabled?

**No — and this is Google's own API answering for this specific project.**

You reported billing as linked and enabled. The `gcloud beta billing projects
describe` output was not included (the `[PASTE THE OUTPUT OF]` placeholder came
through empty), so I tested the only way available to me. Secret Manager is a
billing-gated API, and it still returns:

```
ERROR: (gcloud.secrets.list) ... does not have permission to access
projects instance [metnmat-website]:
This API method requires billing to be enabled.
Please enable billing on project #metnmat-website
```

That error names `metnmat-website` explicitly. It is not a permissions error and
not a stale cache — it is the live billing gate.

### 1.2 Can the 503 still be attributed to billing?

**Yes. Nothing contradicts it, and the evidence has only strengthened.**

| Check | Result |
|---|---|
| `www`, `/shop`, `admin`, raw `run.app` | all **503** |
| Free-tier metadata reads (`run services list`, `builds list`) | **OK** |
| Billing-gated read (`secrets list`) | **BLOCKED** |
| Cloud Run config (revisions Ready, traffic 100%, generation reconciled) | intact |

The split between free-tier reads working and billing-gated reads failing is the
signature of a billing-disabled project. A separate root cause would have to
explain that split *and* leave the configuration perfectly healthy.

### 1.3 If it were `billingEnabled=true`, what would be next?

Recorded now so it is ready if the gate clears and the 503 persists:

1. **Propagation.** Re-enablement can lag. Cloud Run may also need a nudge —
   deploying a new revision (or re-pointing traffic at the current one) forces a
   fresh scheduling attempt.
2. **A budget with an enforcement hook.** A budget wired to Pub/Sub → a Cloud
   Function that calls `projects.updateBillingInfo` will *re-disable* billing
   minutes after you enable it. Check **Billing → Budgets & alerts**. This
   pattern exactly matches "I enabled it and it went back."
3. **Wrong project or wrong account.** The error names `metnmat-website`;
   confirm that is the project you changed, and that the billing account itself
   is not delinquent (a declined card leaves the account "open" but unusable).
4. **Only then** application-level causes — MongoDB Atlas reachability, the
   `metnmat_cms` vs `metnmat` database-name trap.

**To settle it definitively, run as an owner (not the deploy service account):**

```bash
gcloud auth login
gcloud beta billing projects describe metnmat-website
```

Expect `billingEnabled: true` and a `billingAccountName`. If it says `false`, the
project is not linked regardless of what the Billing page shows.

### 1.4 Readiness verdict

**NOT READY for Phase 2.** The migration strategy is a parallel run with GCP as
the rollback target. GCP cannot currently serve, so there is no rollback target.
Proceeding now converts a reversible migration into a one-way emergency exit.

---

## Part 2 — App Runner vs ECS Fargate + ALB

### 2.0 Read this before the table

An earlier detailed plan recommending App Runner was put through adversarial
review and came back **UNSOUND**, with three critical defects. They are properties
of the *migration approach*, not of App Runner, and they must be fixed under
either option:

1. **There are TWO databases, not one.** `metnmat_cms` (CMS) and `metnmat`
   (chatbot). The plan treated Atlas as a single shared cluster and never
   enforced a single writer.
2. **"Test fully on `*.awsapprunner.com` before touching DNS" is false.**
   `NEXT_PUBLIC_*` values are baked into the image at build time, so an AWS
   website build carries production URLs. You cannot fully exercise it on a
   different hostname, which means the first real traffic lands on an
   incompletely-proven target.
3. **A misconfigured AWS dashboard poisons the shared production database, and a
   DNS rollback does not undo it.** `payload.config.ts:77` silently falls back to
   local disk if `GCS_BUCKET`/`GCS_PROJECT_ID` are unset, and `onInit` runs the
   seed — including `pruneStale`, which deletes products — on **every boot**.

Treat these as prerequisites, not footnotes.

### 2.1 Comparison

| Dimension | **App Runner** | **ECS Fargate + ALB** |
|---|---|---|
| **Cost, low traffic** | **~$25–35/mo.** Idle floor ~$23 is provisioned memory | **~$45–55/mo.** ~$27 compute + ~$16 ALB + LCUs |
| **Cost, 10K users/mo** | ~$26–40. Active CPU is billed only during requests, so traffic barely moves it | ~$45–60. Compute is provisioned, so traffic barely moves it either — the ALB/LCU floor dominates |
| **Scaling** | Concurrency-based, maps 1:1 to Cloud Run's `concurrency=80` | Target-tracking on CPU/memory or ALB request count. More control, more to configure |
| **Scale-to-zero** | **No.** Bills provisioned memory 24/7 | **No.** `desiredCount=0` means the service is off |
| **Custom domains** | Built in, per service, with its own DNS validation | Via ALB listener + host-based routing rules |
| **HTTPS** | Managed automatically | ACM cert on the ALB listener; you manage it |
| **Env vars** | Direct on the service config | Task definition `environment` |
| **Secrets** | `valueFrom` → Secrets Manager / SSM | `valueFrom` → identical |
| **S3** | Instance role | Task role |
| **MongoDB Atlas** | Public egress; **egress IP is not static** → Atlas allowlist needs `0.0.0.0/0` or a VPC connector | In a VPC behind NAT → **stable egress IP**, so a tight Atlas allowlist works |
| **Upstash Redis** | REST over HTTPS — no VPC needed either way | Same |
| **Logging** | CloudWatch automatically | CloudWatch via `awslogs` driver |
| **Health checks** | HTTP path per service | ALB target group health check |
| **Deployment** | Push to ECR → auto or manual deploy | Update task definition → rolling service update |
| **Rollback** | **Redeploy a previous image.** No revision history | Roll back the task definition revision — closer to Cloud Run |
| **Startup** | Managed; no CPU-boost equivalent | Same, plus ALB target registration/draining delay |
| **WebSockets / long connections** | ⚠️ **120s request timeout, not configurable** | ✅ ALB idle timeout configurable to 4000s |
| **Operational complexity** | **Low.** ~1 resource per service | **High.** VPC, subnets, IGW, NAT, ALB, TGs, listener rules, cluster, services, task defs — ~8+ per service |
| **Security** | Fewer moving parts, fewer misconfigurations | Private subnets and security groups = stronger isolation, more to get wrong |
| **Future scalability** | Fine to moderate scale; you hit its ceilings later | Effectively unlimited; the standard path |

### 2.2 The three findings that decide it

**1. App Runner's 1-vCPU tier requires ≥ 2 GB memory.** Your website and chatbot
run on **512 MiB** today. You cannot match that — you must over-provision to
2 GB each, which is where the ~$23 idle floor comes from. It is a platform
constraint, not a tuning choice.

**2. Atlas IP allowlisting splits the two cleanly.** App Runner has no stable
egress IP without a VPC connector, so a tight Atlas allowlist is impractical —
you would widen it to `0.0.0.0/0`, which is a real security regression from
today. Fargate behind a NAT Gateway has a fixed egress IP and keeps the allowlist
tight. **If your Atlas cluster restricts by IP, this alone argues for Fargate.**

**3. The 120s timeout is a hard ceiling on App Runner.** Nothing found in Phase 0
needs longer, but Cloud Run is configured at 300s today, so this is a genuine
reduction. Payload's boot-time seed is the workload most likely to approach it.

### 2.3 The economics, stated plainly

| | Monthly |
|---|---|
| **Cloud Run today** (`minScale=0`, CPU-throttled) | **≈ $0 at idle** |
| App Runner | ~$25–35 |
| Fargate + ALB | ~$45–55 |

**This migration increases your compute bill by roughly $25–55/month, and almost
all of it is the loss of scale-to-zero.** Neither AWS option reproduces it.

That is not an argument against migrating — there may be good reasons unrelated
to cost — but it should be a decision, not a discovery. All figures are **list
price, documented from vendor pricing, not measured**; I hold no AWS credentials
and could not query the Pricing API. Regional rates for `ap-south-1` will differ
and must be re-checked in the AWS Pricing Calculator.

---

## Part 3 — Recommendation

### **ECS Fargate + a single shared ALB.**

This overrides the earlier App Runner recommendation, and it agrees with the
target architecture in your own brief. Reasoning, in priority order:

1. **Atlas security.** App Runner without a VPC connector has no stable egress
   IP, forcing an Atlas allowlist of `0.0.0.0/0`. Your brief says *"do not weaken
   security merely to make migration easier."* Fargate + NAT keeps the allowlist
   tight. **This is the deciding factor.**
2. **Rollback fidelity.** Task-definition revisions behave like Cloud Run
   revisions. App Runner has no revision history — and your images currently
   push to a **mutable `:latest` tag**, so "redeploy the previous image" would
   have nothing to redeploy. Immutable SHA tags are a prerequisite either way.
3. **Memory honesty.** Fargate runs 0.25 vCPU / 0.5 GB tasks, matching today's
   512 MiB. App Runner forces 2 GB.
4. **No timeout cliff.** Configurable ALB idle timeout instead of a hard 120s.
5. **It is the path you already chose**, and it is where you would end up anyway
   if traffic grows.

**What you give up:** roughly $20/month more than App Runner, and materially more
to build and tear down. Given you intend to **return to GCP**, that teardown cost
is real — but it does not outweigh widening your database to the entire internet.

**If Atlas does *not* restrict by IP**, that first argument evaporates and App
Runner becomes competitive on both cost and simplicity. **Confirm the Atlas
allowlist before Phase 3** — it is the single input that could flip this decision.

---

## Part 4 — Prerequisites before any AWS resource is created

| # | Prerequisite | Why | Owner |
|---|---|---|---|
| P1 | **Restore GCP billing** | No rollback target without it | You |
| P2 | Atlas snapshot | Zero-data-loss requirement | You |
| P3 | Confirm the Atlas IP allowlist | Decides App Runner vs Fargate | You |
| P4 | GCS bucket copy + object count | Verifiable storage migration | You (needs billing) |
| P5 | Switch images to immutable `:$COMMIT_SHA` tags | `:latest` leaves no rollback target | Me, on approval |
| P6 | Add a dashboard health endpoint | ALB target groups need one | Me, on approval |
| P7 | Decide the storage design (S3 adapter vs GCS-from-AWS) | Blocks the dashboard container | You + me |
| P8 | Guard the seed / `pruneStale` on first AWS boot | Can delete production products | Me, on approval |
| P9 | Decouple `www`/`admin`/`chat` from the apex CNAME | Otherwise all three cut over at once | You (GoDaddy) — **verify first** |
| P10 | Confirm the AWS account, region and billing | Nothing can be built without it | You |

---

## Status

**STOPPED, awaiting approval.** No AWS resources created, no production change,
no DNS change, no GCS migration, no AWS→MongoDB connection.

The blocking item is **P1**. Until GCP serves again, a reversible migration is
not available.
