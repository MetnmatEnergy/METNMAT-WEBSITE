import { describe, it, expect } from "vitest";
import {
  planA11yWrites,
  IFRAME_TITLE,
  PANEL_ID,
  type WidgetSnapshot,
  type AttributeWrite,
} from "../apps/website/src/frontend/lib/chat-widget-a11y";

/**
 * The homepage "Page Unresponsive" freeze.
 *
 * A MutationObserver on document.body (subtree + attributes) called
 * `launcher.setAttribute("aria-expanded", ...)` unconditionally on every
 * callback. setAttribute queues a mutation record even when the value is
 * unchanged — that is the DOM specification — and the launcher was inside the
 * observed subtree, so the callback's own write re-fired the callback.
 * MutationObserver callbacks are microtasks; a microtask loop never yields to
 * paint, layout or input. The tab hung.
 *
 * The property that breaks the cycle is that a DOM which already matches yields
 * an EMPTY plan. These tests assert that, and the last one replays the loop
 * itself with a faithful model of the observer's semantics.
 */

const settled: WidgetSnapshot = {
  hasContainer: true,
  iframeTitle: IFRAME_TITLE,
  hasLauncher: true,
  launcherExpanded: "false",
  launcherControls: PANEL_ID,
  panelOpen: false,
};

describe("planA11yWrites", () => {
  it("returns NOTHING when the DOM already matches — the guard that stops the loop", () => {
    expect(planA11yWrites(settled)).toEqual([]);
  });

  it("returns nothing before the widget has built its DOM", () => {
    expect(
      planA11yWrites({
        hasContainer: false, iframeTitle: undefined, hasLauncher: false,
        launcherExpanded: null, launcherControls: null, panelOpen: null,
      })
    ).toEqual([]);
  });

  it("writes the iframe title exactly once, when it is absent", () => {
    const plan = planA11yWrites({ ...settled, iframeTitle: null });
    expect(plan).toEqual([{ target: "iframe", name: "title", value: IFRAME_TITLE }]);
  });

  it("does not touch a title that is merely different — that is the widget's business", () => {
    expect(planA11yWrites({ ...settled, iframeTitle: "Their own title" })).toEqual([]);
  });

  it("writes aria-expanded only when the panel state and the attribute disagree", () => {
    expect(planA11yWrites({ ...settled, panelOpen: true, launcherExpanded: "false" })).toEqual([
      { target: "launcher", name: "aria-expanded", value: "true" },
    ]);
    expect(planA11yWrites({ ...settled, panelOpen: true, launcherExpanded: "true" })).toEqual([]);
  });

  it("writes aria-controls only while it is missing or wrong", () => {
    expect(planA11yWrites({ ...settled, launcherControls: null })).toEqual([
      { target: "launcher", name: "aria-controls", value: PANEL_ID },
    ]);
    expect(planA11yWrites({ ...settled, launcherControls: "something-else" })).toEqual([
      { target: "launcher", name: "aria-controls", value: PANEL_ID },
    ]);
  });

  it("does not claim the launcher's state when there is no panel to read it from", () => {
    expect(planA11yWrites({ ...settled, panelOpen: null, launcherExpanded: null })).toEqual([]);
  });
});

/**
 * A faithful model of the failure. The observer re-fires after every attribute
 * write in the observed subtree — including a write that changes nothing. We
 * apply the plan, replay a callback for each write performed, and count.
 *
 * The OLD behaviour is modelled alongside so the difference is on the page:
 * unconditional write → one write per callback → one callback per write →
 * unbounded. A cap of 1,000 stands in for "forever".
 */
function runObserverLoop(
  plan: (s: WidgetSnapshot) => AttributeWrite[],
  cap = 1000
): { callbacks: number; writes: number; hitCap: boolean } {
  const dom: WidgetSnapshot = { ...settled, launcherExpanded: null, launcherControls: null };
  let callbacks = 0;
  let writes = 0;
  let pending = 1; // the initial mutation that armed it
  while (pending > 0 && callbacks < cap) {
    pending--;
    callbacks++;
    for (const w of plan(dom)) {
      writes++;
      pending++; // setAttribute inside the subtree queues another callback
      if (w.target === "launcher" && w.name === "aria-expanded") dom.launcherExpanded = w.value;
      if (w.target === "launcher" && w.name === "aria-controls") dom.launcherControls = w.value;
      if (w.target === "iframe" && w.name === "title") dom.iframeTitle = w.value;
    }
  }
  return { callbacks, writes, hitCap: callbacks >= cap };
}

/** What the component did before: set aria-expanded every single time. */
const unconditional = (s: WidgetSnapshot): AttributeWrite[] =>
  s.hasContainer && s.hasLauncher && s.panelOpen !== null
    ? [{ target: "launcher", name: "aria-expanded", value: String(s.panelOpen) }]
    : [];

describe("the observer feedback loop", () => {
  it("the OLD unconditional write never settles", () => {
    const r = runObserverLoop(unconditional);
    expect(r.hitCap).toBe(true);
    expect(r.writes).toBeGreaterThanOrEqual(1000);
  });

  it("the planned write settles after the attributes are first applied", () => {
    const r = runObserverLoop(planA11yWrites);
    expect(r.hitCap).toBe(false);
    // Two attributes were missing, so two writes, each re-firing once, then an
    // empty plan ends it. Three callbacks in total; never a fourth.
    expect(r.writes).toBe(2);
    expect(r.callbacks).toBe(3);
  });

  it("a storm of a hundred spurious callbacks on a settled DOM performs zero writes", () => {
    let writes = 0;
    for (let i = 0; i < 100; i++) writes += planA11yWrites(settled).length;
    expect(writes).toBe(0);
  });
});
