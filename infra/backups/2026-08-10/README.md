# Phase 1 Backup — 2026-08-10

Configuration backup taken before any AWS migration work. **Read-only capture.
Nothing on GCP was modified, disabled or deleted. No secret value was read.**

---

## ⚠️ ROOT CAUSE OF THE OUTAGE — CONFIRMED

The production outage is **billing**. This is no longer a hypothesis — Google
returned it directly:

```
ERROR: (gcloud.secrets.list) ... does not have permission to access
projects instance [metnmat-website]:
This API method requires billing to be enabled.
Please enable billing on project #metnmat-website
```

That single fact explains every symptom observed:

| Symptom | Explanation |
|---|---|
| All 3 Cloud Run services return 503, even `/robots.txt` | Cloud Run cannot run containers without billing |
| Revisions still report `Ready=True`, traffic 100% | The *configuration* is intact; only execution is stopped |
| Project `ACTIVE`, APIs enabled, last builds SUCCESS | Nothing was deleted or misconfigured |
| `gcloud secrets list` fails; `gcloud run services list` succeeds | Metadata reads are free-tier; Secret Manager requires billing |

**Fix:** Console → Billing → attach a valid billing account to
`metnmat-website`. Recovery is typically minutes once billing propagates; no
redeploy should be needed, because the revisions are still healthy.

### Why this is urgent beyond the outage

While billing is disabled, GCP resources enter a grace period and are
**eventually deleted** — including the `metnmat-media-prod` bucket holding every
product image. Restoring billing protects the data, not just the uptime.

**It also blocks the migration.** The whole strategy is a parallel run with GCP
as the instant rollback target. A suspended GCP is not a rollback target. Restore
billing *first*, then migrate deliberately.

---

## What is in this backup

| Path | Contents | Captured |
|---|---|---|
| `cloudrun/*.yaml` | Full service definitions for all 3 services — the exact spec ECS/App Runner must reproduce (CPU, memory, concurrency, timeout, scaling, env, service account, image digest) | ✅ complete |
| `triggers/*.yaml` | All 3 Cloud Build trigger definitions, including the duplicate website trigger | ✅ complete |
| `inventory/secret-names.txt` | Secret **names** and enabled-version counts | ⚠️ **INCOMPLETE** |

### The secret inventory is incomplete

`gcloud secrets list` is now billing-blocked, so the file is empty. The data was
captured earlier the same day and is recorded in
[`docs/AWS-SECRETS-MAPPING.md`](../../../docs/AWS-SECRETS-MAPPING.md):
**22 secrets, 241 enabled versions**, with the full name-to-service mapping.

**Re-run this once billing is restored:**

```bash
gcloud secrets list --format="value(name)" | tr -d '\r' | grep . > names.txt
while IFS= read -r s; do
  n=$(gcloud secrets versions list "$s" --format="value(state)" | tr -d '\r' | grep -ci enabled)
  printf "%4s  %s\n" "$n" "$s"
done < names.txt
```

> Note the `tr -d '\r'`. gcloud emits CRLF on Windows, and without stripping it
> every secret name carries a trailing `\r`, so every lookup silently returns
> zero. That mistake was made and corrected while producing this backup.

---

## Verified safe to commit

These files were scanned before being committed:

- **All 27 secret references are `secretKeyRef` entries — names only, no values.**
- Literal env values present are non-sensitive configuration: public URLs, the
  bucket name, the Upstash REST *endpoint* (its token is a secret reference),
  business email addresses, and an API version string.
- A credential-pattern scan (`mongodb+srv://`, `sk-`, `rzp_`, `re_`, `AIza`,
  long tokens) returned only a git commit SHA and trigger names.

---

## STILL REQUIRED — data backups only you can take

Neither can be done from here. **Both are prerequisites for Phase 2.**

### 1. MongoDB Atlas snapshot — the highest-value backup

Holds every product, order, customer, invoice and analytics record. It is a
separate vendor on separate billing, so it is **unaffected by the GCP outage** —
but take a snapshot before any migration work begins.

Atlas → Cluster → **Backup** → *Take Snapshot Now*. Record the snapshot ID and
timestamp here when done.

Also capture, for the AWS connectivity step:
- the **IP access list** (AWS egress must be added; **GCP's entries must be
  retained** or rollback breaks)
- the cluster tier and region
- confirmation that the CMS database is `metnmat_cms` — **not** `metnmat`, which
  is the chatbot's separate database

### 2. GCS bucket copy

`gcloud storage` is denied to the deploy service account, and billing now blocks
it regardless. As an owner, once billing is restored:

```bash
# size and object count first — record both
gcloud storage du -s gs://metnmat-media-prod
gcloud storage ls -r gs://metnmat-media-prod | wc -l

# then a local copy
gcloud storage rsync -r gs://metnmat-media-prod ./gcs-backup-2026-08-10
```

Verify the local object count and byte total match before trusting the copy.

---

## Not captured, and why

| Item | Reason |
|---|---|
| Artifact Registry image inventory | `gcloud artifacts` denied to this service account |
| Cloud Logging export | `gcloud logging` denied |
| Load balancer / DNS config | `compute.forwardingRules.list` denied |
| Monitoring dashboards | `gcloud monitoring` denied |
| GoDaddy DNS records + TTLs | No registrar access |

`importMap.js` needs no separate backup — it is version-controlled at
`apps/dashboard/src/app/(payload)/admin/importMap.js` and verified to hold
exactly its 2 `GcsClientUploadHandler` entries.
