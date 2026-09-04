import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { derivePassword, derivePinLookup, PIN_REGEX } from "../apps/dashboard/src/lib/pin";

/**
 * The staff PIN must not be stored in cleartext.
 *
 * WHAT IT WAS. `Users.pin` was `type: "text", index: true`, so MongoDB held the
 * four digits in the clear, indexed, in the same document as the password hash.
 * Field-level access controlled who could read it through Payload's API and did
 * nothing whatever about someone able to read the collection — a backup, an
 * aggregation, a leaked connection string. Anyone in that position had every
 * staff credential outright: no pepper needed, no hash to break, no 10,000
 * candidates to enumerate.
 *
 * WHAT IT IS NOW. `pin` is virtual and write-only; what persists is `pinLookup`,
 * an HMAC of the PIN under a label distinct from the password derivation. Login
 * derives the same value from the submitted PIN and matches on equality, so the
 * lookup stays indexed and the login path keeps its shape.
 */

const CMS = join(__dirname, "..", "apps", "dashboard", "src");
const read = (p: string) => readFileSync(join(CMS, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("the stored lookup is not the password", () => {
  it("derives a DIFFERENT value from the same PIN", () => {
    // The whole point. If these matched, the database would hold the account's
    // actual pre-hash password in cleartext — strictly worse than the four
    // digits it replaced.
    for (const pin of ["0000", "5970", "1234", "9999"]) {
      expect(derivePinLookup(pin)).not.toBe(derivePassword(pin));
    }
  });

  it("is deterministic, so equality lookup works", () => {
    expect(derivePinLookup("5970")).toBe(derivePinLookup("5970"));
  });

  it("separates different PINs", () => {
    expect(derivePinLookup("5970")).not.toBe(derivePinLookup("5971"));
  });

  it("returns a fixed-width hex digest that reveals no digits", () => {
    const out = derivePinLookup("5970");
    expect(out).toMatch(/^[0-9a-f]{64}$/);
    expect(out).not.toContain("5970");
  });

  it("every 4-digit PIN maps to a distinct lookup — no collisions to log in through", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      const pin = String(i).padStart(4, "0");
      expect(PIN_REGEX.test(pin)).toBe(true);
      seen.add(derivePinLookup(pin));
    }
    expect(seen.size).toBe(10000);
  });
});

describe("nothing writes the PIN to the database", () => {
  const users = stripComments(read("collections/Users.ts"));

  it("the pin field is virtual, so Payload never persists it", () => {
    const field = /name: "pin",[\s\S]*?access: \{[^}]*\}/.exec(users);
    expect(field, "pin field not found").not.toBeNull();
    expect(field![0]).toMatch(/virtual: true/);
  });

  it("the pin field can never be read back", () => {
    const field = /name: "pin",[\s\S]*?access: \{[^}]*\}/.exec(users);
    expect(field![0]).toMatch(/read: \(\) => false/);
  });

  it("beforeChange deletes the PIN after deriving from it", () => {
    expect(users).toMatch(/data\.pinLookup = derivePinLookup\(pin\);/);
    expect(users).toMatch(/delete data\.pin;/);
  });

  it("the stored lookup is not readable through the API either", () => {
    const field = /name: "pinLookup",[\s\S]*?access: \{[^}]*\}/.exec(users);
    expect(field, "pinLookup field not found").not.toBeNull();
    expect(field![0]).toMatch(/read: \(\) => false/);
    expect(field![0]).toMatch(/index: true/);
  });

  it("uniqueness is enforced on the derived value, not the PIN", () => {
    expect(users).toMatch(/pinLookup: \{ equals: derivePinLookup\(pin\) \}/);
    expect(users).not.toMatch(/\{ pin: \{ equals: pin \} \}/);
  });
});

describe("sign-in finds the account without the PIN being stored", () => {
  const route = stripComments(read("app/pin-login/route.ts"));

  it("looks up by the derived value", () => {
    expect(route).toMatch(/pinLookup: \{ equals: derivePinLookup\(pin\) \}/);
    expect(route).not.toMatch(/where: \{ pin: \{ equals: pin \} \}/);
  });

  it("still authenticates through Payload's own login", () => {
    // The password derivation is unchanged; only the lookup moved.
    expect(route).toMatch(/password: derivePassword\(pin\)/);
  });
});

describe("the migration is safe to run on live accounts", () => {
  const seed = stripComments(read("seed.ts"));
  const fn = /async function migratePinsOutOfCleartext[\s\S]*?\n\}/.exec(seed);

  it("exists and runs before the director bootstrap", () => {
    expect(fn, "migration not found").not.toBeNull();
    const migrate = seed.indexOf("await migratePinsOutOfCleartext(payload)");
    const director = seed.indexOf("await ensureDirectorAccount(payload)");
    expect(migrate).toBeGreaterThan(-1);
    expect(migrate).toBeLessThan(director);
  });

  it("writes the lookup only where one is missing — idempotent", () => {
    expect(fn![0]).toMatch(/pinLookup: \{ \$exists: false \}/);
  });

  it("PURGES only behind an explicit flag", () => {
    // Clearing cleartext in the same pass would mean a failure halfway could
    // destroy a PIN whose lookup was never written — and nothing can reproduce
    // it, so that account would be unreachable forever.
    expect(fn![0]).toMatch(/process\.env\.PIN_CLEARTEXT_PURGE === "true"/);
  });

  it("never purges a document that has no lookup yet", () => {
    const purge = /PIN_CLEARTEXT_PURGE === "true"\)[\s\S]{0,500}/.exec(fn![0]);
    expect(purge, "purge block not found").not.toBeNull();
    expect(purge![0]).toMatch(/pinLookup: \{ \$exists: true/);
    expect(purge![0]).toMatch(/\$unset: \{ pin: "" \}/);
  });

  it("does not fail boot if it errors", () => {
    // A CMS that will not start is worse than one still holding cleartext.
    expect(fn![0]).toMatch(/catch/);
    expect(fn![0]).toMatch(/continuing boot/);
  });
});
