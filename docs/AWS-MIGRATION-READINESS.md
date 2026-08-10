# AWS Migration Readiness

**Analysis only.** No AWS resource created, no GCP production change, no DNS
change, no GCS migration, no MongoDB change, no application code change, nothing
deployed.

Updated 2026-08-10.

---

## 1. Billing gate — STILL DISABLED

### The evidence I could not obtain

The `gcloud beta billing projects describe metnmat-website` output was **not
supplied** — the `[PASTE OUTPUT HERE]` placeholder arrived empty, for the second
time. Nothing in this section is based on that command.

### What I tested instead

Two independent billing-gated APIs, both against this project:

| API | Result |
|---|---|
| `gcloud secrets list` | `This API method requires billing to be enabled. Please enable billing on project #metnmat-website` |
| `gcloud artifacts repositories list` | blocked |
| `gcloud run services list` (free tier) | **OK** |
| `gcloud builds list` (free tier) | **OK** |
| `www.metnmat.com`, `admin.metnmat.com` | **503** |

**Verdict: `billingEnabled` is false for `metnmat-website`.** The error names the
project explicitly, comes from Google rather than from inference, and the pattern
— free-tier reads succeed, billing-gated reads fail — is exactly what a
billing-disabled project produces.

I want to be plain: you have twice reported billing as enabled, and Google's API
twice disagreed. I am not doubting that you enabled *something*; I am reporting
that this project is not seeing it.

### The 503 remains attributable to billing

Nothing observed contradicts it. Cloud Run configuration is intact (revisions
`Ready`, traffic 100%, generation reconciled), so the containers are not failing
— they are not being allowed to run.

### Most likely explanations, in order

1. **A budget with an enforcement hook.** A budget wired to Pub/Sub → a Cloud
   Function calling `projects.updateBillingInfo` re-disables billing minutes
   after you enable it. This is the only common mechanism that produces
   "I enabled it and it went back," which now matches your reports twice.
   **Check Billing → Budgets & alerts first.**
2. **Enabled on the account, project never linked.** The account looks healthy;
   the project shows disabled. Check the **My Projects** tab, not the account page.
3. **Billing account delinquent.** A declined card leaves the account "open" but
   unusable, and projects behave as unbilled.
4. **Wrong project.** The error names `metnmat-website` specifically.

### The command that settles it

Run as an owner — **not** the deploy service account, which cannot read billing:

```bash
gcloud auth login
gcloud beta billing projects describe metnmat-website
```

Expected on success:
```yaml
billingAccountName: billingAccounts/XXXXXX-XXXXXX-XXXXXX
billingEnabled: true
projectId: metnmat-website
```

If `billingEnabled: false`, link it:
```bash
gcloud beta billing accounts list
gcloud beta billing projects link metnmat-website --billing-account=XXXXXX-XXXXXX-XXXXXX
```

Then re-check in 5 minutes. If it flips back to `false`, it is cause 1.

---

## 2. Safety review of the three migration blockers

Two of the three turn out to be **less dangerous than I previously stated**, and
one is worse. Corrections are marked.

---

### Blocker 1 — MongoDB single-writer / invoice serial safety

**Severity: MEDIUM.** ⬇️ *Downgraded from CRITICAL. My earlier claim was wrong.*

**Exact code path**

```
apps/dashboard/src/hooks/order-workflow.ts:122-124
  const fy  = fyLabel();                                            // "2627"
  const seq = await bumpCounter(countersModel(req.payload.db), `order-invoice-${fy}`);
  d.invoiceNumber = formatInvoiceNumber(fy, seq);                   // "INV-2627-000042"

apps/dashboard/src/hooks/customer-code.ts  — bumpCounter()
  counters.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  // retries once on duplicate-key (11000)
```

**Correction.** I previously said a split-brain would issue duplicate GST invoice
serials. **That is not true.** `findOneAndUpdate` with `$inc` is atomic on a
single document in MongoDB, so two concurrent writers **against the same
database** are serialised by the server and cannot receive the same value. The
code is correct, and the comment at `customer-code.ts:51` says exactly why the
raw model is used instead of Payload's read-modify-write `update()`.

**The real failure scenario** is not concurrency — it is *two different
databases*:

> The AWS dashboard is configured with `MONGODB_URI` pointing at `metnmat`
> (the chatbot's database) instead of `metnmat_cms`. It now has its own empty
> `counters` collection. It mints `INV-2627-000001` — a serial the GCP stack
> already issued. Two customers hold invoices with the same GST number.

**Production impact.** GST Rule 46 requires a consecutive serial unique within
the financial year. Duplicates are a statutory filing problem, not a bug. Orders
and customers would also split across two databases invisibly.

**Required safeguard.** Assert the database name at boot, before any write. The
URI already carries it, so a startup check that the resolved database name equals
`metnmat_cms` and fails fast otherwise would close this permanently — and would
also have prevented the historical incident recorded as gotcha #1 in `CLAUDE.md`.

**Blocks AWS deployment?** **No** — provided the AWS task definition uses the
same `MONGODB_URI` secret value as GCP. It becomes critical only if the URI is
retyped or a "new" one is created.

---

### Blocker 2 — Payload `onInit` + `pruneStale`

**Severity: MEDIUM.** ⬇️ *Downgraded from CRITICAL. A safeguard already exists.*

**Exact code path**

```
apps/dashboard/src/payload.config.ts:230   onInit: async (payload) => { ... await seed(payload) ... }
apps/dashboard/src/seed.ts:1403            const allowPrune = process.env.SEED_PRUNE_PLACEHOLDERS === "true";
apps/dashboard/src/seed.ts:1406            if (allowPrune) await pruneStale(payload, "products",   prodSlugs);
apps/dashboard/src/seed.ts:1419            if (allowPrune) await pruneStale(payload, "categories", catSlugs);

apps/dashboard/src/seed.ts:257  pruneStale()
  for (const doc of all.docs) {
    if (!doc.slug || !keep.has(doc.slug)) await payload.delete({ collection, id: doc.id });
  }
```

**Correction.** `pruneStale` is **opt-in only**, gated behind
`SEED_PRUNE_PLACEHOLDERS === "true"`. **It is not set on any of the three Cloud
Run services** — verified against the Phase 1 backup. So it is dormant in
production today, and `CLAUDE.md` gotcha #4 overstates the current risk.

`seed()` itself *does* run on every boot, but it is conservative by design:
collections seed only when empty, globals only when unset. The wrapper at
`payload.config.ts:236` also catches seed failures so a bad seed cannot
crash-loop the container.

**Failure scenario.** Someone builds the ECS task definition by copying env vars
from a local `.env` or from documentation rather than from the live Cloud Run
service, and includes `SEED_PRUNE_PLACEHOLDERS=true`. On first boot, every
product whose slug is not in the bundled catalogue is **deleted from the shared
production database**. A DNS rollback does not undo it — the data is gone from
the database both stacks share.

**Required safeguard.** Build the task definition **from
`infra/backups/2026-08-10/cloudrun/metnmat-dashboard.yaml`**, never by hand.
Explicitly assert `SEED_PRUNE_PLACEHOLDERS` and `DIRECTOR_RESET` are unset before
first boot. Take the Atlas snapshot first regardless.

**Blocks AWS deployment?** **No**, but it makes an Atlas snapshot and a reviewed
env diff mandatory before the first dashboard task runs.

---

### Blocker 3 — Payload GCS → S3 storage fallback

**Severity: CRITICAL.** ✅ *Confirmed. This is the genuine blocker.*

**Exact code path**

```
apps/dashboard/src/payload.config.ts:77
  const useGCS = Boolean(process.env.GCS_BUCKET && process.env.GCS_PROJECT_ID);

apps/dashboard/src/payload.config.ts:118-127
  const storagePlugins = useGCS
    ? [ gcsStorage({
          enabled: true,
          collections: storageCollections,
          bucket:  process.env.GCS_BUCKET || "",
          options: {
            projectId:   process.env.GCS_PROJECT_ID,
            keyFilename: process.env.GCS_KEY_FILENAME,   // undefined → ADC
          },
      }) ]
    : [];                                    // ← empty ⇒ Payload uses LOCAL DISK

apps/dashboard/src/payload.config.ts:262   plugins: storagePlugins,
```

The source comment states it outright: *"Falls back to local disk only when unset
(dev convenience)."*

**Two distinct failure scenarios, both silent**

1. **Env vars unset on ECS.** `storagePlugins` is `[]`, Payload writes uploads to
   the container filesystem. Fargate task storage is **ephemeral**. The admin
   works, uploads appear to succeed, thumbnails render — and **every uploaded
   file is destroyed on the next deploy or task replacement.** Nothing logs an
   error, because from Payload's perspective nothing failed.

2. **Env vars set, but no credentials.** `keyFilename` is undefined, so the
   adapter relies on Application Default Credentials. ADC exists on Cloud Run via
   the attached service account. **It does not exist on ECS.** The adapter would
   fail to authenticate against GCS.

**Production impact.** Scenario 1 is silent, permanent data loss of customer- and
staff-uploaded media, discovered only when an image 404s later. Scenario 2 is at
least loud.

**Required safeguard.** Two parts, and the second matters more than the first:

- Decide the storage design *before* the container runs — either the
  `@payloadcms/storage-s3` adapter (not currently in the repo — no `@aws-sdk` or
  `storage-s3` dependency exists), or keep GCS and supply credentials explicitly
  via `GCS_KEY_FILENAME` instead of ADC.
- **Make the fallback fail loudly.** In production, an empty `storagePlugins`
  should throw at boot rather than quietly writing to disk. The existing
  `assertProductionConfig()` at `payload.config.ts:231` is the natural home for
  that check.

**Blocks AWS deployment?** **YES.** The dashboard must not run on AWS until this
is resolved. This is the one item of the three that genuinely gates Phase 3.

---

## 3. Two-database architecture — verified

| | `metnmat_cms` | `metnmat` |
|---|---|---|
| Used by | **metnmat-dashboard** (Payload CMS) | **metnmat-chatbot** |
| Written by | Payload, plus the website via internal-key REST | Chatbot service |
| Contents | 39 collections — Products, Orders, Invoices, Customers, Counters, Enquiries, Quotations, Shipments, StockLedger, PaymentEvents, Media, Blog*, Analytics*, Users, StaffRoles, AuditLogs | Chatbot conversations and widget messages |
| Deployed from | this repo | **a separate repo** |

**The website has no MongoDB connection at all.** `MONGODB_URI` is absent from
the `metnmat-website` service — it reads through the CMS REST API. So **the
website is not a database writer**, which materially reduces split-brain surface:
only the dashboard and the chatbot write.

**Evidence.** `CLAUDE.md:42-43` documents both names and warns they are different;
`CLAUDE.md:49` records the historical incident where pointing the CMS at
`/metnmat` emptied the shop and 500'd `depth=1` queries. Both services carry
`MONGODB_URI` as a **secret reference**, so I could not read the values and
therefore **cannot independently prove** which database each resolves to — that
requires an owner to read the secret, or the Atlas UI.

**Consequence for the migration.** Two separate `MONGODB_URI` values must be
carried to AWS, mapped to the correct service. Cross-wiring them is the single
easiest catastrophic mistake available in this migration, and it is exactly the
scenario in Blocker 1.

---

## 4. Readiness verdict

**NOT READY.**

| Gate | Status |
|---|---|
| GCP billing restored | ❌ **Blocking** |
| Atlas snapshot taken | ❌ Not done |
| Atlas IP allowlist confirmed | ❌ Unknown — also decides App Runner vs Fargate |
| Storage design decided (Blocker 3) | ❌ **Blocking** |
| GCS bucket copy + object count | ❌ Blocked by billing |
| AWS account / region / billing | ❌ Unknown |
| Env vars sourced from the Phase 1 backup | ⚠️ Not yet built |

Two hard blockers: **billing** (no rollback target without it) and **Blocker 3**
(the dashboard cannot safely run on AWS until the storage fallback is resolved).

---

## 5. Corrections to my earlier statements

Recorded so the record is accurate:

| Earlier claim | Correction |
|---|---|
| "Split-brain would issue duplicate GST invoice serials" | **Wrong.** The counter is an atomic `$inc`; concurrent writers on the *same* database are safe. The real risk is two *different* databases |
| "`pruneStale` deletes products on every boot" | **Overstated.** It is gated behind `SEED_PRUNE_PLACEHOLDERS=true`, which is not set in production |
| "The GCP-specific surface is two lines" | Accurate for *imports*, but incomplete — the ADC credential assumption at `payload.config.ts:126` is a third dependency with no AWS equivalent |

---

## STOP

Analysis complete. Awaiting approval. Nothing was fixed, created, deployed or
modified.
