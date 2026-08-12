#!/usr/bin/env bash
# Release script — runs ON the EC2 instance, invoked by SSM.
#
# It is uploaded to S3 next to the build artifact and fetched by the SSM
# command, rather than being embedded in the workflow YAML. Embedding shell in
# YAML that is itself JSON-encoded into an SSM parameter means three layers of
# quoting; a single stray quote there fails at deploy time, on the server, with
# a useless error. A file has none of that and can be linted with shellcheck.
#
#   usage: release.sh <git-sha>
#
# Contract with the workflow: s3://$ARTIFACT_BUCKET/$ARTIFACT_PREFIX/<sha>/
# contains web-build.tgz. Everything else is derived here.
#
# The dashboard (command-center) shares this server. Nothing below may touch it:
# no `pm2 restart all`, no global installs, no writes outside $APP_ROOT.

set -Eeuo pipefail

SHA="${1:?usage: release.sh <git-sha>}"

APP_NAME="${APP_NAME:-metnmat-website}"
APP_ROOT="${APP_ROOT:-/home/ec2-user/web}"
APP_PORT="${APP_PORT:-3100}"
HEALTH_PATH="${HEALTH_PATH:-/}"
HEALTH_HOST="${HEALTH_HOST:-www.metnmat.com}"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:?ARTIFACT_BUCKET not set}"
ARTIFACT_PREFIX="${ARTIFACT_PREFIX:-website}"
# How long to give the app to come up before declaring failure.
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"

RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
PREVIOUS="$APP_ROOT/previous"
TARGET="$RELEASES/$SHA"

log() { echo "[release $(date -u +%H:%M:%S)] $*"; }
fail() { echo "[release] FAILED: $*" >&2; exit 1; }

# ── 1. Fetch and unpack BESIDE the live version ────────────────────────────
# Never unpack over $CURRENT. The live app keeps serving from an untouched
# directory for the whole of this step; the swap later is a symlink move.
mkdir -p "$RELEASES"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "downloading artifact for $SHA"
aws s3 cp "s3://$ARTIFACT_BUCKET/$ARTIFACT_PREFIX/$SHA/web-build.tgz" "$TMP/web-build.tgz" --only-show-errors \
  || fail "artifact download failed — does s3://$ARTIFACT_BUCKET/$ARTIFACT_PREFIX/$SHA/ exist?"

rm -rf "$TARGET"
mkdir -p "$TARGET"
tar -xzf "$TMP/web-build.tgz" -C "$TARGET" || fail "artifact did not unpack — truncated upload?"

# ── 2. Verify the artifact is complete BEFORE touching the live symlink ────
# A truncated tar can still extract "successfully". BUILD_ID is written last by
# next build, so its presence is a cheap end-marker; server.js is what PM2 runs.
[ -f "$TARGET/apps/website/.next/BUILD_ID" ] || fail "BUILD_ID missing — artifact is incomplete, refusing to deploy"
[ -f "$TARGET/apps/website/server.js" ]      || fail "server.js missing — wrong archive layout"
log "artifact verified (BUILD_ID $(cat "$TARGET/apps/website/.next/BUILD_ID"))"

# ── 3. Record what is live now, so rollback has a target ───────────────────
ROLLBACK_TO=""
if [ -L "$CURRENT" ]; then
  ROLLBACK_TO="$(readlink -f "$CURRENT")"
  ln -sfn "$ROLLBACK_TO" "$PREVIOUS"
  log "previous release recorded: $(basename "$ROLLBACK_TO")"
fi

# ── 4. Swap ────────────────────────────────────────────────────────────────
# ln -sfn onto a temp name then mv is atomic; a plain `ln -sfn` on an existing
# symlink is not, and leaves a window where $CURRENT does not resolve.
ln -sfn "$TARGET" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT"
log "symlink swapped to $SHA"

# ── 5. Reload ONLY this app ────────────────────────────────────────────────
# `pm2 reload <name>` — never `restart all`, which would bounce the dashboard
# and the WhatsApp worker's siblings along with it.
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env || fail "pm2 reload failed"
else
  log "first deploy — starting $APP_NAME"
  pm2 start "$APP_ROOT/ecosystem.config.cjs" --only "$APP_NAME"
fi
pm2 save >/dev/null 2>&1 || true

# ── 6. Health check against LOCALHOST, not the public URL ──────────────────
# Deliberately not https://metnmat.com. Until DNS cuts over, that name still
# resolves to GCP, so checking it would report the OLD stack as healthy and
# mask a completely broken release. The Host header makes the app render as it
# will in production (canonical-host middleware, absolute URLs) while the
# connection stays on the box.
log "waiting for $APP_NAME on :$APP_PORT (timeout ${HEALTH_TIMEOUT}s)"
deadline=$(( SECONDS + HEALTH_TIMEOUT ))
code=""
until [ "$SECONDS" -ge "$deadline" ]; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -H "Host: $HEALTH_HOST" "http://127.0.0.1:$APP_PORT$HEALTH_PATH" || true)"
  [ "$code" = "200" ] && break
  sleep 3
done

if [ "$code" != "200" ]; then
  log "health check FAILED (last status: ${code:-no response})"

  if [ -n "$ROLLBACK_TO" ]; then
    log "rolling back to $(basename "$ROLLBACK_TO")"
    ln -sfn "$ROLLBACK_TO" "$CURRENT.tmp"
    mv -Tf "$CURRENT.tmp" "$CURRENT"
    pm2 reload "$APP_NAME" --update-env || true
    sleep 5
    back="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      -H "Host: $HEALTH_HOST" "http://127.0.0.1:$APP_PORT$HEALTH_PATH" || true)"
    log "post-rollback status: ${back:-no response}"
    [ "$back" = "200" ] || log "ROLLBACK DID NOT RESTORE SERVICE — manual intervention required"
  else
    log "no previous release to roll back to (first deploy)"
  fi

  echo "--- last 40 lines of $APP_NAME log ---" >&2
  pm2 logs "$APP_NAME" --lines 40 --nostream 2>&1 | tail -40 >&2 || true
  fail "deploy rolled back"
fi

log "health check OK — $SHA is live"

# ── 7. Prune old releases, keep the last 5 for rollback ────────────────────
# Never prune $CURRENT or $PREVIOUS even if they fall outside the window.
keep_current="$(readlink -f "$CURRENT" 2>/dev/null || true)"
keep_prev="$(readlink -f "$PREVIOUS" 2>/dev/null || true)"
# shellcheck disable=SC2012
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +6 | while read -r old; do
  old="${old%/}"
  [ "$old" = "$keep_current" ] && continue
  [ "$old" = "$keep_prev" ] && continue
  log "pruning old release $(basename "$old")"
  rm -rf "$old"
done

log "done"
