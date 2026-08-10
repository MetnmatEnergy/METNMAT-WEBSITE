# Object storage — GCS today, S3 when you choose

Covers Blocker 3 from [`AWS-MIGRATION-READINESS.md`](./AWS-MIGRATION-READINESS.md).

**Nothing about production behaviour has changed.** GCS remains the provider,
with the same bucket and the same credentials. S3 support is present but
**inactive** until `STORAGE_PROVIDER=s3` is set. No media was migrated, copied or
deleted.

---

## 1. The problem this fixes

The storage decision used to be one line:

```ts
const useGCS = Boolean(process.env.GCS_BUCKET && process.env.GCS_PROJECT_ID);
const storagePlugins = useGCS ? [gcsStorage({ ... })] : [];
```

An empty plugin array does not disable uploads — it makes Payload write them to
the **container filesystem**. That filesystem is ephemeral on Cloud Run and on
ECS/Fargate.

The failure is completely silent:

| What happens | What you see |
|---|---|
| Upload is written to container disk | Upload returns **200** |
| Thumbnail generated from container disk | Image renders correctly |
| Task replaced / new deploy | **Every uploaded file is gone** |
| Payload's view of it | Nothing failed — nothing logged |

You find out weeks later, when an image 404s and there is no copy anywhere.

On GCP this stayed hidden because `GCS_BUCKET` and `GCS_PROJECT_ID` happen to be
set on Cloud Run. Moving to ECS means re-declaring every environment variable by
hand — and the one mistake that costs you customer media is the one that
produces no error at all.

---

## 2. What changed

A provider decision extracted into
[`apps/dashboard/src/lib/storage-config.ts`](../apps/dashboard/src/lib/storage-config.ts),
so it is unit-testable without booting Payload or Mongo:

```ts
resolveStorageConfig(env, { isProduction, isBuildPhase })
  → { provider: "gcs", bucket, projectId, keyFilename? }
  → { provider: "s3",  bucket, region, endpoint?, forcePathStyle, ... }
  → { provider: "local", reason }        // development / build only
  → throws StorageConfigError            // production misconfiguration
```

### The rules

| Situation | Behaviour |
|---|---|
| `STORAGE_PROVIDER` unset | **Defaults to `gcs`** — production unchanged |
| Provider valid, config complete | Adapter configured |
| Config incomplete, **production** | **Throws — the process refuses to start** |
| Config incomplete, development | Falls back to local disk with a loud warning |
| Config incomplete, `next build` | Does **not** throw (see §5) |
| Unrecognised `STORAGE_PROVIDER` | **Throws in every environment**, including dev |

An unrecognised provider throws even in development on purpose. A typo like
`STORAGE_PROVIDER=S3!` must never quietly become local disk — that is precisely
the failure being eliminated.

---

## 3. Environment variables

### GCS — current production

| Variable | Required | Notes |
|---|---|---|
| `STORAGE_PROVIDER` | No | Defaults to `gcs` |
| `GCS_BUCKET` | **Yes** | Currently `metnmat-media-prod` |
| `GCS_PROJECT_ID` | **Yes** | Currently `metnmat-website` |
| `GCS_KEY_FILENAME` | No | Omit on Cloud Run — the attached service account supplies ADC |

### S3 — available, inactive

| Variable | Required | Notes |
|---|---|---|
| `STORAGE_PROVIDER` | **Yes — `s3`** | Nothing else activates S3 |
| `S3_BUCKET` | **Yes** | |
| `S3_REGION` | **Yes** | e.g. `ap-south-1` |
| `S3_ENDPOINT` | No | For S3-compatible services (MinIO, R2) |
| `S3_FORCE_PATH_STYLE` | No | `true` for MinIO/R2; leave unset for AWS S3 |
| `S3_ACCESS_KEY_ID` | No | **Omit in production** |
| `S3_SECRET_ACCESS_KEY` | No | **Omit in production** |

> **Credentials are deliberately optional.** On ECS, the **task role** supplies
> them through the AWS SDK's default chain — exactly as the attached service
> account supplies ADC on Cloud Run. That is the preferred setup, because no
> long-lived key exists to leak. Explicit keys are supported for local
> development only.

Setting S3 variables **does not** switch providers. With `GCS_BUCKET` set and
`STORAGE_PROVIDER` unset, GCS wins — so both can be configured during a
migration without ambiguity about which is live.

---

## 4. Production fail-fast

A missing configuration now produces this at boot, and the container stops:

```
[storage] STORAGE_PROVIDER="gcs" but required variable(s) are missing: GCS_BUCKET.
Refusing to start: uploads would be written to the container filesystem, which is
EPHEMERAL on Cloud Run and ECS/Fargate, and every uploaded file would be silently
destroyed on the next deploy. Set the variable(s) above, or set STORAGE_PROVIDER
explicitly if you meant a different provider.
```

On a successful boot the resolved provider is logged — **names and buckets only,
never a credential**:

```
[storage] provider=gcs bucket=metnmat-media-prod project=metnmat-website credentials=ADC (attached service account)
```

**On ECS this failure is safe.** A task that exits during startup never passes
its health check, so the ALB never routes to it and the previous task keeps
serving. A loud failure costs nothing; the silent one costs your media.

---

## 5. Why `next build` is exempt

`next build` runs with `NODE_ENV=production`, but runtime secrets are injected at
**container start**, not at build time. Throwing during the build would break the
image rather than catch a misconfiguration — so the build phase is detected via
`NEXT_PHASE=phase-production-build` and returns `local` instead of throwing.

This mirrors the existing guard in `assertProductionConfig()` and is verified by
test: *"does NOT throw during next build"*.

---

## 6. Switching to S3 — requirements

Not done, and not to be done until GCP is healthy again.

### Blocking prerequisites

1. **Copy the objects first.** Switching the provider does **not** move data.
   With S3 active and an unpopulated bucket, every existing image 404s.
2. **⚠️ `importMap.js` needs an S3 entry.** This is the trap most likely to bite.
   `apps/dashboard/src/app/(payload)/admin/importMap.js` is **hand-maintained**
   and currently holds exactly two `GcsClientUploadHandler` entries. The S3
   adapter registers a *different* client upload handler. Without the matching
   entry the **admin renders blank** — see gotcha #2 in `CLAUDE.md`, which has
   bitten this project before. Add the entry in the same commit as the switch.
3. **Bucket must not be public.** `documents`, `enquiry-uploads` and
   `blog-submission-files` are access-controlled — `blog-submission-files` holds
   unpublished manuscripts. Keep S3 Block Public Access **on**; Payload streams
   files through the CMS and never needs public objects.
4. **Verify the copy** — object count *and* byte total, before switching.

### Sequence

```
1. Create the S3 bucket, Block Public Access ON, encryption ON
2. Copy GCS → S3;  verify object count + total bytes match
3. Add the S3 client upload handler to importMap.js
4. Set STORAGE_PROVIDER=s3, S3_BUCKET, S3_REGION on the task definition
5. Deploy;  confirm the boot log reads provider=s3
6. Test: upload a new file, retrieve it, retrieve an OLD file, delete one
7. Leave the GCS bucket intact for the rollback window
```

Rollback is removing `STORAGE_PROVIDER` (or setting it to `gcs`) and
redeploying. That works **only while the GCS bucket still exists** — which is
why step 7 matters, and why nothing should ever be deleted from GCS during the
migration window.

### Media URLs do not change

Payload serves uploads through the CMS at `/api/media/file/<filename>` under both
providers. `mediaUrl()` in `apps/website/src/frontend/lib/cms.ts` **derives**
URLs rather than reading a stored absolute URL, so no database rewrite is needed
and no SEO/link breakage occurs. This is a significant simplification and it
holds for both directions.

---

## 7. Verification performed

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 |
| `pnpm lint` (both apps) | ✅ 0 |
| `pnpm test` | ✅ **294 passed** (+31 new) |
| `next build` (dashboard) | ✅ Compiled successfully |
| Production GCS argument parity | ✅ Byte-identical to the previous code |
| `importMap.js` | ✅ Unchanged, 2 entries intact |
| Secret scan of the diff | ✅ Clean (one match was a lockfile `sha512` hash) |

Parity was proven against the **real** production values captured in the Phase 1
backup (`metnmat-media-prod` / `metnmat-website`): the arguments handed to
`gcsStorage()` are identical to those the previous code produced.

### Test coverage — all six required scenarios

valid GCS · missing GCS · valid S3 · missing S3 · unsupported provider ·
production local-disk fallback prevention.

The strongest of these asserts that **no input whatsoever** can yield
`provider: "local"` in production — it either resolves to a real provider or
throws.
