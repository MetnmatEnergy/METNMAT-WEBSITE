import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * DPDP Act, 2023 consent gate.
 *
 * These assertions encode legal requirements, not preferences, so a future
 * refactor that "simplifies" any of them should fail here loudly:
 *  - s.6(1) consent must be a clear affirmative action -> undecided is NOT yes
 *  - s.6(4) withdrawal as easy as giving -> withdrawing erases the identifiers
 *  - a raised CONSENT_VERSION re-asks, which is what a changed purpose requires
 */

// jsdom-free localStorage stub: these helpers only ever touch getItem/setItem/
// removeItem, and testing them against a real DOM would add nothing.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
    CustomEvent: class {},
  });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

async function load() {
  // Re-import per test so no module-level cache leaks between cases.
  vi.resetModules();
  return import("../apps/website/src/frontend/lib/consent");
}

describe("consent is opt-in, never assumed", () => {
  it("reads as undecided when nothing is stored", async () => {
    const { readConsent, hasAnalyticsConsent } = await load();
    expect(readConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("treats corrupt storage as undecided rather than as consent", async () => {
    store.set("mm-consent", "{not json");
    const { readConsent, hasAnalyticsConsent } = await load();
    expect(readConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("ignores a record whose analytics flag is not a boolean", async () => {
    store.set("mm-consent", JSON.stringify({ v: 1, analytics: "true", at: "x" }));
    const { hasAnalyticsConsent } = await load();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("re-asks when the consent version has moved on", async () => {
    const { CONSENT_VERSION } = await load();
    store.set(
      "mm-consent",
      JSON.stringify({ v: CONSENT_VERSION - 1, analytics: true, at: "2020-01-01" }),
    );
    const { readConsent, hasAnalyticsConsent } = await load();
    expect(readConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("only reports consent on an explicit yes at the current version", async () => {
    const { saveConsent, hasAnalyticsConsent } = await load();
    saveConsent(true);
    expect(hasAnalyticsConsent()).toBe(true);
  });
});

describe("withdrawal erases the identity, not just future collection", () => {
  it("removes visitor, session and last-active keys", async () => {
    store.set("mm-vid", "visitor-abc");
    store.set("mm-sid", "session-abc");
    store.set("mm-slast", String(Date.now()));

    const { saveConsent } = await load();
    saveConsent(false);

    expect(store.get("mm-vid")).toBeUndefined();
    expect(store.get("mm-sid")).toBeUndefined();
    expect(store.get("mm-slast")).toBeUndefined();
  });

  it("records the refusal so the banner does not nag on every page", async () => {
    const { saveConsent, readConsent } = await load();
    saveConsent(false);
    const rec = readConsent();
    expect(rec).not.toBeNull();
    expect(rec!.analytics).toBe(false);
    // The timestamp is the DPDP audit trail for when the decision was made.
    expect(Date.parse(rec!.at)).not.toBeNaN();
  });

  it("accepting does NOT erase identifiers", async () => {
    store.set("mm-vid", "visitor-abc");
    const { saveConsent } = await load();
    saveConsent(true);
    expect(store.get("mm-vid")).toBe("visitor-abc");
  });
});

describe("storage failures cannot manufacture consent", () => {
  it("returns undecided when localStorage throws", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    const { readConsent, hasAnalyticsConsent, saveConsent } = await load();
    expect(readConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
    // Saving must not throw into the UI even when storage is unavailable.
    expect(() => saveConsent(true)).not.toThrow();
  });
});
