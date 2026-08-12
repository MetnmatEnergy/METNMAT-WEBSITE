#!/usr/bin/env bash
# Copy METNMAT media from GCS to S3, then prove the copy is complete.
#
#   ./migrate-media.sh inventory   # baseline, run FIRST, before copying
#   ./migrate-media.sh copy        # the copy itself (resumable, re-runnable)
#   ./migrate-media.sh verify      # count + bytes + spot checks
#
# ⚠ THIS IS THE ONLY COPY OF THE DATA. gs://metnmat-media-prod holds every
#   product photo, blog cover, project cover, datasheet and customer RFQ
#   attachment, and the GCP project is billing-disabled and in a grace period.
#   Nothing in this script deletes anything, from either side, ever. Do not add
#   a --delete-removed / --delete flag to it.
#
# ⚠ KEYS MUST BE PRESERVED EXACTLY. Object keys are flat and shared across four
#   Payload collections (media, documents, enquiry-uploads,
#   blog-submission-files), and the database stores ONLY the filename. Any
#   re-organisation — adding a prefix, foldering by collection, lowercasing —
#   orphans every existing record. rsync/cp below are key-for-key.
#
# ⚠ DERIVATIVES CANNOT BE REBUILT. Payload generates five sizes plus the
#   original at upload time only, and never regenerates them. A copy that
#   silently drops files loses those sizes permanently. That is why `verify`
#   checks total BYTES and not just object COUNT: a truncated object still
#   counts as one object.

set -Eeuo pipefail

GCS_BUCKET="${GCS_BUCKET:-gs://metnmat-media-prod}"
S3_BUCKET="${S3_BUCKET:-s3://metnmat-media-prod}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
WORKDIR="${WORKDIR:-./media-migration}"

mkdir -p "$WORKDIR"

log() { echo "[media $(date -u +%H:%M:%S)] $*"; }
fail() { echo "[media] FAILED: $*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || fail "$1 not found on PATH"; }

# ── inventory ──────────────────────────────────────────────────────────────
# Run before copying anything. Without a baseline there is nothing to verify a
# copy against, and "it looked about right" is not a check.
cmd_inventory() {
  need gsutil
  log "inventorying $GCS_BUCKET (this reads every object's metadata; be patient)"

  gsutil ls -r "$GCS_BUCKET/**" > "$WORKDIR/gcs-objects.txt" \
    || fail "could not list $GCS_BUCKET — is GCP billing restored?"

  gsutil du -s "$GCS_BUCKET" > "$WORKDIR/gcs-size.txt" || fail "could not size $GCS_BUCKET"

  local count bytes
  count="$(grep -c . < "$WORKDIR/gcs-objects.txt" || echo 0)"
  bytes="$(awk '{print $1}' < "$WORKDIR/gcs-size.txt")"

  {
    echo "source=$GCS_BUCKET"
    echo "count=$count"
    echo "bytes=$bytes"
  } > "$WORKDIR/baseline.txt"

  log "BASELINE: $count objects, $bytes bytes"
  log "  saved to $WORKDIR/baseline.txt — keep this file, verify depends on it"
  log ""
  log "  Storage cost estimate at S3 Standard ap-south-1 (~\$0.025/GB-month):"
  awk -v b="$bytes" 'BEGIN { printf "    %.2f GB  ->  ~$%.2f/month\n", b/1073741824, (b/1073741824)*0.025 }'
}

# ── copy ───────────────────────────────────────────────────────────────────
cmd_copy() {
  need gsutil
  [ -f "$WORKDIR/baseline.txt" ] || fail "run 'inventory' first — no baseline to verify against"

  log "copying $GCS_BUCKET -> $S3_BUCKET (keys preserved, nothing deleted)"
  log "  this is resumable: re-run it after an interruption and it skips what exists"

  # -m parallel, -r recursive. NOT -d (delete-extras): this must never remove
  # anything from either side.
  gsutil -m rsync -r "$GCS_BUCKET" "$S3_BUCKET" \
    || fail "rsync failed — re-run to resume; nothing was deleted"

  log "copy pass complete — now run: $0 verify"
}

# ── verify ─────────────────────────────────────────────────────────────────
cmd_verify() {
  need aws
  [ -f "$WORKDIR/baseline.txt" ] || fail "run 'inventory' first"

  # shellcheck disable=SC1091
  local src_count src_bytes dst_count dst_bytes
  src_count="$(grep '^count=' "$WORKDIR/baseline.txt" | cut -d= -f2)"
  src_bytes="$(grep '^bytes=' "$WORKDIR/baseline.txt" | cut -d= -f2)"

  log "measuring $S3_BUCKET"
  # --summarize gives both numbers in one pass. `s3 ls --recursive` paginates
  # internally, so this is accurate for buckets larger than one page.
  local summary
  summary="$(aws s3 ls "$S3_BUCKET" --recursive --summarize --region "$AWS_REGION" \
    | tail -3)" || fail "could not list $S3_BUCKET"

  dst_count="$(echo "$summary" | grep 'Total Objects:' | awk '{print $3}')"
  dst_bytes="$(echo "$summary" | grep 'Total Size:'    | awk '{print $3}')"

  echo
  printf '  %-10s %14s %16s\n' ""       "OBJECTS" "BYTES"
  printf '  %-10s %14s %16s\n' "GCS"    "$src_count" "$src_bytes"
  printf '  %-10s %14s %16s\n' "S3"     "$dst_count" "$dst_bytes"
  echo

  local ok=1
  [ "$src_count" = "$dst_count" ] || { log "MISMATCH: object count differs"; ok=0; }
  [ "$src_bytes" = "$dst_bytes" ] || { log "MISMATCH: total bytes differ — some object is truncated"; ok=0; }
  [ "$ok" = 1 ] || fail "verification failed — DO NOT switch production media to S3"

  log "count and bytes match"

  # Bytes matching proves the transfer was complete. It does not prove the
  # objects are usable, so pull a handful back and check they are real files.
  log "spot-checking 5 objects"
  local tmp; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' RETURN
  aws s3 ls "$S3_BUCKET" --recursive --region "$AWS_REGION" \
    | awk '{print $4}' | grep -Ei '\.(webp|jpg|jpeg|png|pdf)$' | head -5 \
    | while read -r key; do
        aws s3 cp "$S3_BUCKET/$key" "$tmp/probe" --quiet --region "$AWS_REGION" \
          || fail "could not download $key"
        local kind; kind="$(file -b "$tmp/probe" 2>/dev/null || echo unknown)"
        printf '    %-60s %s\n' "$(basename "$key")" "$kind"
        case "$kind" in
          *"Web/P"*|*WebP*|*JPEG*|*PNG*|*PDF*) ;;
          *) fail "$key does not look like a real image/PDF — got: $kind" ;;
        esac
      done

  log "spot checks passed"
  log ""
  log "NEXT: switch STORAGE_PROVIDER=s3 (with S3_BUCKET/S3_REGION) and redeploy"
  log "      the CMS. Keep the GCS bucket until the site is proven on S3 — it is"
  log "      the only rollback target."
}

case "${1:-}" in
  inventory) cmd_inventory ;;
  copy)      cmd_copy ;;
  verify)    cmd_verify ;;
  *) echo "usage: $0 {inventory|copy|verify}" >&2; exit 64 ;;
esac
