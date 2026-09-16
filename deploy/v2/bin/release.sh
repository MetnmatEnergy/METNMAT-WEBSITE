#!/usr/bin/env bash
# metnmat-release <app> <sha>
#
# Runs as ROOT over SSM. Downloads the artifact GitHub Actions uploaded, verifies
# its sha256 sidecar, extracts it into a release directory owned by root (the
# app can read and execute its code, never modify it), swaps the `current`
# symlink, restarts the systemd unit, health-checks on loopback, and rolls back
# to the previous release if the health check fails.
#
#   metnmat-release web  <sha>      artifact s3://$ARTIFACT_BUCKET/web/<sha>/web-build.tgz
#   metnmat-release cms  <sha>      …/cms/<sha>/cms-build.tgz
#   metnmat-release chat <sha>      …/chat/<sha>/chatbot-build.tgz
#   metnmat-release cc   <sha>      …/cc/<sha>/cc-build.tgz
set -Eeuo pipefail

APP="${1:?usage: metnmat-release <web|cms|chat|cc> <sha>}"
SHA="${2:?usage: metnmat-release <app> <sha>}"
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || { echo "bad sha"; exit 64; }
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-metnmat-deploy-artifacts-976134557584}"
REGION="${AWS_REGION:-ap-south-1}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

# Per-app contract. ENTRY must exist in the unpacked artifact; WRITABLE dirs are
# the only paths the app user may write inside its release.
case "$APP" in
  web)  ARTIFACT=web-build.tgz;     ENTRY=apps/website/server.js;           BUILD_ID=apps/website/.next/BUILD_ID
        PORT=3100; HOST_HDR=www.metnmat.com;            HEALTH_PATH=/;            OK="200";
        WRITABLE="apps/website/.next/cache" ;;
  cms)  ARTIFACT=cms-build.tgz;     ENTRY=node_modules/next/dist/bin/next;  BUILD_ID=.next/BUILD_ID
        PORT=3200; HOST_HDR=admin.metnmat.com;          HEALTH_PATH=/admin/login; OK="200";
        WRITABLE=".next/cache" ;;
  chat) ARTIFACT=chatbot-build.tgz; ENTRY=index.ts;                         BUILD_ID=""
        PORT=3002; HOST_HDR=chat.metnmat.com;           HEALTH_PATH=/health;      OK="200 404";
        WRITABLE="" ;;
  cc)   ARTIFACT=cc-build.tgz;      ENTRY=node_modules/next/dist/bin/next;  BUILD_ID=.next/BUILD_ID
        PORT=3000; HOST_HDR=command-center.metnmat.com; HEALTH_PATH=/login;       OK="200";
        WRITABLE=".next/cache" ;;
  *) echo "unknown app $APP"; exit 64 ;;
esac
UNIT="metnmat-${APP}.service"; USER_="mm-${APP}"
ROOT="/srv/metnmat/${APP}"; RELEASES="$ROOT/releases"; CURRENT="$ROOT/current"; PREVIOUS="$ROOT/previous"
TARGET="$RELEASES/$SHA"

log()  { echo "[release:${APP} $(date -u +%H:%M:%S)] $*"; }
fail() { echo "[release:${APP}] FAILED: $*" >&2; exit 1; }
[ "$(id -u)" = "0" ] || fail "must run as root"
id "$USER_" >/dev/null 2>&1 || fail "user $USER_ missing — run bootstrap-host.sh first"
mkdir -p "$RELEASES"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
SRC="s3://${ARTIFACT_BUCKET}/${APP}/${SHA}"
log "downloading ${SRC}/${ARTIFACT}"
aws s3 cp "${SRC}/${ARTIFACT}"        "$TMP/$ARTIFACT"        --region "$REGION" --only-show-errors || fail "artifact download failed"
aws s3 cp "${SRC}/${ARTIFACT}.sha256" "$TMP/$ARTIFACT.sha256" --region "$REGION" --only-show-errors || fail "sha256 sidecar missing — refusing unverified artifact"
( cd "$TMP" && sha256sum -c --quiet "$ARTIFACT.sha256" ) || fail "sha256 mismatch — artifact corrupted or tampered"
log "artifact integrity OK"

rm -rf "$TARGET"; mkdir -p "$TARGET"
tar -xzf "$TMP/$ARTIFACT" -C "$TARGET" || fail "artifact did not unpack"
[ -e "$TARGET/$ENTRY" ] || fail "$ENTRY missing — wrong archive layout"
[ -z "$BUILD_ID" ] || [ -f "$TARGET/$BUILD_ID" ] || fail "$BUILD_ID missing — incomplete build"

# Ownership: root owns the code, the app's group may read/execute, nobody else.
chown -R root:"$USER_" "$TARGET"
chmod -R u+rwX,g+rX,g-w,o-rwx "$TARGET"
for w in $WRITABLE; do install -d -o "$USER_" -g "$USER_" -m 0750 "$TARGET/$w"; done
chown root:"$USER_" "$RELEASES" "$ROOT"; chmod 0750 "$RELEASES" "$ROOT"
log "release files locked down (root:${USER_}, code read-only for the app)"

ROLLBACK_TO=""
if [ -L "$CURRENT" ]; then ROLLBACK_TO="$(readlink -f "$CURRENT")"; ln -sfn "$ROLLBACK_TO" "$PREVIOUS"; fi
ln -sfn "$TARGET" "$CURRENT.tmp"; mv -Tf "$CURRENT.tmp" "$CURRENT"
log "current -> $SHA"

systemctl daemon-reload
systemctl restart "$UNIT" || { journalctl -u "$UNIT" -n 40 --no-pager >&2; fail "systemctl restart $UNIT failed (secrets missing? see journal above)"; }

healthy() { for w in $OK; do [ "$1" = "$w" ] && return 0; done; return 1; }
deadline=$((SECONDS + HEALTH_TIMEOUT)); code=""
until [ $SECONDS -ge $deadline ]; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $HOST_HDR" "http://127.0.0.1:${PORT}${HEALTH_PATH}" || true)"
  healthy "$code" && break; sleep 3
done

if ! healthy "$code"; then
  log "health check FAILED (last status: ${code:-none})"
  journalctl -u "$UNIT" -n 60 --no-pager >&2 || true
  if [ -n "$ROLLBACK_TO" ]; then
    log "rolling back to $(basename "$ROLLBACK_TO")"
    ln -sfn "$ROLLBACK_TO" "$CURRENT.tmp"; mv -Tf "$CURRENT.tmp" "$CURRENT"
    systemctl restart "$UNIT" || true; sleep 6
    back="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $HOST_HDR" "http://127.0.0.1:${PORT}${HEALTH_PATH}" || true)"
    log "post-rollback status: ${back:-none}"; healthy "$back" || log "ROLLBACK DID NOT RESTORE SERVICE — manual intervention required"
  fi
  fail "deploy rolled back"
fi
log "health OK (${code}) — $SHA is live"

keep_cur="$(readlink -f "$CURRENT")"; keep_prev="$(readlink -f "$PREVIOUS" 2>/dev/null || true)"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +6 | while read -r old; do
  old="${old%/}"; [ "$old" = "$keep_cur" ] && continue; [ "$old" = "$keep_prev" ] && continue
  log "pruning $(basename "$old")"; rm -rf "$old"
done
log "done"
