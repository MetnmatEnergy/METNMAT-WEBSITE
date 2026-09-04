import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { derivePassword, derivePinLookup } from "../apps/dashboard/src/lib/pin";
import { pinPasswordInjection, syncPinPassword } from "../apps/dashboard/src/hooks/pin-credential";

/**
 * Changing a PIN must change the login credential.
 *
 * WHAT WAS BROKEN. Staff sign in with a 4-digit PIN whose HMAC is the account's
 * real Payload password. `Users.beforeChange` derived that password — which
 * works on create and is dead code on update, because Payload snapshots
 * `data.password` at the top of updateDocument() and decides there whether to
 * hash it, 99 lines before collection beforeChange hooks run.
 *
 * So every PIN in this CMS was frozen at the value its account was CREATED with.
 * The admin UI reported a successful save, the stored lookup moved, and the
 * credential did not: the new PIN could not sign in and the old one still could,
 * with no error anywhere because nothing had failed.
 *
 * The fix moves the derivation to `beforeOperation`, which runs before the
 * snapshot. The last block below asserts that ordering against the INSTALLED
 * Payload rather than against a description of it, so a version bump that
 * changes the ordering fails here instead of silently freezing PINs again.
 */

const ROOT = join(__dirname, "..");
const CMS = join(ROOT, "apps", "dashboard", "src");
const PAYLOAD = join(ROOT, "apps", "dashboard", "node_modules", "payload", "dist");
const read = (p: string) => readFileSync(join(CMS, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// The hook takes Payload's operation args; these tests only exercise `data`.
const call = (operation: string, data: unknown) =>
  (syncPinPassword as unknown as (a: {
    args: unknown;
    operation: string;
  }) => unknown)({ args: { data, collection: {}, req: {} }, operation });

describe("the injected password is the one sign-in derives", () => {
  it("matches derivePassword for the submitted PIN", () => {
    expect(pinPasswordInjection({ pin: "5970" })).toEqual({ password: derivePassword("5970") });
  });

  it("is NOT the stored lookup", () => {
    // If someone ever collapses the two derivations, the database would hold the
    // account's actual pre-hash password in the clear. Same guard as
    // pin-storage.test.ts, restated here because this is the other end of it.
    const out = pinPasswordInjection({ pin: "5970" })!;
    expect(out.password).not.toBe(derivePinLookup("5970"));
  });

  it("never contains the PIN itself", () => {
    const out = pinPasswordInjection({ pin: "5970" })!;
    expect(out.password).toMatch(/^[0-9a-f]{64}$/);
    expect(out.password).not.toContain("5970");
  });
});

describe("it injects only when a real PIN is being set", () => {
  it.each([
    ["no pin key", {}],
    ["undefined", { pin: undefined }],
    ["null", { pin: null }],
    ["empty string", { pin: "" }],
  ])("returns null for %s — an unrelated edit must not touch the credential", (_l, data) => {
    expect(pinPasswordInjection(data)).toBeNull();
  });

  it.each(["abc", "123", "12345", "12 4", "1.23", "٥٩٧٠"])(
    "returns null for the malformed PIN %j rather than deriving from it",
    (pin) => {
      // beforeValidate rejects these with a message aimed at the person typing.
      // Deriving here would set a credential nobody could reproduce — worse than
      // doing nothing.
      expect(pinPasswordInjection({ pin })).toBeNull();
    },
  );

  it("returns null for a non-object payload", () => {
    expect(pinPasswordInjection(null)).toBeNull();
    expect(pinPasswordInjection("5970")).toBeNull();
  });
});

describe("the hook returns args Payload will actually use", () => {
  it("adds the password on update", () => {
    const out = call("update", { pin: "5970", name: "Director" }) as { data: Record<string, unknown> };
    expect(out.data.password).toBe(derivePassword("5970"));
  });

  it("keeps every other field on the payload", () => {
    const out = call("update", { pin: "5970", name: "Director", roles: ["super-admin"] }) as {
      data: Record<string, unknown>;
    };
    expect(out.data.name).toBe("Director");
    expect(out.data.roles).toEqual(["super-admin"]);
    expect(out.data.pin).toBe("5970"); // beforeChange still strips it before the write
  });

  it("leaves an update with no PIN completely alone", () => {
    const args = { data: { name: "Director" }, collection: {}, req: {} };
    const out = (syncPinPassword as unknown as (a: { args: unknown; operation: string }) => unknown)({
      args,
      operation: "update",
    });
    expect(out).toBe(args);
  });

  it("does not touch creates — create.js reads the password after its own hooks", () => {
    const out = call("create", { pin: "5970" }) as { data: Record<string, unknown> };
    expect(out.data.password).toBeUndefined();
  });

  it("does not mutate the caller's object", () => {
    const data = { pin: "5970" };
    call("update", data);
    expect(data).not.toHaveProperty("password");
  });
});

describe("the hook is wired where it has to be", () => {
  const users = stripComments(read("collections/Users.ts"));

  it("Users registers it as beforeOperation", () => {
    expect(users).toMatch(/beforeOperation: \[syncPinPassword\]/);
  });

  it("imports it from the module that documents why", () => {
    expect(users).toMatch(/import \{ syncPinPassword \} from "\.\.\/hooks\/pin-credential"/);
  });

  it("beforeChange still derives the password, which is what makes CREATE work", () => {
    expect(users).toMatch(/data\.password = derivePassword\(pin\);/);
  });
});

describe("the Payload behaviour this works around still holds", () => {
  // Read the installed package, not a description of it. If a Payload upgrade
  // moves the snapshot after the hooks, these fail and the workaround can go.
  const updateDoc = readFileSync(join(PAYLOAD, "collections/operations/utilities/update.js"), "utf8");
  const updateByID = readFileSync(join(PAYLOAD, "collections/operations/updateByID.js"), "utf8");
  const build = readFileSync(join(PAYLOAD, "collections/operations/utilities/buildBeforeOperation.js"), "utf8");

  it("updateDocument snapshots the password BEFORE running beforeChange", () => {
    const snapshot = updateDoc.indexOf("const password = data?.password");
    const decide = updateDoc.indexOf("const shouldSavePassword");
    const hooks = updateDoc.indexOf("hooks?.beforeChange");
    expect(snapshot).toBeGreaterThan(-1);
    expect(decide).toBeGreaterThan(snapshot);
    expect(hooks).toBeGreaterThan(decide); // ← the whole reason for this file
  });

  it("and hashes that snapshot, not whatever beforeChange left behind", () => {
    expect(updateDoc).toMatch(/if \(shouldSavePassword && typeof password === 'string'\)/);
  });

  it("but strips it again, so the hook persists nothing new", () => {
    expect(updateDoc).toMatch(/delete dataToUpdate\.password;/);
    expect(updateDoc).toMatch(/delete data\.password;/);
  });

  it("updateByID reads `data` AFTER beforeOperation, so the injection lands", () => {
    const before = updateByID.indexOf("buildBeforeOperation");
    const readsData = updateByID.indexOf("const { data } = args");
    expect(before).toBeGreaterThan(-1);
    expect(readsData).toBeGreaterThan(before);
  });

  it("a beforeOperation return value replaces the args", () => {
    expect(build).toMatch(/newArgs = hookResult/);
  });
});
