import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * deploy/v2/bin/bootstrap-host.sh runs as root over SSM and restarts Caddy,
 * which fronts every hostname on the instance. One ordering mistake there is a
 * full outage, so the ordering is pinned here.
 */
const script = fs.readFileSync(path.join(__dirname, "../deploy/v2/bin/bootstrap-host.sh"), "utf8");
const lineOf = (re: RegExp) => script.split("\n").findIndex((l) => re.test(l) && !l.trim().startsWith("#"));

describe("bootstrap-host.sh — Caddy", () => {
  it("hands /var/log/caddy to the caddy user AFTER `caddy validate`, before Caddy (re)starts", () => {
    // Validate runs as root and creates any missing site log file as root:root
    // 0600. On 2026-10-27 the new metnmat.in block's legacy-in.log was created
    // that way, Caddy could not open it, and every site refused connections
    // until a second run chowned it.
    const validate = lineOf(/caddy validate/);
    const chown = lineOf(/chown -R caddy:caddy \/var\/log\/caddy/);
    const start = lineOf(/systemctl (enable --now|reload|restart) caddy/);
    expect(validate).toBeGreaterThan(-1);
    expect(chown).toBeGreaterThan(validate);
    expect(start).toBeGreaterThan(chown);
  });
});
