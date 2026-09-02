import { describe, it, expect } from "vitest";
import { wrapTabTarget, FOCUSABLE_SELECTOR } from "../apps/website/src/frontend/lib/focus-trap";

/**
 * Three overlays each hand-rolled part of the dialog contract and each missed
 * something different: the quote drawer had no tab trap, the quote modal never
 * returned focus to its trigger, and the mobile filter drawer declared
 * role="dialog" aria-modal="true" while doing no focus management at all — the
 * combination that misleads a screen-reader user most, since it is announced as
 * modal and then lets Tab walk straight out into the page behind.
 *
 * This covers the arithmetic. Which element gets focus is the part that is easy
 * to get subtly wrong and impossible to eyeball.
 */

const items = ["a", "b", "c"];

describe("wrapTabTarget", () => {
  it("lets the browser handle the ordinary middle of the list", () => {
    // Returning null matters: intercepting every Tab would override the
    // browser's own ordering, which already handles reading order and controls
    // that became disabled mid-list.
    expect(wrapTabTarget(items, "a", false)).toBeNull();
    expect(wrapTabTarget(items, "b", false)).toBeNull();
    expect(wrapTabTarget(items, "b", true)).toBeNull();
    expect(wrapTabTarget(items, "c", true)).toBeNull();
  });

  it("wraps forward off the last item to the first", () => {
    expect(wrapTabTarget(items, "c", false)).toBe("a");
  });

  it("wraps backward off the first item to the last", () => {
    expect(wrapTabTarget(items, "a", true)).toBe("c");
  });

  it("pulls focus in when it is on the container rather than a control", () => {
    // The dialog root holds focus right after opening.
    expect(wrapTabTarget(items, null, false)).toBe("a");
    expect(wrapTabTarget(items, null, true)).toBe("c");
  });

  it("pulls focus in when the active element is not in the list at all", () => {
    // A control that has since been disabled, or focus parked outside.
    expect(wrapTabTarget(items, "gone", false)).toBe("a");
    expect(wrapTabTarget(items, "gone", true)).toBe("c");
  });

  it("has nothing to do with an empty dialog", () => {
    // The caller keeps focus on the container in this case.
    expect(wrapTabTarget([], null, false)).toBeNull();
    expect(wrapTabTarget([], "a", true)).toBeNull();
  });

  it("keeps a single focusable control focused in both directions", () => {
    expect(wrapTabTarget(["only"], "only", false)).toBe("only");
    expect(wrapTabTarget(["only"], "only", true)).toBe("only");
  });

  it("never returns a value outside the list", () => {
    for (const active of [null, "a", "b", "c", "elsewhere"]) {
      for (const shift of [true, false]) {
        const out = wrapTabTarget(items, active, shift);
        if (out !== null) expect(items).toContain(out);
      }
    }
  });
});

describe("FOCUSABLE_SELECTOR", () => {
  it("excludes tabindex -1, so a dialog container is not a tab stop of its own", () => {
    // The container gets tabIndex={-1} to receive focus programmatically. If the
    // selector matched it, Tab would land back on the container every cycle.
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
    expect(FOCUSABLE_SELECTOR).not.toMatch(/\[tabindex\](?!:not)/);
  });

  it("skips disabled controls", () => {
    for (const tag of ["button", "input", "select", "textarea"]) {
      expect(FOCUSABLE_SELECTOR).toContain(`${tag}:not([disabled])`);
    }
  });

  it("skips hidden inputs, which are focusable-looking but never focusable", () => {
    expect(FOCUSABLE_SELECTOR).toContain("[type='hidden']");
  });

  it("covers the controls these dialogs actually contain", () => {
    // The quote drawer is a form: text inputs, a textarea, selects, buttons,
    // and the close control.
    for (const needed of ["a[href]", "button", "input", "select", "textarea"]) {
      expect(FOCUSABLE_SELECTOR).toContain(needed);
    }
  });
});
