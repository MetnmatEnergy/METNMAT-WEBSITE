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

# ── 3. Port ────────────────────────────────────────────────────────────────
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

# ── 4. PM2 survives a reboot ───────────────────────────────────────────────
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

# ── 5. Caddy ───────────────────────────────────────────────────────────────
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
    STAGED="$(mktemp)"
    if [ "${PUBLIC_TLS:-false}" = "true" ]; then
      grep -v '# PRE-CUTOVER' "$CADDY_SRC" > "$STAGED"
      ok "PUBLIC_TLS=true — public ACME certificates enabled"
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

    # Validate BEFORE reloading. An invalid config on reload leaves Caddy
    # serving the old one, but a validate failure tells you now rather than
    # after you have gone looking at DNS.
    if sudo caddy validate --config "$CADDY_MAIN" >/dev/null 2>&1; then
      ok "config validates"
      sudo systemctl reload caddy && ok "caddy reloaded (not restarted — no dropped connections)" \
        || fail "reload failed — the dashboard's routes are unaffected, the old config is still live"
    else
      fail "config does NOT validate — not reloading"
      sudo rm -f "$CADDY_CONF_D/metnmat-website.caddy"
      info "site block removed again; Caddy is untouched"
      sudo caddy validate --config "$CADDY_MAIN" 2>&1 | head -5 | sed 's/^/         /'
    fi
  else
    hmm "the main Caddyfile does not import conf.d — REFUSING to edit it"
    info "it currently serves the dashboard, so this script will not rewrite it."
    info "add this one line yourself, then re-run:"
    info "    import $CADDY_CONF_D/*.caddy"
    info "the site block that would have been installed is at: $CADDY_SRC"
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────
printf '\n'
if [ "$fails" -gt 0 ]; then
  printf 'bootstrap FAILED — %d problem(s) above\n' "$fails"
  exit 1
fi
printf 'bootstrap complete. Next: run the deploy workflow.\n'
