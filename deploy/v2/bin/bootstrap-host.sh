#!/usr/bin/env bash
# bootstrap-host.sh — one-time preparation of a FRESH Amazon Linux 2023 host.
# Run as root over SSM (AWS-RunShellScript). Idempotent: re-running applies config
# changes and repairs drift; it never touches release directories.
#
# What it produces: four isolated system users, hardened systemd units, the
# root-only secret fetcher, nftables IMDS/C2 rules, Caddy, Node 22, Bun,
# persistent journald, a 2G swapfile, automatic security updates, and no SSH.
#
# Nothing is copied from any previous host. Every file comes from the repo
# checkout that ships this script (deploy/v2/) or from the distribution.
set -Eeuo pipefail
[ "$(id -u)" = "0" ] || { echo "run as root"; exit 77; }
SRC="${1:-$(cd "$(dirname "$0")/.." && pwd)}"   # path to deploy/v2
[ -f "$SRC/bin/metnmat-fetch-secrets" ] || { echo "deploy/v2 not found at $SRC"; exit 64; }

ok()  { printf '  [ok]   %s\n' "$*"; }
sec() { printf '\n== %s ==\n' "$*"; }

sec "Packages"
dnf -y -q upgrade --security || true
dnf -y -q install nodejs22 nodejs22-npm nftables dnf-plugins-core dnf-automatic python3 tar gzip unzip curl-minimal || dnf -y -q install nodejs22 nodejs22-npm nftables dnf-plugins-core dnf-automatic python3 tar gzip unzip
# AL2023 ships node 22 as node-22 behind alternatives; make it plain `node`.
if [ -x /usr/bin/node-22 ] && ! /usr/bin/node -v 2>/dev/null | grep -q '^v22'; then
  alternatives --install /usr/bin/node node /usr/bin/node-22 22 || true
  alternatives --set node /usr/bin/node-22 || true
fi
/usr/bin/node -v | grep -q '^v22' && ok "node $(/usr/bin/node -v)" || { echo "node 22 not active"; exit 1; }

if ! command -v caddy >/dev/null 2>&1; then
  dnf -y -q copr enable @caddy/caddy epel-9-x86_64 && dnf -y -q install caddy || {
    echo "caddy copr install failed"; exit 1; }
fi
ok "caddy $(caddy version | cut -d' ' -f1)"

if ! command -v bun >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  # -O keeps the remote filename (bun-linux-x64.zip) so the name matches the
  # entry inside SHASUMS256.txt that `sha256sum -c` reads.
  ( cd "$tmp"
    curl -fsSL -O https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip
    curl -fsSL -O https://github.com/oven-sh/bun/releases/latest/download/SHASUMS256.txt
    grep 'bun-linux-x64.zip' SHASUMS256.txt | sha256sum -c -
    unzip -q -o bun-linux-x64.zip
    install -m 0755 bun-linux-x64/bun /usr/local/bin/bun
  ) || { echo "bun install/verify failed"; rm -rf "$tmp"; exit 1; }
  rm -rf "$tmp"
fi
ok "bun $(bun --version)"

sec "Users and directories"
for a in web cms chat cc; do
  id "mm-$a" >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin --home-dir "/srv/metnmat/$a" "mm-$a"
  install -d -o root -g "mm-$a" -m 0750 "/srv/metnmat/$a" "/srv/metnmat/$a/releases"
done
install -d -o root -g root -m 0755 /srv/metnmat /etc/metnmat
install -d -o root -g root -m 0700 /run/metnmat
install -m 0644 "$SRC/README.md" /srv/metnmat/README-v2.md
ok "mm-web mm-cms mm-chat mm-cc (nologin, no home, no sudo)"

sec "Secret fetcher, release tool, static config"
install -m 0755 -o root -g root "$SRC/bin/metnmat-fetch-secrets" /usr/local/sbin/metnmat-fetch-secrets
install -m 0755 -o root -g root "$SRC/bin/release.sh"            /usr/local/sbin/metnmat-release
for a in web cms chat cc; do
  install -m 0644 -o root -g root "$SRC/etc/$a.conf"     "/etc/metnmat/$a.conf"
  install -m 0644 -o root -g root "$SRC/etc/$a.required" "/etc/metnmat/$a.required"
done
ok "/usr/local/sbin/metnmat-fetch-secrets, /usr/local/sbin/metnmat-release, /etc/metnmat/*"

sec "nftables: IMDS root-only + C2 block"
install -d -m 0755 /etc/nftables
install -m 0600 "$SRC/nftables/metnmat.nft" /etc/nftables/metnmat.nft
grep -q 'include "/etc/nftables/metnmat.nft"' /etc/sysconfig/nftables.conf 2>/dev/null \
  || echo 'include "/etc/nftables/metnmat.nft"' >> /etc/sysconfig/nftables.conf
nft -c -f /etc/sysconfig/nftables.conf
systemctl enable --now nftables.service
systemctl restart nftables.service
nft list table inet metnmat >/dev/null && ok "nftables table 'metnmat' loaded"

sec "systemd units"
for a in web cms chat cc; do install -m 0644 "$SRC/systemd/metnmat-$a.service" "/etc/systemd/system/metnmat-$a.service"; done
systemctl daemon-reload
for a in web cms chat cc; do systemctl enable "metnmat-$a.service" >/dev/null 2>&1; done
ok "metnmat-{web,cms,chat,cc}.service installed and enabled (start on first release)"

sec "Caddy"
# 0755 (not 0750): the copr caddy.service failed to open its log files under a
# 0750 dir; the individual .log files are still 0600, so nothing sensitive leaks.
install -d -o caddy -g caddy -m 0755 /var/log/caddy
chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
install -m 0644 "$SRC/caddy/Caddyfile" /etc/caddy/Caddyfile
rm -rf /etc/caddy/conf.d
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy
ok "Caddyfile installed (5 hostnames → loopback)"

sec "journald persistent, swap, sysctl, auto-updates, no SSH"
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nStorage=persistent\nSystemMaxUse=2G\nMaxRetentionSec=90day\n' > /etc/systemd/journald.conf.d/metnmat.conf
systemctl restart systemd-journald
if ! swapon --show | grep -q '^/swapfile'; then
  if [ ! -e /swapfile ]; then fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null; fi
  swapon /swapfile; grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
printf 'vm.swappiness=10\nnet.ipv4.tcp_syncookies=1\nkernel.kptr_restrict=2\nkernel.dmesg_restrict=1\n' > /etc/sysctl.d/99-metnmat.conf
sysctl -q --system
sed -i 's/^apply_updates = .*/apply_updates = yes/; s/^upgrade_type = .*/upgrade_type = security/' /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic-install.timer
systemctl disable --now sshd 2>/dev/null || true
ok "journald persistent · 2G swap · security auto-updates · sshd disabled (use SSM Session Manager)"

sec "Verification"
echo "  node: $(node -v)   bun: $(bun --version)   caddy: $(caddy version | cut -d' ' -f1)"
echo "  IMDS as root:   HTTP $(curl -s -m 3 -o /dev/null -w '%{http_code}' -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 30' || echo blocked)  (expect 200)"
echo "  IMDS as mm-web: HTTP $(runuser -u mm-web -- curl -s -m 3 -o /dev/null -w '%{http_code}' -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 30' || echo 000)  (expect 000 = blocked)"
echo "  units: $(systemctl list-unit-files 'metnmat-*' --no-legend | awk '{print $1":"$2}' | tr '\n' ' ')"
echo "  listeners:"; ss -ltnp | awk 'NR>1{print "    "$4" "$6}'
echo
echo "Bootstrap complete. Next: metnmat-release <app> <sha> for each app."
