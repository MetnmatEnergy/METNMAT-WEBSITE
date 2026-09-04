import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideDirectorPinWrite,
  directorPinForced,
} from "../apps/dashboard/src/lib/director-pin";

/**
 * The director bootstrap must not change a PIN that someone already set.
 *
 * WHAT WENT WRONG IN PRODUCTION, 2026-09-04. `ensureDirectorAccount()` runs in
 * `seed()`, which runs in `onInit` on every CMS boot — a deploy, a PM2 memory
 * restart, anything. On finding the director it issued an unconditional update
 * that included `pin`, and `Users.beforeChange` keeps the real password in
 * lockstep by deriving it from the PIN. So a PIN set in the admin UI was
 * reverted to the environment value by the next restart, and the person who set
 * it was locked out with no indication of why — the login simply said
 * "Invalid key."
 *
 * It is worse than an ordinary overwrite because the password is
 * `HMAC(pepper, "metnmat:pin:" + pin)`. There is no human-typable password to
 * fall back on, so the account is only reachable through whatever DIRECTOR_PIN
 * happens to hold.
 */

describe("decideDirectorPinWrite", () => {
  it("writes the PIN when the account has none — a fresh install must be reachable", () => {
    expect(decideDirectorPinWrite(undefined, false)).toEqual({ write: true, reason: "no-existing-pin" });
    expect(decideDirectorPinWrite(null, false).write).toBe(true);
    expect(decideDirectorPinWrite("", false).write).toBe(true);
    expect(decideDirectorPinWrite("   ", false).write).toBe(true);
  });

  it("PRESERVES a PIN that is already set — the whole point", () => {
    // This is the assertion that would have caught the lockout.
    expect(decideDirectorPinWrite("5970", false)).toEqual({ write: false, reason: "preserved" });
  });

  it("writes anyway when forced, because a forgotten PIN is otherwise unrecoverable", () => {
    expect(decideDirectorPinWrite("5970", true)).toEqual({ write: true, reason: "forced" });
  });

  it("is stable across repeated boots — running it twice changes nothing", () => {
    // "Idempotent" is what the old docstring claimed while overwriting the
    // credential every time. Here it actually holds.
    const first = decideDirectorPinWrite("5970", false);
    const second = decideDirectorPinWrite("5970", false);
    expect(first).toEqual(second);
    expect(first.write).toBe(false);
  });

  it("does not treat a non-string as a PIN", () => {
    expect(decideDirectorPinWrite(5970 as unknown as string, false).write).toBe(true);
  });
});

describe("the break-glass flag is explicit", () => {
  it("only the exact string 'true' forces a rewrite", () => {
    expect(directorPinForced({ DIRECTOR_PIN_FORCE: "true" })).toBe(true);
    for (const v of ["1", "yes", "TRUE", "", undefined, "false"]) {
      expect(directorPinForced({ DIRECTOR_PIN_FORCE: v }), `value ${String(v)}`).toBe(false);
    }
  });

  it("is off when the variable is absent", () => {
    expect(directorPinForced({})).toBe(false);
  });
});

describe("seed actually uses the decision", () => {
  const file = readFileSync(join(__dirname, "..", "apps", "dashboard", "src", "seed.ts"), "utf8");

  /**
   * Only the director bootstrap. `seed.ts` is thousands of lines and contains
   * many other payload.create/update calls — an unscoped search matches the
   * first one in the file, which is media, and the assertion becomes noise.
   */
  const start = file.indexOf("async function ensureDirectorAccount");
  const seed = start === -1 ? "" : file.slice(start, file.indexOf("\n}", start) + 2);

  it("the director UPDATE no longer includes the PIN unconditionally", () => {
    // Scoped to the update. The CREATE branch legitimately writes the PIN — a
    // brand-new account has none, and an unreachable super-admin is no use.
    const update = /await payload\.update\(\{[\s\S]*?\}\);/.exec(seed);
    expect(update, "could not locate the director update call").not.toBeNull();
    // The exact shape of the bug.
    expect(update![0]).not.toMatch(/data:\s*\{\s*name,\s*email,\s*pin,\s*roles/);
  });

  it("the create branch still writes a PIN, so a fresh install is reachable", () => {
    const create = /await payload\.create\(\{[\s\S]*?collection: "users"[\s\S]*?\}\);/.exec(seed);
    expect(create, "could not locate the director create call").not.toBeNull();
    expect(create![0]).toMatch(/pin/);
  });

  it("the PIN is spread in only when the decision says so", () => {
    expect(seed).toMatch(/\.\.\.\(decision\.write \? \{ pin \} : \{\}\)/);
  });

  it("the decision is taken from the stored PIN and the force flag", () => {
    expect(seed).toMatch(/decideDirectorPinWrite\(/);
    expect(seed).toMatch(/directorPinForced\(process\.env\)/);
  });

  it("logs which way it went, so a surprising PIN state is diagnosable", () => {
    expect(seed).toMatch(/pin \$\{decision\.reason\}/);
  });
});
