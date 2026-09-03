import { describe, expect, it } from "vitest";
import { createScrollLock, type ScrollLockState } from "../apps/website/src/frontend/lib/scroll-lock";

/**
 * The stranding bug, written down.
 *
 * Five overlays (mobile nav, consent preferences, quote drawer, quote modal,
 * filter drawer) each saved `body.style.overflow`, wrote "hidden", and restored
 * the saved value on close. The second one to open saved the FIRST one's
 * "hidden" and restored it — leaving `body{overflow:hidden}` with every overlay
 * closed and no code path to clear it. Only a reload recovered.
 *
 * `environment: "node"` (vitest.config.ts) — no DOM here, which is why the
 * counter is a pure core behind an injectable port.
 */
function harness(initial: Partial<ScrollLockState> = {}, gutter = 0) {
  const state: ScrollLockState = { overflow: "", paddingRight: "", ...initial };
  const writes: ScrollLockState[] = [];
  const lock = createScrollLock({
    read: () => ({ ...state }),
    write: (s) => {
      Object.assign(state, s);
      writes.push({ ...s });
    },
    gutter: () => gutter,
  });
  return { lock, state, writes };
}

describe("createScrollLock", () => {
  it("locks on the first acquire and restores on the last release", () => {
    const { lock, state } = harness();
    const release = lock.acquire();
    expect(state.overflow).toBe("hidden");
    expect(lock.depth()).toBe(1);
    release();
    expect(state.overflow).toBe("");
    expect(lock.isLocked()).toBe(false);
  });

  it("survives the interleaved close that stranded the page", () => {
    const { lock, state } = harness();
    // (a) mobile nav opens, (b) consent preferences opens over it.
    const releaseNav = lock.acquire();
    const releasePrefs = lock.acquire();
    expect(state.overflow).toBe("hidden");

    // Escape: both keydown listeners fire in one native dispatch, so both
    // setState land in ONE React commit. React runs every passive destroy for a
    // commit before any create, in fiber order — SiteHeader precedes
    // ConsentBanner, so the nav releases first.
    releaseNav();
    expect(state.overflow).toBe("hidden"); // the dialog still holds it
    releasePrefs();
    expect(state.overflow).toBe(""); // <- the assertion the old code failed
  });

  it("is order-independent: the inner overlay may close first", () => {
    const { lock, state } = harness();
    const outer = lock.acquire();
    const inner = lock.acquire();
    inner();
    expect(state.overflow).toBe("hidden");
    outer();
    expect(state.overflow).toBe("");
  });

  it("only the first acquire reads the page, so a later one cannot capture 'hidden'", () => {
    const { lock, state, writes } = harness();
    const a = lock.acquire();
    const b = lock.acquire();
    const c = lock.acquire();
    expect(writes).toHaveLength(1); // acquires 2 and 3 write nothing
    c();
    b();
    a();
    expect(state.overflow).toBe("");
    expect(writes).toHaveLength(2); // one lock, one restore
  });

  it("a double release is a no-op and cannot underflow the depth", () => {
    // React invokes cleanup twice under StrictMode; a stray second call must not
    // unlock the page beneath an overlay that is still open.
    const { lock, state } = harness();
    const first = lock.acquire();
    const second = lock.acquire();
    first();
    first();
    first();
    expect(lock.depth()).toBe(1);
    expect(state.overflow).toBe("hidden");
    second();
    expect(lock.depth()).toBe(0);
    expect(state.overflow).toBe("");
  });

  it("restores a pre-existing inline value rather than clearing it", () => {
    const { lock, state } = harness({ overflow: "auto", paddingRight: "8px" });
    const release = lock.acquire();
    expect(state.overflow).toBe("hidden");
    release();
    expect(state).toEqual({ overflow: "auto", paddingRight: "8px" });
  });

  it("hands the scrollbar width back as padding, and takes it away again", () => {
    const { lock, state } = harness({}, 15);
    const release = lock.acquire();
    expect(state.paddingRight).toBe("15px");
    release();
    expect(state.paddingRight).toBe("");
  });

  it("leaves padding untouched where there is no scrollbar (overlay scrollbars)", () => {
    const { lock, state } = harness({ paddingRight: "4px" }, 0);
    const release = lock.acquire();
    expect(state.paddingRight).toBe("4px");
    release();
    expect(state.paddingRight).toBe("4px");
  });

  it("re-locks correctly after a full release cycle", () => {
    const { lock, state } = harness();
    lock.acquire()();
    expect(state.overflow).toBe("");
    const again = lock.acquire();
    expect(state.overflow).toBe("hidden");
    again();
    expect(state.overflow).toBe("");
  });

  it("a same-commit handoff (one overlay closes as another opens) never leaks", () => {
    // React destroys before creates, so the page is briefly unlocked — but no
    // paint happens inside a commit, and the new owner must capture the REAL
    // value, not "hidden".
    const { lock, state } = harness();
    const leaving = lock.acquire();
    leaving();
    const arriving = lock.acquire();
    expect(state.overflow).toBe("hidden");
    arriving();
    expect(state.overflow).toBe("");
  });
});

describe("the old per-overlay save/restore, for contrast", () => {
  it("strands the page unscrollable — this is the defect", () => {
    const body = { overflow: "" };
    const naiveLock = () => {
      const prev = body.overflow; // each owner reads for itself
      body.overflow = "hidden";
      return () => {
        body.overflow = prev;
      };
    };
    const releaseNav = naiveLock();
    const releasePrefs = naiveLock(); // captures "hidden"
    releaseNav();
    releasePrefs();
    expect(body.overflow).toBe("hidden"); // both closed, page still locked
  });
});
