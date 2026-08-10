# AWS Secrets Mapping

**No secret VALUE appears in this file, and none was read to produce it.**
Everything below comes from `gcloud secrets list` (names only) and from the
Cloud Run env-var *names* on each service.

Compiled 2026-08-10. GCP project `metnmat-website`. 22 secrets, **241 enabled
versions**.

---

## 1. The version problem — fix this before you migrate

| | |
|---|---|
| Secrets | 22 |
| **Enabled versions** | **241** |
| In use | 22 (only `latest` is ever read) |
| Stale but still retrievable | **219** |

Two consequences:

- **Cost.** Secret Manager bills per active version. At list price
  ($0.06/version/month, 6 free) that is `(241 − 6) × $0.06 = $14.10/month` for
  22 secrets' worth of value.
- **Security, which matters more.** Every superseded credential is still
  *retrievable*. Dev secrets were exposed in a session transcript on 2026-07-10;
  if any were rotated in response, **the compromised versions still work**.

**Do not copy 241 versions to AWS.** Migrate only the current value of each
secret, then disable the stale GCP versions separately.

---

## 2. Mapping table

Recommended AWS target and the service(s) that consume each. Path convention:
`/metnmat/prod/<NAME>`.

| # | GCP Secret | AWS target | website | dashboard | chatbot | Notes |
|---|---|---|---|:--:|:--:|:--:|---|
| 1 | `MONGODB_URI` | `/metnmat/prod/MONGODB_URI` | | ✅ | ✅ | DB name is inside the URI — verify it is `metnmat_cms` for the CMS |
| 2 | `PAYLOAD_SECRET` | `/metnmat/prod/PAYLOAD_SECRET` | | ✅ | | Rotating this invalidates all admin sessions |
| 3 | `PAYLOAD_PIN_PEPPER` | `/metnmat/prod/PAYLOAD_PIN_PEPPER` | | ✅ | | Rotating breaks every staff PIN login |
| 4 | `INTERNAL_API_KEY` | `/metnmat/prod/INTERNAL_API_KEY` | ✅ | ✅ | | Shared — website↔CMS server auth. Must be identical on both |
| 5 | `CMS_OAUTH_KEY` | `/metnmat/prod/CMS_OAUTH_KEY` | ✅ | ✅ | | Shared — must be identical on both |
| 6 | `RAZORPAY_KEY_ID` | `/metnmat/prod/RAZORPAY_KEY_ID` | ✅ | | | **Do not switch live↔test** |
| 7 | `RAZORPAY_KEY_SECRET` | `/metnmat/prod/RAZORPAY_KEY_SECRET` | ✅ | | | |
| 8 | `RAZORPAY_WEBHOOK_SECRET` | `/metnmat/prod/RAZORPAY_WEBHOOK_SECRET` | ✅ | | | Signature verification — a mismatch silently fails every webhook |
| 9 | `RESEND_API_KEY` | `/metnmat/prod/RESEND_API_KEY` | ✅ | ✅ | | |
| 10 | `GOOGLE_CLIENT_ID` | `/metnmat/prod/GOOGLE_CLIENT_ID` | ✅ | | | Google **Sign-In**, not GCP infra |
| 11 | `GOOGLE_CLIENT_SECRET` | `/metnmat/prod/GOOGLE_CLIENT_SECRET` | ✅ | | | |
| 12 | `UPSTASH_REDIS_REST_TOKEN` | `/metnmat/prod/UPSTASH_REDIS_REST_TOKEN` | ✅ | | ✅ | REST, not TCP — no VPC concern |
| 13 | `OPEN_EXCHANGE_RATES_APP_ID` | `/metnmat/prod/OPEN_EXCHANGE_RATES_APP_ID` | ✅ | ✅ | | |
| 14 | `analytics-geo-token` | `/metnmat/prod/ANALYTICS_GEO_TOKEN` | ✅ | | | ⚠️ Name differs from its env var `ANALYTICS_GEO_TOKEN` |
| 15 | `DIRECTOR_PIN` | `/metnmat/prod/DIRECTOR_PIN` | | ✅ | | |
| 16 | `JWT_SECRET` | `/metnmat/prod/JWT_SECRET` | | | ✅ | |
| 17 | `GROQ_API_KEY` | `/metnmat/prod/GROQ_API_KEY` | | | ✅ | The chatbot LLM. **There is no OpenAI key** |
| 18 | `Meta_WA_accessToken` | `/metnmat/prod/META_WA_ACCESS_TOKEN` | | | ✅ | |
| 19 | `Meta_WA_SenderPhoneNumberId` | `/metnmat/prod/META_WA_SENDER_PHONE_NUMBER_ID` | | | ✅ | |
| 20 | `Meta_WA_wabaId` | `/metnmat/prod/META_WA_WABA_ID` | | | ✅ | |
| 21 | `Meta_WA_VerfyToken` | `/metnmat/prod/META_WA_VERIFY_TOKEN` | | | ✅ | ⚠️ GCP name has a typo (`Verfy`); keep the env var name unchanged |
| 22 | `CHATBOT_MONGODB_URI` | **do not migrate** | | | | Orphan — 13 versions, not referenced by any service. Confirm before deleting |

---

## 3. NOT secrets — plain env vars, set directly in the task definition

These are on Cloud Run as literal values, not secret references. They are
configuration, not credentials:

| Variable | Service | Note |
|---|---|---|
| `GCS_BUCKET` = `metnmat-media-prod` | dashboard | **Replaced** by `S3_BUCKET` on AWS |
| `GCS_PROJECT_ID` | dashboard | **Dropped** on AWS — no equivalent |
| `WEBSITE_URL`, `CMS_URL` | dashboard | Domains unchanged, so values unchanged |
| `PUBLIC_URL`, `ALLOWED_ORIGINS` | chatbot | CORS — verify against the ALB hostname during staging |
| `EMAIL_FROM`, `QUOTE_FROM_EMAIL`, `QUOTE_NOTIFY_EMAIL` | dashboard/website | |
| `DIRECTOR_EMAIL`, `DIRECTOR_NAME` | dashboard | |
| `FACEBOOK_GRAPH_API_VERSION` | chatbot | |
| `NEXT_PUBLIC_*` | website | **Build-time**, baked into the image — not runtime secrets |

⚠️ **`DIRECTOR_RESET`** must never be set on AWS. It deletes every staff account
except the director on each deploy.

---

## 4. Secrets Manager vs Parameter Store

| | AWS Secrets Manager | SSM Parameter Store (Standard) |
|---|---|---|
| Price | ~$0.40/secret/month | **free** |
| 22 secrets | ~$8.80/month | **$0** |
| Rotation | built in | none |
| ECS integration | `valueFrom` | `valueFrom` (identical) |

**Recommendation: SSM Parameter Store (Standard) with `SecureString`.** It is
KMS-encrypted, integrates with ECS identically, and costs nothing at this scale.
None of these 22 secrets uses automatic rotation today, so Secrets Manager's main
advantage is unused. Revisit only if you adopt rotation.

---

## 5. Migration method — and the mistake to avoid

**A naive loop leaks every secret into your terminal, your shell history, and CI
logs.** Never do this:

```bash
# WRONG — prints every production credential to stdout
for s in $(gcloud secrets list --format="value(name)"); do
  echo "$s = $(gcloud secrets versions access latest --secret=$s)"
done
```

Pipe value → value, never through a variable that gets echoed, and never with
`set -x` enabled:

```bash
#!/usr/bin/env bash
set -euo pipefail            # NOT set -x
umask 077

REGION=ap-south-1
PREFIX=/metnmat/prod

while read -r NAME; do
  NAME=$(printf '%s' "$NAME" | tr -d '\r')      # gcloud emits CRLF on Windows
  [ -z "$NAME" ] && continue
  [ "$NAME" = "CHATBOT_MONGODB_URI" ] && continue   # orphan — do not migrate

  gcloud secrets versions access latest --secret="$NAME" \
    | aws ssm put-parameter \
        --region "$REGION" \
        --name "$PREFIX/$NAME" \
        --type SecureString \
        --overwrite \
        --value "$(cat)" > /dev/null

  echo "migrated: $NAME"        # NAME only, never the value
done < <(gcloud secrets list --format="value(name)")
```

**Verify by length and digest, never by printing:**

```bash
# compare a checksum on both sides — no value is displayed
gcloud secrets versions access latest --secret=RESEND_API_KEY | sha256sum
aws ssm get-parameter --name /metnmat/prod/RESEND_API_KEY --with-decryption \
  --query Parameter.Value --output text --region ap-south-1 | sha256sum
```

Run this from a workstation you control — **not** from CI, and not from a shell
whose history is persisted.

---

## 6. Do not copy

| Item | Why |
|---|---|
| `GCS_PROJECT_ID` | Meaningless on AWS |
| `GCS_BUCKET` | Superseded by `S3_BUCKET` |
| `CHATBOT_MONGODB_URI` | Orphan; no service references it. Confirm first |
| The 219 stale versions | Only `latest` is ever read |
| Any GCP service-account JSON key | Replaced by ECS task IAM roles |

---

## 7. After migration — GCP side

**Do not delete anything during the rollback window.** GCP must stay able to
serve. Separately from this migration, the 219 stale versions should be
**disabled** (not destroyed) — that is a security fix worth doing regardless of
which cloud you end up on, and it takes the Secret Manager line from $14.10 to
$0.96/month.
