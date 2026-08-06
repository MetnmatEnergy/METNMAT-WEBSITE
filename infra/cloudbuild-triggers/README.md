# Cloud Build trigger configuration

The live triggers are the source of truth; these files mirror them so the
configuration is reviewable and re-appliable. Exported 2026-08-05 with
`includedFiles` added.

## Why these exist

Every push to `main` rebuilt and redeployed **both** applications, because no
trigger declared `includedFiles`. Measured over the last 100 builds:

| | |
|---|---|
| Commits built **3×** | 34 of 36 |
| Median build duration | 5.0 min |
| Machine type | `E2_HIGHCPU_8` (the paid tier, not the default) |
| Of the last 20 commits, documentation-only | **8** — each still fired 3 builds |

`includedFiles` is derived from the `COPY` lines in each Dockerfile, not
guessed. Those lines *are* the build inputs: anything listed can change the
output, anything absent cannot.

The subtle entry in each file is the **other** app's `package.json`. Both
Dockerfiles copy the full set of workspace manifests so pnpm can resolve the
workspace. Leaving it out fails silently — the image keeps building, against a
stale dependency graph.

## Applying

Requires a principal with `roles/cloudbuild.builds.editor` (or Owner). The
deploy service account **cannot** do this — verified:

```
$ gcloud beta builds triggers import --source=… --region=global
ERROR: PERMISSION_DENIED: The caller does not have permission.
This command is authenticated as metnmat-deployer@metnmat-website.iam.gserviceaccount.com
```

So authenticate as a human owner first:

```bash
gcloud auth login
gcloud config set project metnmat-website
gcloud beta builds triggers import --source=infra/cloudbuild-triggers/website.yaml   --region=global
gcloud beta builds triggers import --source=infra/cloudbuild-triggers/dashboard.yaml --region=global
```

Each file carries the existing trigger's `id`, so import **updates in place**.
It does not create a second trigger.

### Verifying it worked

```bash
gcloud builds triggers describe metnmat-website-auto-deploy --region=global \
  --format="value(includedFiles)"
```

Then push a documentation-only commit and confirm **no** build starts for it.

## Still outstanding: the duplicate website trigger

`rmgpgab-metnmat-website-asia-south1-MetnmatEnergy-METNMAT-WExqs` is **not**
included here, because the fix is deletion rather than configuration.

It is a console-generated "deploy from source" trigger that builds the root
`Dockerfile` with `--no-cache` and deploys to `metnmat-website` — the same
service the trigger above deploys to. Both fire on every push, so two different
images race and **whichever finishes last serves production**. Verified from the
live revision list: revisions alternate between the two Artifact Registry
repositories, two per push, roughly 40 seconds apart.

```
00468  17:44:48Z  cloud-run-source-deploy/…   <- currently serving
00467  17:43:57Z  metnmat/website
00466  17:36:19Z  cloud-run-source-deploy/…
00465  17:35:48Z  metnmat/website
```

The two Dockerfiles happen to differ only in three `ARG` defaults today, so it
has not caused an incident. Nothing enforces that.

**To fix:** Cloud Console → Cloud Build → Triggers → region **global** →
`rmgpgab-…WExqs` → ⋮ → Delete. Then delete the root `Dockerfile`, so
`Dockerfile.website` is the only one that builds the website.

Do it in that order, and push once afterwards to confirm the service picks up
the `metnmat/website` image — the currently-live image comes from the trigger
being removed.
