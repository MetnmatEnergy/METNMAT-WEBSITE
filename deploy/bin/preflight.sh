#!/usr/bin/env bash
# Pre-flight — verify everything the first release needs, before releasing.
#
#   ./preflight.sh
#
# The first deploy onto a new box fails in places that are expensive to discover
# halfway through: an SSM agent that is offline, an instance role that cannot
# read the artifact bucket, 22 secrets that still hold PLACEHOLDER_SET_ME, port
# 3100 already taken. Every one of those is cheap to check in advance and
# painful to hit during a symlink swap on a server that is also running the
# internal dashboard.
#
# READ-ONLY, with one exception: it writes a small probe object to the artifact
# bucket to prove write access, then deletes it. Nothing else is created,
# modified or restarted. It never starts, stops or reloads a process.
#
# NO SECRET VALUE IS EVER PRINTED. Secrets are reported by name and by whether
# they still hold the placeholder — never by content.
#
# Required: AWS credentials with the deploy role's permissions. Prefer running
# this through .github/workflows/preflight-aws.yml, which assumes the actual
# deploy role via OIDC — a laptop's credentials may be broader than the role
# and would pass checks the real deploy then fails.

# Deliberately NOT -e: every check should run so you get the full picture in one
# pass, rather than fixing one thing at a time and re-running.
set -uo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_ID="${EC2_INSTANCE_ID:-}"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-}"
MEDIA_BUCKET="${MEDIA_BUCKET:-metnmat-media-prod}"
SECRET_PREFIX="${SECRET_PREFIX:-metnmat/prod/}"
APP_ROOT="${APP_ROOT:-/home/ec2-user/web}"
APP_PORT="${APP_PORT:-3100}"
EXPECTED_SECRETS="${EXPECTED_SECRETS:-22}"
# Blueprint §12: website needs 400-600 MB. Warn below this.
MIN_FREE_MB="${MIN_FREE_MB:-600}"

pass=0; warn=0; fail=0

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; pass=$((pass+1)); }
no()   { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=$((fail+1)); }
hmm()  { printf '  \033[33m!\033[0m %s\n' "$*"; warn=$((warn+1)); }
info() { printf '    %s\n' "$*"; }
sec()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ── 1. Local tooling and identity ──────────────────────────────────────────
sec "1. Tooling and identity"

if command -v aws >/dev/null 2>&1; then
  ok "aws cli present ($(aws --version 2>&1 | cut -d' ' -f1))"
else
  no "aws cli not on PATH — nothing else can run"
  exit 1
fi

if caller="$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null)" && [ -n "$caller" ]; then
  ok "credentials valid"
  info "$caller"
  case "$caller" in
    *:user/*) hmm "this is an IAM USER, not a role. The real deploy assumes a role via OIDC, so these checks may be more permissive than production." ;;
  esac
else
  no "credentials invalid or expired"
  # One line: the raw AWS error is multi-line and wrecks the indentation.
  info "$(aws sts get-caller-identity 2>&1 | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-160)"
  info "run this through .github/workflows/preflight-aws.yml instead — it uses the deploy role via OIDC"
  exit 1
fi

[ -n "$INSTANCE_ID" ]     && ok "EC2_INSTANCE_ID set ($INSTANCE_ID)"   || no "EC2_INSTANCE_ID not set"
[ -n "$ARTIFACT_BUCKET" ] && ok "ARTIFACT_BUCKET set ($ARTIFACT_BUCKET)" || no "ARTIFACT_BUCKET not set"

# ── 2. Artifact bucket ─────────────────────────────────────────────────────
sec "2. Artifact bucket"

if [ -n "$ARTIFACT_BUCKET" ]; then
  if aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" >/dev/null 2>&1; then
    ok "bucket reachable"

    # A public artifact bucket leaks the compiled app. It should never be public
    # even though the artifact itself carries no secrets.
    pab="$(aws s3api get-public-access-block --bucket "$ARTIFACT_BUCKET" \
      --query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text 2>/dev/null)"
    [ "$pab" = "True" ] && ok "public access blocked" || hmm "public access block not fully on — artifacts should never be public"

    # Prove write, then clean up. This is the only mutation this script makes.
    probe="preflight/.probe-$$"
    if echo "preflight" | aws s3 cp - "s3://$ARTIFACT_BUCKET/$probe" --only-show-errors 2>/dev/null; then
      ok "can write to the bucket"
      aws s3 rm "s3://$ARTIFACT_BUCKET/$probe" --only-show-errors >/dev/null 2>&1 \
        && info "probe object removed" \
        || hmm "probe object left behind at s3://$ARTIFACT_BUCKET/$probe — delete it"
    else
      no "cannot write to the bucket — the build job will fail at upload"
    fi
  else
    no "bucket missing or not reachable: $ARTIFACT_BUCKET"
  fi
fi

# ── 3. Secrets Manager ─────────────────────────────────────────────────────
sec "3. Secrets ($SECRET_PREFIX*)"

names="$(aws secretsmanager list-secrets --region "$AWS_REGION" \
  --filters "Key=name,Values=$SECRET_PREFIX" --max-results 100 \
  --query 'SecretList[].Name' --output text 2>/dev/null)"

if [ -z "$names" ]; then
  no "no secrets found under $SECRET_PREFIX in $AWS_REGION"
  info "either they do not exist, are in another region, or this identity cannot list them"
else
  count="$(echo "$names" | wc -w | tr -d ' ')"
  if [ "$count" -ge "$EXPECTED_SECRETS" ]; then
    ok "$count secrets found (expected $EXPECTED_SECRETS)"
  else
    hmm "$count secrets found, expected $EXPECTED_SECRETS"
  fi

  # Read each one only to classify it. Values are compared, never printed.
  placeholders=""; empties=""; readable=0
  for n in $names; do
    v="$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$n" \
      --query SecretString --output text 2>/dev/null)"
    if [ -z "$v" ]; then empties="$empties ${n#"$SECRET_PREFIX"}"; continue; fi
    readable=$((readable+1))
    [ "$v" = "PLACEHOLDER_SET_ME" ] && placeholders="$placeholders ${n#"$SECRET_PREFIX"}"
  done
  [ "$readable" -gt 0 ] && ok "$readable secret(s) readable by this identity" || no "no secret VALUES readable — check secretsmanager:GetSecretValue"

  if [ -n "$placeholders" ]; then
    no "still PLACEHOLDER_SET_ME:$placeholders"
    info "that literal is committed in infra/ and therefore public; the CMS refuses to boot on it"
  else
    ok "no secret holds the placeholder"
  fi
  [ -n "$empties" ] && hmm "empty or unreadable:$empties"

  # These two delete production records on every boot.
  for d in DIRECTOR_RESET SEED_PRUNE_PLACEHOLDERS; do
    echo "$names" | grep -q "${SECRET_PREFIX}${d}$" \
      && no "$d exists as a secret — it must never be server config; it deletes data on every boot" \
      || ok "$d absent from Secrets Manager"
  done
fi

# ── 4. EC2 and SSM reachability ────────────────────────────────────────────
sec "4. EC2 and SSM"

online=0
if [ -n "$INSTANCE_ID" ]; then
  state="$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null)"
  [ "$state" = "running" ] && ok "instance running" || no "instance state: ${state:-unknown}"

  itype="$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].InstanceType' --output text 2>/dev/null)"
  info "type: ${itype:-unknown}"
  # Deliberately does not quote a free-memory figure here. The blueprint's 834 MB
  # was already stale by 180 MB when measured on 2026-08-12, because the
  # dashboard process grows. Section 5 reads the live number off the box; that
  # is the one to trust.
  [ "$itype" = "t3.small" ] && hmm "t3.small (2 GB) shared with the dashboard — see the measured figure in section 5, not the blueprint's"

  profile="$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' --output text 2>/dev/null)"
  [ -n "$profile" ] && [ "$profile" != "None" ] \
    && ok "instance profile attached" && info "$profile" \
    || no "no instance profile — the app cannot read S3 or Secrets Manager without one"

  # The single most common cause of a deploy that hangs forever.
  ping="$(aws ssm describe-instance-information --region "$AWS_REGION" \
    --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null)"
  if [ "$ping" = "Online" ]; then
    ok "SSM agent online"
    online=1
  else
    no "SSM agent not online (${ping:-no response}) — send-command would queue and time out"
  fi
fi

# ── 5. On the instance ─────────────────────────────────────────────────────
# Everything above proves AWS is configured. Only these prove the box can
# actually run the app.
sec "5. On the instance"

if [ "$online" != "1" ]; then
  hmm "skipped — SSM agent not reachable"
else
  remote=$(cat <<REMOTE
echo "--- binaries ---"
for b in node pm2 tar curl aws; do command -v \$b >/dev/null 2>&1 && echo "have \$b \$(\$b --version 2>&1 | head -1 | cut -c1-20)" || echo "MISSING \$b"; done
echo "--- port ---"
(ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -q ":$APP_PORT " && echo "PORT_TAKEN" || echo "port free"
echo "--- memory ---"
free -m | awk '/^Mem:/{print "mem_total="\$2" mem_avail="\$7}'
echo "--- disk ---"
df -h / | awk 'NR==2{print "disk_use="\$5" avail="\$4}'
echo "--- app root ---"
[ -d "$APP_ROOT" ] && echo "approot exists" || echo "approot MISSING"
[ -w "$APP_ROOT" ] 2>/dev/null && echo "approot writable" || echo "approot not writable by this user"
echo "--- instance role can reach S3/secrets ---"
# GetObject and ListBucket are DIFFERENT permissions and only one of them
# matters. release.sh does \`aws s3 cp s3://bucket/key\` — GetObject. Testing
# with \`aws s3 ls\` tests ListBucket, which the deploy never uses, and reporting
# that as "cannot read the artifact bucket" sends someone hunting a permission
# that was never missing. Test both, label them apart.
if aws s3 cp "s3://$ARTIFACT_BUCKET/bootstrap/bootstrap-server.sh" /tmp/.role-probe --region $AWS_REGION >/dev/null 2>&1; then
  echo "role_s3_get ok"; rm -f /tmp/.role-probe
elif aws s3api head-object --bucket "$ARTIFACT_BUCKET" --key bootstrap/bootstrap-server.sh --region $AWS_REGION >/dev/null 2>&1; then
  echo "role_s3_get ok"
else
  # No probe object yet is not a permission failure — say so rather than
  # implying a denial.
  aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" --region $AWS_REGION >/dev/null 2>&1 \
    && echo "role_s3_get UNTESTED" || echo "role_s3_get DENIED"
fi
aws s3 ls "s3://$ARTIFACT_BUCKET/" --region $AWS_REGION >/dev/null 2>&1 && echo "role_s3_list ok" || echo "role_s3_list DENIED"
aws secretsmanager list-secrets --region $AWS_REGION --filters Key=name,Values=$SECRET_PREFIX --max-results 1 >/dev/null 2>&1 && echo "role_secrets ok" || echo "role_secrets DENIED"
echo "--- pm2 processes ---"
pm2 jlist 2>/dev/null | tr ',' '\n' | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sed 's/^/pm2:/' || echo "pm2 not running"
echo "--- caddy ---"
systemctl is-active caddy 2>/dev/null | sed 's/^/caddy:/' || echo "caddy:absent"
echo "--- dangerous env ---"
for v in DIRECTOR_RESET SEED_PRUNE_PLACEHOLDERS; do [ -n "\${!v:-}" ] && echo "DANGER \$v is set" || echo "\$v unset"; done
REMOTE
)
  # Base64 the script rather than escaping it into JSON. The payload then
  # contains nothing that needs quoting — no quotes, no backslashes, no newlines
  # — so the three layers of escaping (shell -> JSON -> remote shell) collapse to
  # none. Trying to escape it directly is how this check first broke.
  b64="$(printf '%s' "$remote" | base64 | tr -d '\n')"

  cid="$(aws ssm send-command --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" --comment "preflight" --timeout-seconds 120 \
    --parameters commands="[\"echo $b64 | base64 -d | bash\"]" \
    --query 'Command.CommandId' --output text 2>/dev/null)"

  if [ -z "$cid" ]; then
    no "could not dispatch SSM command"
  else
    aws ssm wait command-executed --region "$AWS_REGION" --command-id "$cid" --instance-id "$INSTANCE_ID" >/dev/null 2>&1
    out="$(aws ssm get-command-invocation --region "$AWS_REGION" --command-id "$cid" \
      --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null)"

    if [ -z "$out" ]; then
      no "SSM command produced no output"
    else
      echo "$out" | grep -q "MISSING node" && no "node missing on the instance"   || ok "node present"
      echo "$out" | grep -q "MISSING pm2"  && no "pm2 missing on the instance"    || ok "pm2 present"
      echo "$out" | grep -q "MISSING aws"  && no "aws cli missing — release.sh needs it to fetch the artifact" || ok "aws cli present on instance"
      echo "$out" | grep -q "PORT_TAKEN"   && no "port $APP_PORT already in use"  || ok "port $APP_PORT free"
      echo "$out" | grep -q "approot MISSING" && no "$APP_ROOT does not exist"    || ok "$APP_ROOT exists"
      # s3:GetObject is the only one release.sh needs — a failure here blocks
      # every deploy.
      if echo "$out" | grep -q "role_s3_get DENIED"; then
        no "instance role denied s3:GetObject on the artifact bucket — release.sh cannot fetch the build"
      elif echo "$out" | grep -q "role_s3_get UNTESTED"; then
        hmm "s3:GetObject untested — no probe object in the bucket yet. Run bootstrap once to stage one."
      else
        ok "instance role can GetObject from the artifact bucket"
      fi
      # ListBucket is convenience for humans debugging on the box, not a
      # blocker, so it warns rather than fails.
      echo "$out" | grep -q "role_s3_list DENIED" \
        && hmm "instance role cannot s3:ListBucket — deploys still work (they GetObject by exact key); only manual browsing on the box is affected" \
        || ok "instance role can list the artifact bucket"
      echo "$out" | grep -q "role_secrets DENIED" && no "instance role cannot list secrets — with-secrets.sh will fail closed" || ok "instance role can read Secrets Manager"
      echo "$out" | grep -q "DANGER" && no "$(echo "$out" | grep DANGER)" || ok "DIRECTOR_RESET / SEED_PRUNE_PLACEHOLDERS unset on the box"

      # Three bands, not two. A pass/fail at 600 MB reports 637 MB as fine, and
      # it is not fine: the website's own estimate tops out at 600, so that is
      # 37 MB of headroom on a box whose dashboard process is documented as
      # growing. Silence there would be the wrong signal.
      avail="$(echo "$out" | grep -o 'mem_avail=[0-9]*' | cut -d= -f2)"
      if [ -n "$avail" ]; then
        if   [ "$avail" -lt "$MIN_FREE_MB" ];   then no  "only ${avail} MB available — a Next.js website needs 400-600 MB"
        elif [ "$avail" -lt 800 ];              then hmm "${avail} MB available — enough to start, but the website alone may need up to 600 MB. Expect to resize to t3.medium; the CMS certainly will not fit."
        else                                         ok  "memory available: ${avail} MB"; fi
      fi
      echo "$out" | grep -o 'disk_use=[0-9]*%' | cut -d= -f2 | while read -r d; do
        [ "${d%\%}" -ge 80 ] && hmm "disk at $d" || ok "disk at $d"
      done

      running="$(echo "$out" | grep '^pm2:' | cut -d: -f2 | tr '\n' ' ')"
      [ -n "$running" ] && info "pm2 processes already running: $running"
      echo "$running" | grep -q "metnmat-dashboard" \
        && info "the command-center dashboard IS on this box — never 'pm2 restart all'"

      echo "$out" | grep -q "caddy:active" && ok "caddy running" || hmm "caddy not active — needed before DNS cutover"
    fi
  fi
fi

# ── 6. Media bucket ────────────────────────────────────────────────────────
sec "6. Media bucket"

if aws s3api head-bucket --bucket "$MEDIA_BUCKET" >/dev/null 2>&1; then
  ok "s3://$MEDIA_BUCKET reachable"
  pab="$(aws s3api get-public-access-block --bucket "$MEDIA_BUCKET" \
    --query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text 2>/dev/null)"
  [ "$pab" = "True" ] && ok "public access blocked" \
    || no "media bucket is not fully private — it holds unpublished manuscripts and customer RFQ attachments"

  objs="$(aws s3 ls "s3://$MEDIA_BUCKET" --recursive --summarize 2>/dev/null | grep 'Total Objects:' | awk '{print $3}')"
  if [ "${objs:-0}" -eq 0 ] 2>/dev/null; then
    hmm "0 objects — media has not been copied from GCS yet (deploy/bin/migrate-media.sh)"
    info "expected until GCP billing is restored; the website will render placeholders"
  else
    ok "$objs objects present"
  fi
else
  hmm "s3://$MEDIA_BUCKET not reachable — expected if media migration has not started"
fi

# ── Summary ────────────────────────────────────────────────────────────────
printf '\n\033[1mSummary\033[0m  \033[32m%d passed\033[0m · \033[33m%d warnings\033[0m · \033[31m%d failed\033[0m\n' "$pass" "$warn" "$fail"

if [ "$fail" -gt 0 ]; then
  printf '\n\033[31mNot ready to deploy.\033[0m Fix the ✗ items above first.\n'
  exit 1
fi
if [ "$warn" -gt 0 ]; then
  printf '\n\033[33mReady, with warnings.\033[0m Read them — several are expected before the media copy.\n'
  exit 0
fi
printf '\n\033[32mReady to deploy.\033[0m\n'
