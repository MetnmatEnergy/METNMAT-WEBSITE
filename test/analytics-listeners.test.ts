import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Analytics listeners must be bound ONCE per page, however often consent changes.
 *
 * THE BUG THIS PINS. The delegated DOM listeners (pagehide, visibilitychange,
 * scroll, click, focusin) were registered inside getTracker(), *after* its
 * `if (instance) return instance` memoisation check. That reads like
 * "register once" and is not: withdrawing consent calls resetTracker(), which
 * sets `instance = null`, so the next grant falls straight through the check
 * and registers the whole set again. Nothing removes them — every handler is an
 * inline closure, so removeEventListener could never have matched it.
 *
 * Measured against production before the fix: each withdraw-then-grant cycle
 * added exactly five permanent listeners, growing linearly and without bound.
 * The damage is not only the listener count. Each duplicate handler calls
 * push() on its own, so after N re-grants a single click emitted N `cta_click`
 * events and a single form focus N `form_start` events — precisely the
 * over-counting that pageView()'s dedup reset exists to prevent.
 *
 * These tests fail against that implementation (counts 5, 10, 15 …) and pass
 * against the bind-once guard.
 *
 * The runner is a node environment with no DOM, so the browser globals the
 * collector touches are stubbed here and every registration is counted.
 */

type Counts = Record<string, number>;

function installFakeDom() {
  const counts: Counts = {};
  const store = new Map<string, string>();
  const record = (type: string) => {
    counts[type] = (counts[type] ?? 0) + 1;
  };

  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };

  const windowStub = {
    addEventListener: (type: string) => record(type),
    removeEventListener: () => {},
    localStorage,
    dispatchEvent: () => true,
  };

  const documentStub = {
    addEventListener: (type: string) => record(type),
    removeEventListener: () => {},
    visibilityState: "visible" as const,
    referrer: "",
    querySelector: () => null,
  };

  vi.stubGlobal("window", windowStub);
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("navigator", { webdriver: false, sendBeacon: () => true });
  vi.stubGlobal("location", {
    pathname: "/",
    search: "",
    href: "https://www.metnmat.com/",
    hostname: "www.metnmat.com",
  });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    void cb;
    return 0;
  });

  return { counts, store };
}

/** The five delegated listeners the collector binds for measurement. */
const DELEGATED = ["pagehide", "visibilitychange", "scroll", "click", "focusin"] as const;

const total = (c: Counts) => DELEGATED.reduce((n, k) => n + (c[k] ?? 0), 0);

async function loadCollector() {
  vi.resetModules();
  return import("../apps/website/src/frontend/lib/analytics/collector");
}

describe("analytics listener binding", () => {
  let dom: ReturnType<typeof installFakeDom>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    dom = installFakeDom();
  });

  const grant = () =>
    dom.store.set("mm-consent", JSON.stringify({ v: 1, analytics: true, at: new Date().toISOString() }));
  const withdraw = () =>
    dom.store.set("mm-consent", JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() }));

  it("binds each delegated listener exactly once on the first granted tracker", async () => {
    const { getTracker } = await loadCollector();
    grant();
    getTracker();
    for (const type of DELEGATED) {
      expect(dom.counts[type], `${type} should be bound once`).toBe(1);
    }
    expect(total(dom.counts)).toBe(DELEGATED.length);
  });

  it("does NOT multiply listeners across repeated withdraw / re-grant cycles", async () => {
    // The regression itself. Before the fix this reached 5, 10, 15, 20, 25, 30.
    const { getTracker } = await loadCollector();
    grant();
    getTracker();
    const afterFirst = total(dom.counts);
    expect(afterFirst).toBe(DELEGATED.length);

    for (let cycle = 1; cycle <= 5; cycle++) {
      withdraw();
      getTracker(); // returns the no-op and drops the memoised instance
      grant();
      getTracker(); // re-grants: this is where the duplicates used to appear
      expect(total(dom.counts), `after ${cycle} withdraw/re-grant cycles`).toBe(afterFirst);
      for (const type of DELEGATED) {
        expect(dom.counts[type], `${type} after ${cycle} cycles`).toBe(1);
      }
    }
  });

  it("still measures after a re-grant — the fix must not silence analytics", async () => {
    const { getTracker, resetTracker } = await loadCollector();
    grant();
    getTracker();
    // Withdrawal drops the identity, as DPDP s.8(7) requires.
    withdraw();
    getTracker();
    resetTracker();
    dom.store.delete("mm-vid");

    // Re-grant: the real path must run again and re-mint a visitor id.
    grant();
    const tracker = getTracker();
    tracker.pageView("/shop");
    expect(dom.store.get("mm-vid"), "a granted tracker must mint a visitor id").toBeTruthy();
    expect(typeof tracker.track).toBe("function");
  });

  it("binds nothing at all for a visitor who never consents", async () => {
    const { getTracker } = await loadCollector();
    withdraw();
    getTracker();
    getTracker();
    getTracker();
    expect(total(dom.counts), "no delegated listener may be bound without consent").toBe(0);
  });

  it("keeps the form-start dedup on one shared set, so a re-grant cannot double-count", async () => {
    // The dedup set used to be created per getTracker() call, so the second
    // focusin listener carried its own empty set and reported form_start twice.
    const mod = await loadCollector();
    grant();
    mod.getTracker();
    withdraw();
    mod.getTracker();
    grant();
    mod.getTracker();
    expect(dom.counts["focusin"], "exactly one focusin listener owns the dedup set").toBe(1);
  });
});
