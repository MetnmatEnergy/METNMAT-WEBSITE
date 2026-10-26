#!/usr/bin/env bash
# Copies a DeepSeek key from AWS Secrets Manager into the GitHub secret
# DEEPSEEK_API_KEY for the weekly blog pipeline, without printing it. Run it
# yourself, from PowerShell at the repo root:
#
#   & "C:\Program Files\Git\bin\bash.exe" scripts/blog/set-deepseek-from-aws.sh
#
# Default source: DEEPSEEK_API_KEY_SECONDARY in metnmat/chat/env (the 19 Sept
# rotation key). Other source: pass the secret id and entry name, e.g.
#   … set-deepseek-from-aws.sh metnmat/cc/env DEEPSEEK_API_KEY_SECONDARY
#
# It refuses an empty value and the key exposed in the August breach, and asks
# DeepSeek whether the key works before storing it.
set -euo pipefail

REGION=ap-south-1
REPO=MetnmatEnergy/METNMAT-WEBSITE
SECRET_ID=${1:-metnmat/chat/env}
NAME=${2:-DEEPSEEK_API_KEY_SECONDARY}

JSON=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_ID" --query SecretString --output text)
echo "DeepSeek entries in $SECRET_ID (names only): $(JSON="$JSON" node -e 'console.log(Object.keys(JSON.parse(process.env.JSON)).filter((k) => /deepseek/i.test(k)).join(", ") || "none")')"
KEY=$(JSON="$JSON" NAME="$NAME" node -e 'process.stdout.write(String(JSON.parse(process.env.JSON)[process.env.NAME] ?? "").trim())')
unset JSON

case "$KEY" in
  sk-706fd7*) echo "$NAME is the key exposed in the August breach. Refusing; nothing changed."; exit 1 ;;
  sk-?*) ;;
  *) echo "$NAME is missing or does not look like a DeepSeek key. Nothing changed."; exit 1 ;;
esac

STATUS=$(curl -s https://api.deepseek.com/user/balance -H "Authorization: Bearer $KEY" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try { const j = JSON.parse(s); const b = (j.balance_infos || [])[0] || {};
      console.log(j.is_available ? `works, balance ${b.total_balance} ${b.currency}` : "REJECTED or no balance"); }
    catch { console.log("REJECTED (DeepSeek did not accept the key)"); }
  });')
echo "DeepSeek says the key: $STATUS"
case "$STATUS" in works*) ;; *) unset KEY; echo "Not storing it."; exit 1 ;; esac

printf %s "$KEY" | gh secret set DEEPSEEK_API_KEY --repo "$REPO"
unset KEY
echo "DEEPSEEK_API_KEY stored for $REPO."
