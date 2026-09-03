import { describe, it, expect } from "vitest";
import {
  glowVars,
  createPointerBroadcaster,
  type BroadcasterEnv,
  type PointerHandler,
} from "../apps/website/src/frontend/lib/pointer-glow";

/**
 * The spotlight cards' pointer tracking.
 *
 * THE REGRESSION THIS PINS. Every GlowCard used to add its own `pointermove`
 * listener to `document` and write four CSS custom properties onto its own
 * element. Those properties are viewport coordinates, so every card stored the
 * same four values: the production shop page mounts ten cards, which meant ten
 * document-level listeners and forty style writes for every pointermove — on
 * elements painting a radial gradient with `background-attachment: fixed`, and
 * from a mouse that can report well above 60 Hz.
 *
 * One listener, one write per frame, and the values live on the document
 * element where they inherit down to every card. These tests hold that line.
 */

/** A recording environment standing in for the DOM. */
function env() {
  const listeners: PointerHandler[] = [];
  const applied: Array<Record<string, string>> = [];
  let pending: (() => void) | null = null;
  let nextHandle = 1;
  let cancelled = 0;
  let viewport = { w: 1000, h: 500 };

  const e: BroadcasterEnv = {
    addListener: (fn) => void listeners.push(fn),
    removeListener: (fn) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    schedule: (fn) => {
      pending = fn;
      return nextHandle++;
    },
    cancel: () => {
      cancelled++;
      pending = null;
    },
    apply: (vars) => void applied.push({ ...vars }),
    viewport: () => viewport,
  };

  return {
    e,
    listeners,
    applied,
    get cancelled() {
      return cancelled;
    },
    setViewport: (w: number, h: number) => void (viewport = { w, h }),
    /** Deliver a pointer event to every bound listener. */
    move: (x: number, y: number) => listeners.forEach((fn) => fn(x, y)),
    /** Run the frame the broadcaster asked for, if any. */
    frame: () => {
      const f = pending;
      pending = null;
      f?.();
    },
    hasPendingFrame: () => pending !== null,
  };
}

describe("glowVars", () => {
  it("formats exactly as the per-card writes did", () => {
    expect(glowVars(399, 300, 750, 625)).toEqual({
      "--x": "399.00",
      "--xp": "0.53",
      "--y": "300.00",
      "--yp": "0.48",
    });
  });

  it("never emits Infinity for a zero-sized viewport", () => {
    // The original divided by window.innerWidth unguarded and would write the
    // string "Infinity" into CSS. A real viewport is never zero, so this
    // changes nothing that renders — it removes a way to produce nonsense.
    const v = glowVars(10, 10, 0, 0);
    expect(v["--xp"]).toBe("0.00");
    expect(v["--yp"]).toBe("0.00");
  });
});

describe("the shared pointer broadcaster", () => {
  it("binds ONE listener no matter how many cards subscribe", () => {
    // The regression: ten cards on the shop page meant ten listeners.
    const h = env();
    const b = createPointerBroadcaster(h.e);
    const offs = Array.from({ length: 10 }, () => b.subscribe());
    expect(h.listeners).toHaveLength(1);
    expect(b.subscriberCount()).toBe(10);
    offs.forEach((off) => off());
    expect(h.listeners).toHaveLength(0);
  });

  it("keeps the listener while any card is still mounted", () => {
    const h = env();
    const b = createPointerBroadcaster(h.e);
    const a = b.subscribe();
    const c = b.subscribe();
    a();
    expect(b.isBound(), "one card left, listener must stay").toBe(true);
    expect(h.listeners).toHaveLength(1);
    c();
    expect(b.isBound()).toBe(false);
  });

  it("writes the properties ONCE per frame however many events arrive", () => {
    // A high-polling mouse fires far above 60 Hz; only the last position of a
    // frame can ever be seen, so the rest were pure cost.
    const h = env();
    const b = createPointerBroadcaster(h.e);
    b.subscribe();
    for (let i = 0; i < 50; i++) h.move(i, i * 2);
    expect(h.applied, "nothing written before the frame runs").toHaveLength(0);
    h.frame();
    expect(h.applied).toHaveLength(1);
    // and it is the LAST position, not the first
    expect(h.applied[0]!["--x"]).toBe("49.00");
    expect(h.applied[0]!["--y"]).toBe("98.00");
  });

  it("schedules a new frame after the previous one has run", () => {
    const h = env();
    const b = createPointerBroadcaster(h.e);
    b.subscribe();
    h.move(1, 1);
    h.frame();
    h.move(2, 2);
    h.frame();
    expect(h.applied).toHaveLength(2);
    expect(h.applied[1]!["--x"]).toBe("2.00");
  });

  it("cancels a pending frame when the last card unmounts", () => {
    const h = env();
    const b = createPointerBroadcaster(h.e);
    const off = b.subscribe();
    h.move(5, 5);
    expect(h.hasPendingFrame()).toBe(true);
    off();
    expect(h.cancelled).toBe(1);
    expect(h.hasPendingFrame()).toBe(false);
  });

  it("survives a double unsubscribe without unbinding a live listener", () => {
    // React can invoke a cleanup twice in development; a naive counter would
    // go negative and tear the listener out from under a mounted card.
    const h = env();
    const b = createPointerBroadcaster(h.e);
    const a = b.subscribe();
    const c = b.subscribe();
    a();
    a();
    a();
    expect(b.subscriberCount(), "the second card is still mounted").toBe(1);
    expect(b.isBound()).toBe(true);
    c();
    expect(b.isBound()).toBe(false);
  });

  it("re-binds cleanly after every card has gone", () => {
    const h = env();
    const b = createPointerBroadcaster(h.e);
    b.subscribe()();
    expect(b.isBound()).toBe(false);
    b.subscribe();
    expect(h.listeners).toHaveLength(1);
    h.move(3, 4);
    h.frame();
    expect(h.applied).toHaveLength(1);
  });

  it("reads the viewport at write time, so a resize is picked up", () => {
    const h = env();
    const b = createPointerBroadcaster(h.e);
    b.subscribe();
    h.setViewport(500, 250);
    h.move(250, 125);
    h.frame();
    expect(h.applied[0]!["--xp"]).toBe("0.50");
    expect(h.applied[0]!["--yp"]).toBe("0.50");
  });
});
