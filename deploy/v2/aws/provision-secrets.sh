#!/usr/bin/env bash
# provision-secrets.sh — create the four per-app secrets with FRESH values.
#
# Every value the platform can generate itself (signing secrets, API keys we
# issue, PIN pepper) is generated here with openssl and written straight into
# Secrets Manager. Nothing is printed. Third-party credentials that must be
# issued by their provider (MongoDB Atlas, Razorpay, Resend, Google, Upstash,
# OpenAI, Pinecone, Zoho, Amazon SP-API, WhatsApp, Supabase…) are written as the
# literal SET_ME; metnmat-fetch-secrets refuses to export a SET_ME value, and the
# .required lists make the affected unit refuse to start until they are filled
# in — in the Secrets Manager console, as key/value pairs, one secret per app.
#
# The old metnmat/prod/* and metnmat/chatbot/* secrets are NOT touched here.
# They are decommissioned by the runbook after cutover.
set -Eeuo pipefail
export AWS_PAGER=""
REGION=ap-south-1
gen()  { openssl rand -hex "${1:-32}"; }             # hex, safe in every context
genb() { openssl rand -base64 48 | tr -d '\n=/+' | cut -c1-"${1:-48}"; }

say() { printf '\n== %s ==\n' "$*"; }
put() { # put <secret-id> <json-file>
  if aws secretsmanager describe-secret --region $REGION --secret-id "$1" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value --region $REGION --secret-id "$1" --secret-string "file://$2" --query VersionId --output text >/dev/null
    echo "updated $1"
  else
    aws secretsmanager create-secret --region $REGION --name "$1" --description "METNMAT v2: environment for one app (JSON key/value). Read only by the prod host role." --secret-string "file://$2" --tags Key=app,Value="${1#metnmat/}" --query Name --output text >/dev/null
    echo "created $1"
  fi
}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; chmod 700 "$T"

say "CMS media access key (IAM user metnmat-cms-media)"
# One active key only. Old keys for this user are deleted so a rerun rotates.
for k in $(aws iam list-access-keys --user-name metnmat-cms-media --query 'AccessKeyMetadata[].AccessKeyId' --output text); do
  aws iam delete-access-key --user-name metnmat-cms-media --access-key-id "$k"; done
aws iam create-access-key --user-name metnmat-cms-media --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text > "$T/cmskey"
CMS_AK=$(cut -f1 "$T/cmskey"); CMS_SK=$(cut -f2 "$T/cmskey"); rm -f "$T/cmskey"
echo "issued (id ${CMS_AK:0:4}…, never printed further)"

say "metnmat/web/env"
python3 - "$T/web.json" "$(gen 32)" "$(gen 32)" "$(gen 32)" "$(gen 32)" <<'PY'
import json,sys
f,ik,blog,att,cmsblog=sys.argv[1:]
json.dump({
  # generated here
  "INTERNAL_API_KEY": ik,               # website ↔ CMS internal calls (must equal the CMS's copy below)
  "BLOG_SIGNING_SECRET": blog,
  "ATTACHMENT_SIGNING_SECRET": att,
  "CMS_BLOG_KEY": cmsblog,              # must equal the CMS's copy
  # issued by third parties — fill in the console
  "RESEND_API_KEY": "SET_ME",
  "QUOTE_FROM_EMAIL": "SET_ME",
  "QUOTE_NOTIFY_EMAIL": "SET_ME",
  "BLOG_NOTIFY_EMAIL": "SET_ME",
  "RAZORPAY_KEY_ID": "SET_ME",
  "RAZORPAY_KEY_SECRET": "SET_ME",
  "RAZORPAY_WEBHOOK_SECRET": "SET_ME",
  "UPSTASH_REDIS_REST_URL": "SET_ME",
  "UPSTASH_REDIS_REST_TOKEN": "SET_ME",
  "TURNSTILE_SECRET_KEY": "SET_ME",      # pair of the NEXT_PUBLIC_TURNSTILE_SITE_KEY repo variable; set both or neither
  "OPEN_EXCHANGE_RATES_APP_ID": "SET_ME",
  "GOOGLE_CLIENT_ID": "SET_ME",
  "GOOGLE_CLIENT_SECRET": "SET_ME",
  "GOOGLE_SITE_VERIFICATION": "SET_ME",
  "ANALYTICS_GEO_TOKEN": "SET_ME",
  "COMPANY_GSTIN": "SET_ME", "COMPANY_GST_STATE": "SET_ME", "COMPANY_CIN": "SET_ME"
}, open(f,"w"), indent=2)
PY
put metnmat/web/env "$T/web.json"
WEB_IK=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["INTERNAL_API_KEY"])' "$T/web.json")
WEB_BLOG=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["CMS_BLOG_KEY"])' "$T/web.json")

say "metnmat/cms/env"
python3 - "$T/cms.json" "$(genb 64)" "$(gen 32)" "$WEB_IK" "$WEB_BLOG" "$(gen 32)" "$CMS_AK" "$CMS_SK" <<'PY'
import json,sys
f,ps,pep,ik,blog,oauth,ak,sk=sys.argv[1:]
json.dump({
  "PAYLOAD_SECRET": ps,                 # rotating this logs every admin out (intended)
  "PAYLOAD_PIN_PEPPER": pep,            # rotating this INVALIDATES all staff PINs — re-enrol via director
  "INTERNAL_API_KEY": ik,               # same value as metnmat/web/env
  "CMS_BLOG_KEY": blog,                 # same value as metnmat/web/env
  "CMS_OAUTH_KEY": oauth,
  "S3_ACCESS_KEY_ID": ak,               # IAM user metnmat-cms-media: media bucket only
  "S3_SECRET_ACCESS_KEY": sk,
  "MONGODB_URI": "SET_ME",              # NEW Atlas user, database metnmat_cms — never /metnmat
  "DIRECTOR_EMAIL": "SET_ME",
  "DIRECTOR_PIN": "SET_ME",
  "RESEND_API_KEY": "SET_ME",
  "EMAIL_FROM": "SET_ME",
  "OPEN_EXCHANGE_RATES_APP_ID": "SET_ME"
}, open(f,"w"), indent=2)
PY
put metnmat/cms/env "$T/cms.json"

say "metnmat/chat/env"
python3 - "$T/chat.json" "$(gen 32)" "$(gen 32)" <<'PY'
import json,sys
f,jwt,agent=sys.argv[1:]
json.dump({
  "JWT_SECRET": jwt,
  "AGENT_API_KEY": agent,
  "MONGODB_URI": "SET_ME",              # NEW Atlas user, database metnmat (the chatbot's own)
  "DEEPSEEK_API_KEY": "SET_ME",         # chat models; same DeepSeek account as the Command Center
  "META_APP_SECRET": "SET_ME",
  "Meta_WA_accessToken": "SET_ME", "Meta_WA_SenderPhoneNumberId": "SET_ME", "Meta_WA_wabaId": "SET_ME", "Meta_WA_VerfyToken": "SET_ME",
  "WHATSAPP_WEBHOOK_URL": "SET_ME",
  "FACEBOOK_PAGE_ACCESS_TOKEN": "SET_ME", "FACEBOOK_VERIFY_TOKEN": "SET_ME",
  "Meta_IG_VerifyToken": "SET_ME", "Meta_IG_AccessToken": "SET_ME"
}, open(f,"w"), indent=2)
PY
put metnmat/chat/env "$T/chat.json"

say "metnmat/cc/env  (Command Center — every key of the old .env, all third-party values SET_ME)"
python3 - "$T/cc.json" "$(genb 48)" "$(gen 32)" "$(gen 32)" "$(gen 32)" <<'PY'
import json,sys
f,na,cron,sync,waverify=sys.argv[1:]
keys = """AI_REQUEST_TIMEOUT_MS AMAZON_NOTIFY_EXISTING_ORDERS AMAZON_NOTIFY_NEW_ORDERS AMAZON_SP_API_CLIENT_ID AMAZON_SP_API_CLIENT_SECRET
AMAZON_SP_API_ENABLE_GST_REPORT_SYNC AMAZON_SP_API_ENABLE_RESTRICTED_PII AMAZON_SP_API_ENABLE_SETTLEMENT_SYNC AMAZON_SP_API_ENABLE_TRACKING_STATUS_SYNC
AMAZON_SP_API_MARKETPLACE_IDS AMAZON_SP_API_PII_DRY_RUN AMAZON_SP_API_REFRESH_TOKEN AMAZON_SP_API_REGION AMAZON_SP_API_SELLER_ID AWS_REGION
BACKUP_ALERT_EMAIL BACKUP_DRIVE_FOLDER_ID BACKUP_DRIVE_TEST_FOLDER_ID BACKUP_ENABLED BACKUP_MIN_DOC_RATIO BACKUP_OIDC_AUDIENCE BACKUP_OIDC_SERVICE_ACCOUNT
CAPTCHA_BYPASS DATABASE_URL DEEPSEEK_API_KEY DEEPSEEK_MODEL ENABLE_IN_PROCESS_FOLLOWUP_SCHEDULER ENQUIRY_GMAIL_REFRESH_TOKEN ENQUIRY_GMAIL_SENDER_EMAIL
GCS_MEDIA_BUCKET GMAIL_AUTO_SYNC GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET GMAIL_REDIRECT_URI GMAIL_REFRESH_TOKEN GMAIL_SENDER_EMAIL
GOOGLE_CLOUD_PROJECT GOOGLE_MAPS_GEOCODING_API_KEY GROQ_MODEL MEDIA_STORAGE NEXT_PUBLIC_SUPABASE_URL OWNER_WHATSAPP_NUMBERS
S3_MEDIA_BUCKET S3_MEDIA_REGION STORAGE_PROVIDER SUPABASE_OPTIMIZED_BUCKET SUPABASE_THUMB_BUCKET SYNC_AUTO_ENABLED
SYNC_INTERVAL_MINUTES SYNC_LOCK_TTL_SECONDS SYNC_MAX_CONCURRENCY TWO_FACTOR_AUTH_ENABLED UPI_ID UPI_PAYEE_NAME UPLOAD_SECURITY_ENFORCE_SOURCES
VERTEX_AI_LOCATION VERTEX_AI_MODEL VERTEX_AI_PROJECT WHATSAPP_AI_ENABLED WHATSAPP_AI_MAX_REPLY_CHARS WHATSAPP_AI_MODEL WHATSAPP_APP_SECRET
WHATSAPP_BUSINESS_ACCOUNT_ID WHATSAPP_GRAPH_VERSION WHATSAPP_INVOICE_TEMPLATE_NAME WHATSAPP_PDF_PUBLIC_BASE_URL WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_QUOTATION_TEMPLATE_NAME WHATSAPP_TASK_STATUS_UPDATE_APPROVED WHATSAPP_TEMPLATE_LANG WHATSAPP_TEMPLATE_TASK_REMINDER WHATSAPP_TOKEN
WHATSAPP_WEBHOOK_PUBLIC_URL WHATSAPP_WEB_API_KEY ZOHO_ACCOUNTS_BASE_URL ZOHO_BOOKS_BASE_URL ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET ZOHO_ORGANIZATION_ID
ZOHO_ORG_ID ZOHO_REDIRECT_URI ZOHO_REFRESH_TOKEN""".split()
d = {k: "SET_ME" for k in keys}
d.update({"NEXTAUTH_SECRET": na, "CRON_SECRET": cron, "SYNC_JOB_SECRET": sync, "WHATSAPP_WEBHOOK_VERIFY_TOKEN": waverify,
          "AWS_REGION": "ap-south-1", "NEXTAUTH_URL": "https://command-center.metnmat.com"})
json.dump(d, open(f,"w"), indent=2)
PY
put metnmat/cc/env "$T/cc.json"

cat <<'EOF'

Secrets provisioned. Generated values are already live; SET_ME values must be
filled in the Secrets Manager console (edit as key/value) AFTER you rotate them
at each provider. Each unit refuses to start until its .required keys are set.

Also update the DEV `.env` files on the laptop? No — dev uses metnmat_cms_dev and
its own credentials; they are unaffected by this rotation.
EOF
