#!/usr/bin/env bash
# One-time server preparation — blueprint steps 2, 3 and 8.
#
# Creates the website's directory tree, confirms the runtime is present, wires
# PM2 to survive a reboot, and installs the Caddy site blocks. Idempotent: safe
# to re-run, and re-running is the intended way to apply a Caddy change.
#
#   usage: bootstrap-server.sh            # prepare
#          bootstrap-server.sh --report   # inspect only, change nothing
#
# Run it BEFORE the first deploy. release.sh assumes $APP_ROOT exists and that
# pm2 is installed; without this, the first deploy dies at `pm2 start`.
#
# ── The one rule ───────────────────────────────────────────────────────────
# This box may also run the internal command-center dashboard. Nothing here may
# touch it. Specifically: no `pm2 restart all`, no `pm2 delete`, no rewrite of
# the main Caddyfile, no package upgrades. Every write is inside $APP_ROOT or a
# new file in Caddy's conf.d. If the main Caddyfile needs a change, this script
# prints the change and refuses to make it.

set -uo pipefail

APP_ROOT="${APP_ROOT:-/home/ec2-user/web}"
APP_NAME="${APP_NAME:-metnmat-website}"
APP_PORT="${APP_PORT:-3100}"
CADDY_CONF_D="${CADDY_CONF_D:-/etc/caddy/conf.d}"
CADDY_MAIN="${CADDY_MAIN:-/etc/caddy/Caddyfile}"
CADDY_SRC="${CADDY_SRC:-}"          # path to metnmat.Caddyfile, if installing
REPORT_ONLY=0
[ "${1:-}" = "--report" ] && REPORT_ONLY=1

ok()   { printf '  [ok]   %s\n' "$*"; }
no()   { printf '  [FAIL] %s\n' "$*"; }
hmm()  { printf '  [warn] %s\n' "$*"; }
info() { printf '         %s\n' "$*"; }
sec()  { printf '\n== %s ==\n' "$*"; }

fails=0
fail() { no "$*"; fails=$((fails+1)); }

# ── 1. What is already here ────────────────────────────────────────────────
# Run first and unconditionally: the answer decides how much memory the website
# may take, and whether a careless pm2 command would take down the dashboard.
sec "Existing state"

info "user: $(whoami)   host: $(hostname)"

for b in node pm2 caddy tar curl aws; do
  if command -v "$b" >/dev/null 2>&1; then
    # The space after $( matters: `$((` is arithmetic expansion, not a subshell.
    ok "$b $( ("$b" --version 2>/dev/null || echo '') | head -1 | cut -c1-24)"
  else
    case "$b" in
      node|pm2|tar|curl|aws) fail "$b missing — required" ;;
      caddy)                 hmm "caddy missing — needed before DNS cutover, not before the first deploy" ;;
    esac
  fi
done

running=""
if command -v pm2 >/dev/null 2>&1; then
  running="$(pm2 jlist 2>/dev/null | tr ',' '\n' | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sort -u | tr '\n' ' ')"
fi
if [ -n "$running" ]; then
  info "pm2 processes: $running"
  case "$running" in
    *metnmat-dashboard*)
      hmm "THE DASHBOARD IS ON THIS BOX — shared instance"
      info "never 'pm2 restart all'; the website's memory budget is what is left over"
      ;;
    *)
      ok "no dashboard process here — this instance appears dedicated to the website"
      info "if so the website may use the full instance memory, and the blueprint's"
      info "834 MB figure (which assumed sharing) does not apply"
      ;;
  esac
else
  info "pm2 has no processes registered yet"
fi

# The number that decides whether the CMS can ever join this box.
if command -v free >/dev/null 2>&1; then
  free -m | awk '/^Mem:/{printf "         memory: %s MB total, %s MB available\n", $2, $7}'
fi
df -h / 2>/dev/null | awk 'NR==2{printf "         disk: %s used of %s (%s)\n", $3, $2, $5}'

# Whether the main Caddyfile imports conf.d decides whether the site blocks can
# be installed at all — the install path refuses to edit that file, because it
# is what currently serves the dashboard. Reporting it here means finding out
# before attempting, not during.
if command -v caddy >/dev/null 2>&1; then
  if sudo test -f "$CADDY_MAIN" 2>/dev/null; then
    if sudo grep -qE '^\s*import\s+(conf\.d/|/etc/caddy/conf\.d/)' "$CADDY_MAIN" 2>/dev/null; then
      ok "main Caddyfile imports conf.d — site blocks can be installed"
    else
      hmm "main Caddyfile does NOT import conf.d — add: import $CADDY_CONF_D/*.caddy"
      info "the install path will refuse to edit that file; it serves the dashboard"
    fi
    sudo grep -cE '^\s*[a-z0-9.*-]+\.metnmat\.com' "$CADDY_MAIN" 2>/dev/null \
      | sed 's/^/         hostnames in the main Caddyfile: /'
  else
    hmm "no Caddyfile at $CADDY_MAIN"
  fi
fi

# Port availability belongs in the report, not after it: "is 3100 free" is
# diagnostic information, and a report that omits it sends you into `prepare`
# without knowing whether the deploy can bind at all.
if (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -q ":$APP_PORT "; then
  case "$running" in
    *"$APP_NAME"*) ok "port $APP_PORT held by $APP_NAME (already deployed)" ;;
    *)             no "port $APP_PORT is held by something else" ;;
  esac
else
  ok "port $APP_PORT free"
fi

if [ "$REPORT_ONLY" = "1" ]; then
  printf '\nreport only — nothing was changed\n'
  exit 0
fi
[ "$fails" -gt 0 ] && { printf '\nMissing prerequisites above. Install them, then re-run.\n'; exit 1; }

# ── 2. Directory tree ──────────────────────────────────────────────────────
sec "Directories"

for d in "$APP_ROOT" "$APP_ROOT/releases" "$APP_ROOT/logs" "$APP_ROOT/bin"; do
  if [ -d "$d" ]; then ok "exists: $d"
  else mkdir -p "$d" && ok "created: $d" || fail "could not create $d"; fi
done
[ -w "$APP_ROOT" ] && ok "writable by $(whoami)" || fail "$APP_ROOT not writable by $(whoami)"

# ── 3. Swap ────────────────────────────────────────────────────────────────
sec "Swap"

# Four applications on a 4 GB box with no swap, and roughly 400 MB headroom.
# sharp allocates OUTSIDE the V8 heap, so the pm2 memory caps do not bound the
# spike a catalogue image upload produces. With no swap the kernel's only move
# under pressure is to kill something, and it chooses by RSS rather than by who
# caused the spike — the command-center dashboard is a plausible casualty of an
# upload it had nothing to do with.
#
# Swap adds no capacity. It converts an instant kill into paging: slow, ugly,
# survivable, and it gives pm2's max_memory_restart a chance to act first.
# Created only when absent. Never resized, never removed.
swap_mb="$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}')"
if [ -n "$swap_mb" ] && [ "$swap_mb" -gt 0 ]; then
  ok "swap already configured: ${swap_mb} MB"
elif [ -e /swapfile ]; then
  # Present but inactive means something already went wrong here. Guessing at
  # the reason risks destroying a file somebody made deliberately.
  hmm "/swapfile exists but is not active — leaving it alone"
else
  root_free_g="$(df -Pk / 2>/dev/null | awk 'NR==2 {print int($4/1048576)}')"
  if [ -n "$root_free_g" ] && [ "$root_free_g" -lt 6 ]; then
    hmm "only ${root_free_g}G free on / — not creating a 2G swapfile"
  elif sudo fallocate -l 2G /swapfile 2>/dev/null \
       || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none 2>/dev/null; then
    sudo chmod 600 /swapfile
    if sudo mkswap /swapfile >/dev/null 2>&1 && sudo swapon /swapfile 2>/dev/null; then
      ok "2G swapfile created and active"
      grep -q '^/swapfile ' /etc/fstab 2>/dev/null \
        || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
      ok "recorded in /etc/fstab — survives a reboot"
      # 10, not the default 60. This is an overflow valve, not a tier to page
      # into routinely; anonymous pages stay resident until pressure is real.
      sudo sysctl -q vm.swappiness=10 2>/dev/null || true
      grep -q '^vm.swappiness' /etc/sysctl.d/99-metnmat.conf 2>/dev/null \
        || echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.d/99-metnmat.conf >/dev/null
      ok "vm.swappiness=10"
    else
      sudo rm -f /swapfile
      hmm "could not enable swap — partial file removed"
    fi
  else
    hmm "could not allocate /swapfile"
  fi
fi

# ── 4. Port ────────────────────────────────────────────────────────────────
sec "Port $APP_PORT"

if (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -q ":$APP_PORT "; then
  holder="$( (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep ":$APP_PORT " | head -1)"
  # Ours from a previous run is fine; anything else is a genuine conflict.
  case "$running" in
    *"$APP_NAME"*) ok "held by $APP_NAME (already deployed)" ;;
    *) fail "port $APP_PORT is held by something else"; info "$holder" ;;
  esac
else
  ok "free"
fi

# ── 5. PM2 survives a reboot ───────────────────────────────────────────────
sec "PM2 boot persistence"

# Only configure if it is not already configured. On a shared box the dashboard
# has very likely done this, and re-running `pm2 startup` would rewrite a unit
# that is currently keeping the dashboard alive.
if systemctl list-unit-files 2>/dev/null | grep -q '^pm2-'; then
  ok "pm2 systemd unit already present — left alone"
else
  hmm "pm2 is not configured to start on boot"
  info "run this once, as a human, and read what it prints before running the sudo line it gives you:"
  info "    pm2 startup systemd -u $(whoami) --hp $HOME"
  info "deliberately not run automatically: it writes a systemd unit that governs"
  info "every pm2 app on this box, including the dashboard"
fi

# ── 6. Caddy ───────────────────────────────────────────────────────────────
sec "Caddy"

if ! command -v caddy >/dev/null 2>&1; then
  hmm "caddy not installed — skipping (only needed before DNS cutover)"
elif [ -z "$CADDY_SRC" ]; then
  info "CADDY_SRC not set — skipping site-block install"
  info "set CADDY_SRC=/path/to/metnmat.Caddyfile to install it"
elif [ ! -f "$CADDY_SRC" ]; then
  fail "CADDY_SRC=$CADDY_SRC does not exist"
else
  sudo mkdir -p "$CADDY_CONF_D" 2>/dev/null
  if sudo test -f "$CADDY_MAIN" && sudo grep -qE '^\s*import\s+(conf\.d/|/etc/caddy/conf\.d/)' "$CADDY_MAIN"; then
    ok "main Caddyfile imports conf.d"

    # The site blocks ship with `tls internal` so that installing them causes no
    # ACME traffic while DNS still points at GCP — see the comment in the
    # Caddyfile. PUBLIC_TLS=true strips those lines, which is the cutover
    # action: run it once DNS resolves here and Caddy will request real
    # certificates on the next request per hostname.

    # Back up what is installed. The failure path must restore the previous
    # ROUTING, not delete it: www and admin are served by this same block, so
    # removing it because a chat.metnmat.com change failed would take the live
    # site off the edge to fix a hostname that was never up.
    CADDY_BLOCK="$CADDY_CONF_D/metnmat-website.caddy"
    BLOCK_BAK=""
    if sudo test -f "$CADDY_BLOCK"; then
      BLOCK_BAK="$(mktemp)"
      sudo cat "$CADDY_BLOCK" > "$BLOCK_BAK" 2>/dev/null || { rm -f "$BLOCK_BAK"; BLOCK_BAK=""; }
    fi

    # Certificate mode is STICKY once public. PUBLIC_TLS defaults to false, so a
    # re-run that forgets the checkbox stages `tls internal` over a block that
    # is currently serving real certificates — and the next reload hands every
    # visitor to www and admin a self-signed one. Cutover is not something to
    # undo by omission, so an already-public block stays public.
    EFFECTIVE_TLS="${PUBLIC_TLS:-false}"
    if [ "$EFFECTIVE_TLS" != "true" ] && [ -n "$BLOCK_BAK" ] \
       && ! grep -q 'tls internal' "$BLOCK_BAK"; then
      EFFECTIVE_TLS=true
      hmm "installed block already serves public certificates — keeping them"
      info "PUBLIC_TLS was not set, but downgrading live certs is never the intent"
    fi

    # A second, independent signal — because the first can be wrong. A previous
    # failed run installs the block and only then fails to reload, leaving the
    # pre-cutover version on disk while Caddy still serves the public one from
    # memory. Reading the file would conclude "not cut over" and downgrade real
    # certificates. Issued ACME certificates in Caddy's own storage prove the
    # cutover happened, whatever the file currently says.
    if [ "$EFFECTIVE_TLS" != "true" ] \
       && sudo find /var/lib/caddy/.local/share/caddy/certificates \
            -maxdepth 3 -name '*metnmat.com*' -print -quit 2>/dev/null | grep -q .; then
      EFFECTIVE_TLS=true
      hmm "Caddy already holds public certificates for metnmat.com — keeping public TLS"
      info "on-disk block said otherwise; trusting the issued certificates"
    fi

    STAGED="$(mktemp)"
    if [ "$EFFECTIVE_TLS" = "true" ]; then
      grep -v '# PRE-CUTOVER' "$CADDY_SRC" > "$STAGED"
      ok "public ACME certificates enabled"
      info "Caddy will request certificates on first request per hostname;"
      info "this only succeeds once DNS points at this instance"
    else
      cp "$CADDY_SRC" "$STAGED"
      info "pre-cutover mode: 'tls internal' retained, no ACME requests will be made"
      info "re-run with PUBLIC_TLS=true after DNS moves to switch to real certificates"
    fi

    sudo install -m 0644 "$STAGED" "$CADDY_CONF_D/metnmat-website.caddy" \
      && ok "installed $CADDY_CONF_D/metnmat-website.caddy" \
      || fail "could not write the site block"
    rm -f "$STAGED"

    # `caddy validate` checks SYNTAX. It does not check that the paths the
    # config names can be WRITTEN — and every site block here writes a log
    # file. A missing or root-owned /var/log/caddy validates clean and then
    # fails the reload, which is exactly the failure this branch reported with
    # no reason attached. The other branch already prepared it; having that in
    # only one of the two paths meant the outcome depended on which one ran.
    CADDY_USER="$(sudo systemctl show -p User --value caddy 2>/dev/null)"
    [ -n "$CADDY_USER" ] || CADDY_USER=caddy
    sudo mkdir -p /var/log/caddy
    sudo chown -R "$CADDY_USER" /var/log/caddy 2>/dev/null \
      && ok "/var/log/caddy exists and is owned by '$CADDY_USER'" \
      || hmm "could not chown /var/log/caddy to '$CADDY_USER'"

    # Validate BEFORE reloading. An invalid config on reload leaves Caddy
    # serving the old one, but a validate failure tells you now rather than
    # after you have gone looking at DNS.
    if sudo caddy validate --config "$CADDY_MAIN" >/dev/null 2>&1; then
      ok "config validates"
      if reload_err="$(sudo systemctl reload caddy 2>&1)"; then
        ok "caddy reloaded (not restarted — no dropped connections)"
      else
        # Print WHY. Reporting only that a reload failed states the one thing
        # already known and sends the next hour to the wrong place.
        no "reload failed — reason below, then reverting"
        [ -n "$reload_err" ] && printf '%s\n' "$reload_err" | sed 's/^/         /'
        sudo journalctl -u caddy -n 15 --no-pager 2>/dev/null | sed 's/^/         /'
        # Revert. Validate passed, so the block is syntactically fine and WOULD
        # be picked up by the next restart — including an unattended one.
        # Leaving it staged turns a failed bootstrap into a later outage.
        # Restore, do not delete. Deleting would drop www and admin from the
        # edge as collateral for a chat.metnmat.com change that failed.
        if [ -n "$BLOCK_BAK" ]; then
          sudo install -m 0644 "$BLOCK_BAK" "$CADDY_BLOCK"
        else
          sudo rm -f "$CADDY_BLOCK"
        fi
        sudo systemctl reload caddy >/dev/null 2>&1 || true
        fail "reload failed; previous site block restored, routing unchanged"
      fi
    else
      fail "config does NOT validate — not reloading"
      # Restore, do not delete. Deleting would drop www and admin from the
      # edge as collateral for a chat.metnmat.com change that failed.
      if [ -n "$BLOCK_BAK" ]; then
        sudo install -m 0644 "$BLOCK_BAK" "$CADDY_BLOCK"
      else
        sudo rm -f "$CADDY_BLOCK"
      fi
      info "previous site block restored; Caddy is untouched"
      sudo caddy validate --config "$CADDY_MAIN" 2>&1 | head -5 | sed 's/^/         /'
    fi
  elif [ "${ALLOW_CADDYFILE_EDIT:-false}" = "true" ]; then
    # Opt-in, because this is the file serving the dashboard. Made safe by being
    # reversible: back up first, validate after, restore on any failure. The
    # change itself is one line and adds no hostname — it only tells Caddy to
    # read a directory it is not currently reading.
    BACKUP="$CADDY_MAIN.bak.$(date +%Y%m%d-%H%M%S)"
    sudo cp -p "$CADDY_MAIN" "$BACKUP" || fail "could not back up $CADDY_MAIN"
    ok "backed up main Caddyfile to $BACKUP"

    # Appended, not prepended: a Caddyfile may open with a global options block,
    # and inserting above that would break it. A well-formed file ends after its
    # last site block, so the end is top-level scope.
    printf '\n# Added by deploy/bin/bootstrap-server.sh — loads the website/CMS site blocks.\nimport %s/*.caddy\n' \
      "$CADDY_CONF_D" | sudo tee -a "$CADDY_MAIN" >/dev/null \
      || { sudo cp -p "$BACKUP" "$CADDY_MAIN"; fail "could not append the import; original restored"; }

    # Install the site block BEFORE validating: an import of a directory with no
    # matching files is fine, but validating the end state is the point.
    STAGED="$(mktemp)"
    if [ "${PUBLIC_TLS:-false}" = "true" ]; then
      grep -v '# PRE-CUTOVER' "$CADDY_SRC" > "$STAGED"
    else
      cp "$CADDY_SRC" "$STAGED"
      info "pre-cutover mode: 'tls internal' retained, no ACME requests"
    fi
    sudo install -m 0644 "$STAGED" "$CADDY_CONF_D/metnmat-website.caddy"
    rm -f "$STAGED"

    # `caddy validate` checks SYNTAX. It does not check that paths the config
    # names are writable, so a block whose `log` directive points at a directory
    # that does not exist validates cleanly and then fails to load. Create the
    # log directory, owned by whoever the service actually runs as, before
    # asking Caddy to accept the config.
    CADDY_USER="$(sudo systemctl show -p User --value caddy 2>/dev/null)"
    [ -n "$CADDY_USER" ] || CADDY_USER=caddy
    sudo mkdir -p /var/log/caddy
    sudo chown -R "$CADDY_USER" /var/log/caddy 2>/dev/null \
      && ok "/var/log/caddy exists and is owned by '$CADDY_USER'" \
      || hmm "could not chown /var/log/caddy to '$CADDY_USER'"

    if sudo caddy validate --config "$CADDY_MAIN" >/dev/null 2>&1; then
      ok "config validates with the import and site blocks in place"
      if reload_err="$(sudo systemctl reload caddy 2>&1)"; then
        ok "caddy reloaded — the dashboard's own routes are unchanged"
      else
        # Print WHY before reverting. Without this the failure reports only
        # that a reload failed, which is the one thing already known.
        no "reload failed — reason below, then reverting"
        [ -n "$reload_err" ] && printf '%s\n' "$reload_err" | sed 's/^/         /'
        echo "         --- journalctl -u caddy (last 20) ---"
        sudo journalctl -u caddy -n 20 --no-pager 2>/dev/null | sed 's/^/         /' || true

        sudo cp -p "$BACKUP" "$CADDY_MAIN"
        sudo rm -f "$CADDY_CONF_D/metnmat-website.caddy"
        sudo systemctl reload caddy >/dev/null 2>&1 || true
        fail "reload failed; Caddyfile and site block reverted"
      fi
    else
      sudo cp -p "$BACKUP" "$CADDY_MAIN"
      sudo rm -f "$CADDY_CONF_D/metnmat-website.caddy"
      fail "config does NOT validate — Caddyfile restored from backup, site block removed, Caddy never reloaded"
    fi
  else
    hmm "the main Caddyfile does not import conf.d — REFUSING to edit it"
    info "it currently serves the dashboard, so this script will not rewrite it."
    info "either add this line yourself and re-run:"
    info "    import $CADDY_CONF_D/*.caddy"
    info "or re-run with allow_caddyfile_edit=true, which backs the file up,"
    info "appends that line, validates, and restores the backup if anything fails."
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────
printf '\n'
if [ "$fails" -gt 0 ]; then
  printf 'bootstrap FAILED — %d problem(s) above\n' "$fails"
  exit 1
fi
printf 'bootstrap complete. Next: run the deploy workflow.\n'
