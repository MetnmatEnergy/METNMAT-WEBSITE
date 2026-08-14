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
# Must match the pm2 process name in ecosystem.config.cjs. Used to tell "our own
# app holds port 3100" apart from "something else does", so a wrong value here
# turns a healthy deployed box into a reported failure.
APP_NAME="${APP_NAME:-metnmat-website}"
EXPECTED_SECRETS="${EXPECTED_SECRETS:-22}"
# What the WEBSITE cannot start without. Must mirror REQUIRED_SECRETS in
# ecosystem.config.cjs — if the two disagree, this check passes a deploy the
# wrapper then refuses, or fails one it would have allowed.
REQUIRED_SECRETS="${REQUIRED_SECRETS:-INTERNAL_API_KEY}"
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

  # metnmat/prod/* is ONE pool shared by the website, the CMS and the WhatsApp
  # worker. Failing on any placeholder in it means reporting "not ready to
  # deploy the website" because a chatbot token is unset — which is not true and
  # blocks a deploy that would work. Split by what this app actually reads; the
  # same distinction with-secrets.sh enforces at boot.
  req_bad=""; other_bad=""; other_n=0
  for p in $placeholders; do
    case " $REQUIRED_SECRETS " in
      *" $p "*) req_bad="$req_bad $p" ;;
      *)        other_bad="$other_bad $p"; other_n=$((other_n + 1)) ;;
    esac
  done

  if [ -n "$req_bad" ]; then
    no "secret(s) the website REQUIRES still hold the placeholder:$req_bad"
    info "PLACEHOLDER_SET_ME is committed in infra/ and therefore public"
    info "populate in Secrets Manager, then 'pm2 reload' — no redeploy needed"
  else
    ok "every secret the website requires is populated ($REQUIRED_SECRETS)"
  fi

  if [ -n "$other_bad" ]; then
    hmm "$other_n other secret(s) still placeholder — the CMS and chatbot need these, the website does not"
    info "$other_bad"
    info "expected until GCP billing is restored and the real values can be copied across"
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

  # Gates the t3.medium resize. Resizing stops and starts the instance, and a
  # DEFAULT public IP is released on stop — the box comes back on a different
  # address while DNS still points at the old one. With the site live and every
  # hostname (www, apex, admin, chat) resolving to this address, that is a real
  # outage, not a theoretical one. An Elastic IP survives the stop/start.
  eip="$(aws ec2 describe-addresses --region "$AWS_REGION" \
    --filters "Name=instance-id,Values=$INSTANCE_ID" \
    --query 'Addresses[0].PublicIp' --output text 2>/dev/null)"
  pub="$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null)"
  if [ -n "$eip" ] && [ "$eip" != "None" ]; then
    ok "public IP $eip is an ELASTIC IP — survives the stop/start a resize requires"
  else
    no "public IP ${pub:-unknown} is NOT elastic — a resize would release it and the box would return on a different address, breaking DNS for every hostname"
    info "allocate an Elastic IP and associate it BEFORE resizing, or the resize causes an outage"
  fi

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
echo "--- is the website actually serving? ---"
# The deploy's own health check proves the app answered once, at release time.
# This answers a different question: is it still answering NOW. Same Host header
# the release uses, so the app renders as it will in production while the
# connection stays on the box.
code="\$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'Host: www.metnmat.com' http://127.0.0.1:$APP_PORT/ 2>/dev/null || true)"
echo "serving_status=\$code"
echo "--- caddy routing (through :443, Host header, self-signed accepted) ---"
# Proves the site blocks actually route, rather than merely that Caddy accepted
# the config. -k because pre-cutover the certificate is from Caddy's internal
# CA; what is being tested is routing, not trust.
#
# command-center is the REGRESSION check and the most important line here: it is
# the dashboard, it was already working, and nothing this migration does may
# break it.
# --resolve, NOT a Host header. Caddy selects the site block by TLS SNI, and SNI
# comes from the URL's hostname — so \`https://127.0.0.1/ -H "Host: x"\` sends SNI
# "127.0.0.1", matches nothing, and the handshake is refused before any header is
# read. Every hostname then looks dead, including ones that are demonstrably
# fine. --resolve keeps the connection on loopback while sending the real name.
#
# \${c:-000} rather than \`|| echo 000\`: on failure curl still prints 000 via -w
# AND returns non-zero, so the fallback appended a second 000 and produced the
# nonsense value "000000".
for h in www.metnmat.com metnmat.com admin.metnmat.com command-center.metnmat.com chat.metnmat.com; do
  c="\$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 --resolve "\$h:443:127.0.0.1" "https://\$h/" 2>/dev/null)"
  echo "route:\$h=\${c:-000}"
done
echo "--- cms on :3200 ---"
cms="\$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'Host: admin.metnmat.com' http://127.0.0.1:3200/admin 2>/dev/null)"
echo "cms_status=\${cms:-000}"
# When a process exists but does not answer, the log is the only thing that says
# why. Cheap enough to always emit, and the alternative is another round trip.
echo "--- cms recent log ---"
pm2 logs metnmat-cms --lines 25 --nostream 2>&1 | tail -25 | sed 's/^/cmslog: /' || echo "cmslog: (no log)"
echo "--- pm2 processes ---"
# sort -u: pm2 jlist carries "name" twice per app (top level and inside
# pm2_env), so without it every process is listed twice.
pm2 jlist 2>/dev/null | tr ',' '\n' | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sort -u | sed 's/^/pm2:/' || echo "pm2 not running"
echo "--- caddy ---"
systemctl is-active caddy 2>/dev/null | sed 's/^/caddy:/' || echo "caddy:absent"
echo "--- dangerous env ---"
for v in DIRECTOR_RESET SEED_PRUNE_PLACEHOLDERS; do [ -n "\${!v:-}" ] && echo "DANGER \$v is set" || echo "\$v unset"; done
REMOTE
)
  # Runs as ec2-user, not root. SSM executes as root by default, and that made
  # two checks lie:
  #
  #   pm2 jlist     — pm2 keeps a daemon PER USER. Root's daemon owns nothing, so
  #                   the process list came back EMPTY, and every check deriving
  #                   from it (is the port ours, is the site deployed, how should
  #                   free memory be judged) silently took its pre-deploy branch.
  #   [ -w APP_ROOT ] — root can write anywhere, so this passed unconditionally
  #                   and told us nothing about ec2-user, who actually deploys.
  #
  # ec2-user is the identity release.sh runs under, so it is the identity whose
  # view of the box is worth reporting.
  #
  # Base64 the script rather than escaping it into JSON. The payload then
  # contains nothing that needs quoting — no quotes, no backslashes, no newlines
  # — so the three layers of escaping (shell -> JSON -> remote shell) collapse to
  # none. Trying to escape it directly is how this check first broke.
  b64="$(printf '%s' "$remote" | base64 | tr -d '\n')"

  cid="$(aws ssm send-command --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" --comment "preflight" --timeout-seconds 120 \
    --parameters commands="[\"echo $b64 | base64 -d | sudo -u ec2-user bash\"]" \
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
      # Raw output, always. Two checks silently took the wrong branch because a
      # value they depend on parsed as empty, and there was no way to see that
      # from the verdicts alone — the verdicts are derived from exactly this.
      if [ "${PREFLIGHT_RAW:-true}" = "true" ]; then
        echo "  ── raw instance output ──"
        printf '%s\n' "$out" | sed 's/^/    │ /'
        echo "  ── end raw ──"
      fi
      echo "$out" | grep -q "MISSING node" && no "node missing on the instance"   || ok "node present"
      echo "$out" | grep -q "MISSING pm2"  && no "pm2 missing on the instance"    || ok "pm2 present"
      echo "$out" | grep -q "MISSING aws"  && no "aws cli missing — release.sh needs it to fetch the artifact" || ok "aws cli present on instance"

      # Needed by the port and memory checks below, so read it before them.
      running="$(echo "$out" | grep '^pm2:' | cut -d: -f2 | tr '\n' ' ')"
      deployed=0
      case " $running " in *" $APP_NAME "*) deployed=1 ;; esac

      # A busy port is only a problem if something ELSE holds it. Once the site
      # is deployed, our own process holding 3100 is the desired state — failing
      # on it made pre-flight report "not ready to deploy" about a system that
      # was already serving.
      if echo "$out" | grep -q "PORT_TAKEN"; then
        [ "$deployed" = "1" ] \
          && ok "port $APP_PORT held by $APP_NAME (deployed)" \
          || no "port $APP_PORT is in use by something other than $APP_NAME"
      else
        ok "port $APP_PORT free"
      fi
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

      # The question changes once the site is deployed. BEFORE, the number has to
      # cover the website's whole 400-600 MB footprint. AFTER, that footprint is
      # already paid — what is left is headroom, and judging it against a budget
      # already spent reports a healthy box as failing.
      avail="$(echo "$out" | grep -o 'mem_avail=[0-9]*' | cut -d= -f2)"
      if [ -n "$avail" ]; then
        if [ "$deployed" = "1" ]; then
          # Blueprint §12's own resize trigger is sustained availability under
          # ~200 MB, and that is the line that matters here.
          if   [ "$avail" -lt 200 ]; then no  "${avail} MB headroom with the site running — at the blueprint's resize threshold; move to t3.medium"
          elif [ "$avail" -lt 400 ]; then hmm "${avail} MB headroom with the site running — thin. Watch for swap and unexplained pm2 restarts."
          else                            ok  "${avail} MB headroom with the site running"; fi
        else
          if   [ "$avail" -lt "$MIN_FREE_MB" ]; then no  "only ${avail} MB available — a Next.js website needs 400-600 MB"
          elif [ "$avail" -lt 800 ];            then hmm "${avail} MB available — enough to start, but the website alone may need up to 600 MB. Expect to resize to t3.medium; the CMS certainly will not fit."
          else                                       ok  "memory available: ${avail} MB"; fi
        fi
      fi
      echo "$out" | grep -o 'disk_use=[0-9]*%' | cut -d= -f2 | while read -r d; do
        [ "${d%\%}" -ge 80 ] && hmm "disk at $d" || ok "disk at $d"
      done

      serving="$(echo "$out" | grep -o 'serving_status=[0-9]*' | cut -d= -f2)"
      case "$serving" in
        200) ok "website is serving on 127.0.0.1:$APP_PORT (HTTP 200)" ;;
        000|"") hmm "nothing answering on 127.0.0.1:$APP_PORT — expected before the first deploy" ;;
        *)   no "website answered HTTP $serving on 127.0.0.1:$APP_PORT" ;;
      esac

      # Caddy routing, per hostname. Each has a different "correct" answer, so a
      # blanket 200-or-fail would be wrong.
      if echo "$out" | grep -q '^route:'; then
        for line in $(echo "$out" | grep '^route:' | tr -d ' '); do
          host="${line#route:}"; host="${host%%=*}"
          code="${line##*=}"
          case "$host:$code" in
            command-center.metnmat.com:200|command-center.metnmat.com:30*)
              ok "dashboard still routing ($code) — unaffected by the new blocks" ;;
            command-center.metnmat.com:*)
              no "DASHBOARD REGRESSION: command-center answered $code — it worked before these blocks were added" ;;
            admin.metnmat.com:502|admin.metnmat.com:503)
              hmm "admin.metnmat.com routes but returns $code — expected: nothing listens on 3200 until the CMS is deployed" ;;
            # DNS for chat was pointed here too, but the chatbot lives in a
            # separate repository and no Caddy block exists for it. With no
            # block, the TLS handshake itself is refused — visitors get a
            # connection error rather than a page, which is the worst of the
            # available failures.
            chat.metnmat.com:000)
              no "chat.metnmat.com resolves HERE but nothing serves it — no Caddy block, so TLS is refused outright" ;;
            chat.metnmat.com:*)
              hmm "chat.metnmat.com answered $code" ;;
            *:200)
              ok "$host routes correctly (200)" ;;
            *:000)
              no "$host did not answer at all — Caddy is not serving this hostname" ;;
            *)
              hmm "$host answered $code" ;;
          esac
        done
      fi

      # Distinguishes "the CMS is not deployed" from "it is deployed and
      # broken" — a 502 at the edge looks identical for both, and they need
      # completely different responses.
      cms_code="$(echo "$out" | grep -o 'cms_status=[0-9]*' | cut -d= -f2)"
      case " $running " in
        *" metnmat-cms "*)
          case "$cms_code" in
            200|302|307) ok "CMS process running and answering $cms_code on :3200" ;;
            *)
              no "CMS process is running but :3200 answers ${cms_code:-nothing}"
              echo "$out" | grep '^cmslog:' | sed 's/^cmslog:/       /' | tail -25 ;;
          esac ;;
        *)
          hmm "CMS is not deployed (no metnmat-cms process) — admin.metnmat.com will 502" ;;
      esac

      # $running was read earlier — the port and memory checks depend on it.
      [ -n "$running" ] && info "pm2 processes running: $running"
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

# ── 7. CMS readiness ───────────────────────────────────────────────────────
# Separate from the website's checks on purpose: the CMS is a different app with
# different requirements, and "the website is fine" says nothing about whether
# the CMS could start. These four are what payload.config.ts
# assertProductionConfig() throws on — it refuses to boot without them, and
# refuses on PLACEHOLDER_SET_ME specifically, because that literal is committed
# in infra/ and therefore public.
sec "7. CMS readiness (not yet deployed)"

CMS_REQUIRED="MONGODB_URI PAYLOAD_SECRET PAYLOAD_PIN_PEPPER CMS_URL"
cms_missing=""
for s in $CMS_REQUIRED; do
  v="$(aws secretsmanager get-secret-value --region "$AWS_REGION" \
    --secret-id "${SECRET_PREFIX}${s}" --query SecretString --output text 2>/dev/null || true)"
  if [ -z "$v" ] || [ "$v" = "PLACEHOLDER_SET_ME" ]; then
    cms_missing="$cms_missing $s"
  fi
done

if [ -n "$cms_missing" ]; then
  no "CMS cannot boot — required secret(s) unset or placeholder:$cms_missing"
  info "assertProductionConfig() throws on these; the process would exit at start"
else
  ok "all four secrets the CMS requires are populated"
fi

# The DB NAME is the whole bug in gotcha #1 — /metnmat is the chatbot's
# database, and pointing the CMS at it empties the shop and 500s depth=1
# queries. Checked without reading or printing the URI: the suffix alone is
# enough, and it is not a credential.
mongo_db="$(aws secretsmanager get-secret-value --region "$AWS_REGION" \
  --secret-id "${SECRET_PREFIX}MONGODB_URI" --query SecretString --output text 2>/dev/null \
  | sed -n 's#.*/\([A-Za-z0-9_-]*\)?.*#\1#p')"
case "$mongo_db" in
  "")               : ;;
  metnmat_cms)      ok "MONGODB_URI targets metnmat_cms" ;;
  # A genuine incompatibility, not a naming preference: the chatbot's database
  # holds a different schema entirely, so the shop reads empty and depth=1
  # queries 500 (CLAUDE.md gotcha #1).
  metnmat)          no "MONGODB_URI targets '/metnmat' — the CHATBOT's database, a different schema. The shop reads empty and depth=1 queries 500." ;;
  # Warning, not failure. Any Mongo database works technically; which one to
  # point at is a data decision, and the operator's to make. The consequence is
  # what matters, so state it and move on.
  *)                hmm "MONGODB_URI targets '$mongo_db' (not 'metnmat_cms')" ;;
esac
[ -n "$mongo_db" ] && [ "$mongo_db" != "metnmat_cms" ] && [ "$mongo_db" != "metnmat" ] && {
  info "the live site will read products, orders and customers from '$mongo_db',"
  info "and write real customer data there. Intentional for a staged cutover;"
  info "worth confirming it is intentional."
}

# ── Origin checks: these BREAK the CMS, and are not a matter of taste ──────
# payload.config.ts:65-72 builds trustedOrigins from CMS_URL (falling back to
# NEXT_PUBLIC_SERVER_URL, then to http://localhost:3001) plus WEBSITE_URL, and
# passes it to BOTH cors and csrf. Payload honours the admin auth cookie only
# for origins in that list, so if the list does not contain the origin the admin
# is actually served from, every save fails with "You are not allowed to perform
# this action" — for a super-admin, with no boot error. The process looks
# perfectly healthy.
for pair in "CMS_URL|https://admin.metnmat.com" "WEBSITE_URL|https://www.metnmat.com"; do
  n="${pair%%|*}"; expect="${pair#*|}"
  v="$(aws secretsmanager get-secret-value --region "$AWS_REGION" \
    --secret-id "${SECRET_PREFIX}${n}" --query SecretString --output text 2>/dev/null || true)"
  case "$v" in
    "")            no "$n is unset — cors/csrf fall back to localhost and every admin write is rejected" ;;
    *localhost*|*127.0.0.1*)
                   no "$n points at localhost. Served from $expect, that origin is untrusted and every admin save fails with 'You are not allowed to perform this action'" ;;
    https://*)     ok "$n is a public https origin" ;;
    *)             hmm "$n is '$v' — expected something like $expect" ;;
  esac
done

# DIRECTOR_RESET is not advice. seed.ts:730 reads it at boot and deletes every
# staff account except the director — and a pm2 memory-restart is a boot.
dr="$(aws secretsmanager get-secret-value --region "$AWS_REGION" \
  --secret-id "${SECRET_PREFIX}DIRECTOR_RESET" --query SecretString --output text 2>/dev/null || true)"
case "$dr" in
  ""|"false"|"0") ok "DIRECTOR_RESET is not enabled" ;;
  *)              no "DIRECTOR_RESET='$dr' — deletes every staff account except the director on EVERY boot, and pm2 restarts are boots" ;;
esac

# ── Advisory: values that work, but are worth knowing you chose ────────────
# Deliberately warnings, not failures. Each of these FUNCTIONS correctly; none
# prevents the CMS from starting or serving. Flagging them as failures conflated
# "I would not have picked this" with "this is broken", which is not the job.
advisory=""
for s in PAYLOAD_SECRET PAYLOAD_PIN_PEPPER INTERNAL_API_KEY RAZORPAY_KEY_ID; do
  v="$(aws secretsmanager get-secret-value --region "$AWS_REGION" \
    --secret-id "${SECRET_PREFIX}${s}" --query SecretString --output text 2>/dev/null || true)"
  [ -z "$v" ] && continue
  case "$v" in
    rzp_test_*)                        advisory="$advisory ${s}(test-mode:no-real-payments)" ;;
    *change-me*|dev-*|*dev-only*)      advisory="$advisory ${s}(dev-marker)" ;;
  esac
  # payload.config.ts:129 warns below 16 and boots anyway — so this warns too.
  case "$s" in
    PAYLOAD_PIN_PEPPER|PAYLOAD_SECRET)
      [ "${#v}" -lt 16 ] && advisory="$advisory ${s}(${#v}-chars:payload-warns-below-16)" ;;
  esac
done
if [ -n "$advisory" ]; then
  hmm "values that work but are worth a deliberate decision:$advisory"
  info "none of these blocks the CMS. PAYLOAD_SECRET signs admin JWTs, so a value"
  info "that has been shared anywhere means those sessions are forgeable — a"
  info "security judgement, not a compatibility one."
else
  ok "no advisory findings on the security-critical secrets"
fi

# The CMS wants 500-800 MB on top of whatever is already resident.
if [ -n "${avail:-}" ]; then
  if [ "$avail" -lt 800 ]; then
    no "${avail} MB free — the CMS needs 500-800 MB. Resize to t3.medium before deploying it."
  else
    ok "${avail} MB free — enough headroom to attempt the CMS"
  fi
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
