#!/usr/bin/env bash
# One-time setup for the weekly blog pipeline. Run it yourself, from the repo root:
#
#   bash scripts/blog/setup-secrets.sh
#
# It needs the AWS CLI (signed in with access to Secrets Manager in ap-south-1)
# and the GitHub CLI (signed in to MetnmatEnergy/METNMAT-WEBSITE). It:
#   1. generates a new random CMS_BLOG_INGEST_KEY;
#   2. adds it to the CMS's secret metnmat/cms/env, plus BLOG_NOTIFY_EMAIL copied
#      from the website's QUOTE_NOTIFY_EMAIL if the CMS does not have one yet;
#   3. stores the same key as the GitHub secret CMS_BLOG_INGEST_KEY;
#   4. asks you to paste the DeepSeek API key for the blog (hidden) and stores it
#      as the GitHub secret DEEPSEEK_API_KEY.
# No secret value is ever printed. The CMS reads its secret only at start-up, so
# the key takes effect at the next CMS deploy or restart.
set -euo pipefail

REGION=ap-south-1
REPO=MetnmatEnergy/METNMAT-WEBSITE

for tool in aws gh node openssl; do
  command -v "$tool" >/dev/null || { echo "Missing $tool"; exit 1; }
done

KEY=$(openssl rand -hex 32)

echo "Reading metnmat/cms/env and metnmat/web/env…"
CMS_JSON=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id metnmat/cms/env --query SecretString --output text)
WEB_JSON=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id metnmat/web/env --query SecretString --output text)

NEW_JSON=$(CMS_JSON="$CMS_JSON" WEB_JSON="$WEB_JSON" KEY="$KEY" node -e '
  const cms = JSON.parse(process.env.CMS_JSON);
  const web = JSON.parse(process.env.WEB_JSON);
  cms.CMS_BLOG_INGEST_KEY = process.env.KEY;
  if (!cms.BLOG_NOTIFY_EMAIL && web.QUOTE_NOTIFY_EMAIL) cms.BLOG_NOTIFY_EMAIL = web.QUOTE_NOTIFY_EMAIL;
  process.stderr.write("BLOG_NOTIFY_EMAIL " + (cms.BLOG_NOTIFY_EMAIL ? "is set" : "is NOT set (no emails will be sent)") + "\n");
  process.stdout.write(JSON.stringify(cms));
')

echo "Writing the new key into metnmat/cms/env…"
aws secretsmanager put-secret-value --region "$REGION" --secret-id metnmat/cms/env --secret-string "$NEW_JSON" >/dev/null
unset CMS_JSON WEB_JSON NEW_JSON

echo "Storing CMS_BLOG_INGEST_KEY in GitHub…"
printf %s "$KEY" | gh secret set CMS_BLOG_INGEST_KEY --repo "$REPO"
unset KEY

read -rsp "Paste the DeepSeek API key for the blog (input hidden), then Enter: " DS
echo
if [ -n "$DS" ]; then
  printf %s "$DS" | gh secret set DEEPSEEK_API_KEY --repo "$REPO"
  echo "DEEPSEEK_API_KEY stored."
else
  echo "No DeepSeek key entered; set it later with: gh secret set DEEPSEEK_API_KEY --repo $REPO"
fi
unset DS

echo
echo "Done. The CMS picks up the new key at its next start: the next 'Deploy CMS (v2 host)' run does it."
