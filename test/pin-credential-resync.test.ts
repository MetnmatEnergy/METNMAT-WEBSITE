import { describe, it, expect } from "vitest";
import { pbkdf2Sync, randomBytes, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  derivePassword,
  derivePinLookup,
  recoverPinFromLookup,
  verifyDerivedCredential,
  PAYLOAD_PBKDF2,
} from "../apps/dashboard/src/lib/pin";
import { decideDirectorCredential, decideDirectorPinWrite } from "../apps/dashboard/src/lib/director-pin";
import { planCredentialResync } from "../apps/dashboard/src/lib/credential-resync";

/**
 * A PIN that finds the account must also sign it in.
 *
 * WHAT HAPPENED IN PRODUCTION, 2026-09-19. The director typed the PIN held in
 * Secrets Manager and got "Invalid key" every time, then "Too many attempts".
 * Inspection on the host showed the account's `pinLookup` DID equal
 * derivePinLookup(DIRECTOR_PIN) under the current pepper — sign-in found the
 * account — while its password hash verified under no pepper at all. The hash
 * was minted before the September pepper rotation and nothing had re-derived
 * it: PIN edits were dead on update until hooks/pin-credential.ts, and the
 * director bootstrap deliberately stops writing an existing PIN (the 2026-09-04
 * lockout). "Preserve the PIN" had become "preserve the lockout".
 *
 * These tests pin down the repair: boot checks the stored hash against the PIN
 * the lookup encodes and re-derives it when they disagree, without changing the
 * PIN — and the check itself uses Payload's real hashing parameters.
 */

const ROOT = join(__dirname, "..");
const PAYLOAD = join(ROOT, "apps", "dashboard", "node_modules", "payload", "dist");

/** Exactly what Payload's registerLocalStrategy / generatePasswordSaltHash do. */
function payloadHash(password: string): { salt: string; hash: string } {
  const salt = randomBytes(32).toString("hex");
  const hash = pbkdf2Sync(password, salt, PAYLOAD_PBKDF2.iterations, PAYLOAD_PBKDF2.keyLength, PAYLOAD_PBKDF2.digest).toString("hex");
  return { salt, hash };
}

describe("verifyDerivedCredential mirrors Payload's local strategy", () => {
  it("uses the parameters the installed Payload authenticates with", () => {
    // Read the package, not a description of it: a Payload bump that changes
    // these would make boot mark every account stale and re-hash them all.
    const auth = readFileSync(join(PAYLOAD, "auth/strategies/local/authenticate.js"), "utf8");
    expect(auth).toContain(
      `crypto.pbkdf2(password, salt, ${PAYLOAD_PBKDF2.iterations}, ${PAYLOAD_PBKDF2.keyLength}, '${PAYLOAD_PBKDF2.digest}'`,
    );
  });

  it("accepts a hash Payload would have written for the derived password", () => {
    const { salt, hash } = payloadHash(derivePassword("5970"));
    expect(verifyDerivedCredential(derivePassword("5970"), salt, hash)).toBe(true);
  });

  it("rejects a hash minted for another PIN — the frozen-credential case", () => {
    const { salt, hash } = payloadHash(derivePassword("1111"));
    expect(verifyDerivedCredential(derivePassword("5970"), salt, hash)).toBe(false);
  });

  it("rejects a hash minted under another pepper — the rotation case", () => {
    const foreign = createHmac("sha256", "the-burned-pepper").update("metnmat:pin:5970").digest("hex");
    const { salt, hash } = payloadHash(foreign);
    expect(verifyDerivedCredential(derivePassword("5970"), salt, hash)).toBe(false);
  });

  it("treats a missing or malformed salt/hash as not verifying, never as verifying", () => {
    expect(verifyDerivedCredential(derivePassword("5970"), undefined, undefined)).toBe(false);
    expect(verifyDerivedCredential(derivePassword("5970"), "", "")).toBe(false);
    expect(verifyDerivedCredential(derivePassword("5970"), 12 as unknown as string, "ab")).toBe(false);
  });
});

describe("recoverPinFromLookup", () => {
  it.each(["0000", "0042", "5970", "9999"])("recovers %s from its own lookup", (pin) => {
    expect(recoverPinFromLookup(derivePinLookup(pin))).toBe(pin);
  });

  it("returns null for a lookup minted under a different pepper", () => {
    const foreign = createHmac("sha256", "the-burned-pepper").update("metnmat:pinlookup:5970").digest("hex");
    expect(recoverPinFromLookup(foreign)).toBeNull();
  });

  it("returns null for anything that is not a lookup", () => {
    expect(recoverPinFromLookup(undefined)).toBeNull();
    expect(recoverPinFromLookup("")).toBeNull();
    expect(recoverPinFromLookup(5970)).toBeNull();
  });
});

describe("decideDirectorCredential", () => {
  const PIN = "5970";
  const preserved = decideDirectorPinWrite(derivePinLookup(PIN), false);
  const applied = derivePinLookup(PIN); // the bootstrap last applied this same PIN

  it("keeps the 2026-09-04 rule whenever the credential actually works", () => {
    const { salt, hash } = payloadHash(derivePassword(PIN));
    expect(
      decideDirectorCredential({ base: preserved, lookup: derivePinLookup(PIN), salt, hash, pin: PIN, appliedLookup: applied }),
    ).toEqual({ write: false, reason: "preserved" });
  });

  it("re-derives when the lookup is current but the hash is not — the 2026-09-19 lockout", () => {
    const stale = payloadHash(createHmac("sha256", "the-burned-pepper").update("metnmat:pin:5970").digest("hex"));
    expect(
      decideDirectorCredential({
        base: preserved,
        lookup: derivePinLookup(PIN),
        salt: stale.salt,
        hash: stale.hash,
        pin: PIN,
        appliedLookup: applied,
      }),
    ).toEqual({ write: true, reason: "credential-stale" });
  });

  it("re-derives when no PIN produces the lookup — the pepper was rotated", () => {
    const foreignLookup = createHmac("sha256", "the-burned-pepper").update("metnmat:pinlookup:5970").digest("hex");
    const base = decideDirectorPinWrite(foreignLookup, false);
    expect(base.write).toBe(false); // the old rule alone would have left it locked out
    expect(
      decideDirectorCredential({ base, lookup: foreignLookup, salt: "s", hash: "h", pin: PIN, appliedLookup: foreignLookup }),
    ).toEqual({ write: true, reason: "pepper-changed" });
  });

  it("leaves a PIN the director chose in the UI alone when the environment is unchanged", () => {
    // Their choice stands; resyncStaffCredentials repairs the hash without
    // changing the PIN. Writing DIRECTOR_PIN here would be the 2026-09-04 bug.
    const chosen = "2468";
    const stale = payloadHash("anything-else");
    expect(
      decideDirectorCredential({
        base: preserved,
        lookup: derivePinLookup(chosen),
        salt: stale.salt,
        hash: stale.hash,
        pin: PIN,
        appliedLookup: applied, // env PIN is the one applied last time → the UI moved it
      }),
    ).toEqual({ write: false, reason: "preserved" });
  });

  it("applies a DIRECTOR_PIN the owner changed in Secrets Manager — the 2026-09-19 afternoon case", () => {
    // The account still carries the old PIN (lookup resolves), the record says
    // the bootstrap last applied that OLD value, and the env now holds a new
    // one. The env is what the owner is typing; it must win.
    const old = "1122";
    const { salt, hash } = payloadHash(derivePassword(old));
    expect(
      decideDirectorCredential({
        base: decideDirectorPinWrite(derivePinLookup(old), false),
        lookup: derivePinLookup(old),
        salt,
        hash,
        pin: PIN,
        appliedLookup: derivePinLookup(old),
      }),
    ).toEqual({ write: true, reason: "env-changed" });
  });

  it("treats a missing record as an environment change — the secret is authoritative once", () => {
    const old = "1122";
    const { salt, hash } = payloadHash(derivePassword(old));
    expect(
      decideDirectorCredential({
        base: decideDirectorPinWrite(derivePinLookup(old), false),
        lookup: derivePinLookup(old),
        salt,
        hash,
        pin: PIN,
        appliedLookup: undefined,
      }),
    ).toEqual({ write: true, reason: "env-changed" });
  });

  it("passes a write-through decision straight through (fresh install, forced)", () => {
    const fresh = decideDirectorPinWrite(undefined, false);
    expect(
      decideDirectorCredential({ base: fresh, lookup: undefined, salt: undefined, hash: undefined, pin: PIN, appliedLookup: undefined }),
    ).toEqual(fresh);
    const forced = decideDirectorPinWrite(derivePinLookup(PIN), true);
    expect(
      decideDirectorCredential({ base: forced, lookup: derivePinLookup(PIN), salt: "s", hash: "h", pin: PIN, appliedLookup: applied }),
    ).toEqual(forced);
  });
});

describe("planCredentialResync", () => {
  const good = payloadHash(derivePassword("1234"));
  const stale = payloadHash(derivePassword("9999")); // hash for a PIN this account no longer has
  const foreignLookup = createHmac("sha256", "the-burned-pepper").update("metnmat:pinlookup:4321").digest("hex");

  const plan = planCredentialResync([
    { id: "a", name: "Director", pinLookup: derivePinLookup("1234"), salt: good.salt, hash: good.hash },
    { id: "b", name: "Sales", pinLookup: derivePinLookup("1234"), salt: stale.salt, hash: stale.hash },
    { id: "c", name: "Old staff", pinLookup: foreignLookup, salt: stale.salt, hash: stale.hash },
    { id: "d", email: "recovery@metnmat.com" },
  ]);

  it("leaves a verifying account alone", () => {
    expect(plan[0]).toEqual({ id: "a", label: "Director", kind: "ok" });
  });

  it("re-derives an account whose hash no longer accepts its PIN, keeping the PIN", () => {
    expect(plan[1]).toEqual({ id: "b", label: "Sales", kind: "resync", pin: "1234" });
  });

  it("reports, and does not guess at, an account whose lookup predates the pepper", () => {
    expect(plan[2]).toEqual({ id: "c", label: "Old staff", kind: "unreachable" });
  });

  it("skips recovery-only accounts that have no PIN", () => {
    expect(plan[3]).toEqual({ id: "d", label: "recovery@metnmat.com", kind: "no-pin" });
  });

  it("carries the PIN only on the action that needs it", () => {
    for (const a of plan) if (a.kind !== "resync") expect(a).not.toHaveProperty("pin");
  });
});

describe("seed wires the repair in", () => {
  const seed = readFileSync(join(ROOT, "apps", "dashboard", "src", "seed.ts"), "utf8");
  const start = seed.indexOf("async function ensureDirectorAccount");
  const director = seed.slice(start, seed.indexOf("\n}", start) + 2);
  const critical = seed.slice(seed.indexOf("export async function seedCritical"), seed.indexOf("async function resyncStaffCredentials"));

  it("the director bootstrap reads the hidden salt/hash and decides on the credential, not just the PIN", () => {
    expect(director).toMatch(/showHiddenFields: true/);
    expect(director).toMatch(/decideDirectorCredential\(\{/);
    expect(director).toMatch(/salt: docs\[0\]\.salt/);
  });

  it("a repaired director is unlocked, so the failures the stale hash caused do not keep them out", () => {
    expect(director).toMatch(/if \(decision\.write\) \{[\s\S]*?payload\.unlock\(\{ collection: "users"/);
  });

  it("the decision sees which DIRECTOR_PIN was last applied, and the record follows every application", () => {
    expect(director).toMatch(/appliedLookup: await readAppliedDirectorLookup\(payload\)/);
    // After the update branch (written or already carried) and after create.
    expect((director.match(/writeAppliedDirectorLookup\(payload, derivePinLookup\(pin\)\)/g) ?? []).length).toBe(2);
    expect(director).toMatch(/if \(decision\.write \|\| docs\[0\]\.pinLookup === derivePinLookup\(pin\)\)/);
  });

  it("resyncStaffCredentials runs on the critical path, after the director", () => {
    const dir = critical.indexOf("await ensureDirectorAccount(payload);");
    const resync = critical.indexOf("await resyncStaffCredentials(payload);");
    expect(dir).toBeGreaterThan(-1);
    expect(resync).toBeGreaterThan(dir);
  });

  it("the resync never logs the recovered PIN", () => {
    const body = seed.slice(seed.indexOf("async function resyncStaffCredentials"));
    const fn = body.slice(0, body.indexOf("\n}") + 2);
    expect(fn).not.toMatch(/logger\.[a-z]+\([^)]*action\.pin/);
    expect(fn).toMatch(/data: \{ pin: action\.pin \}/);
  });
});
