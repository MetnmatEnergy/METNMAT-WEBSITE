import { describe, it, expect, vi } from "vitest";
import {
  createPaymentScriptLoader,
  canReuseOrder,
  isBusy,
  postJson,
  PAY_BUSY_LABEL,
  ORDER_REUSE_TTL_MS,
  type PayStatus,
} from "../apps/website/src/frontend/lib/pay-flow";

/**
 * The bug these guard against.
 *
 * The checkout Pay button could disable itself forever. `loadRazorpay()` looked
 * for an existing <script> tag and, finding one, attached load/error listeners
 * to it — but a tag left behind by a FAILED attempt has already fired its event,
 * so nothing ever called them and the promise never settled. The caller had
 * already disabled the button and nothing downstream could re-enable it, so the
 * second Pay click after any network blip killed checkout until a page reload.
 * Nothing timed out either, so a request that merely hung did the same on the
 * first click.
 *
 * The retry test below is the one that matters: it is the exact sequence a
 * customer hits on a flaky connection.
 */

// ── A DOM small enough to reason about ───────────────────────────────────────

type FakeScript = {
  src: string;
  async: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  /** Set once this tag has fired a terminal event — a real tag never re-fires. */
  spent: boolean;
};

function fakeDom() {
  /** Currently in the document. */
  const attached: FakeScript[] = [];
  /** Every tag ever injected, including ones since removed. */
  const created: FakeScript[] = [];
  const doc = {
    querySelectorAll: (sel: string) => {
      const m = /^script\[src="(.*)"\]$/.exec(sel);
      const src = m ? m[1] : "";
      const hits = attached.filter((s) => s.src === src);
      return {
        forEach: (fn: (el: unknown) => void) => hits.forEach((h) => fn(h)),
      } as unknown as NodeListOf<Element>;
    },
    createElement: () => {
      const el: FakeScript & { remove: () => void } = {
        src: "",
        async: false,
        onload: null,
        onerror: null,
        spent: false,
        remove() {
          const i = attached.indexOf(el);
          if (i >= 0) attached.splice(i, 1);
        },
      };
      return el as unknown as HTMLElement;
    },
    body: {
      appendChild: (el: unknown) => {
        attached.push(el as FakeScript);
        created.push(el as FakeScript);
        return el;
      },
    },
  };
  return { doc: doc as never, attached, created };
}

/** Controllable clock for the loader's timeout. */
function fakeTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  return {
    setTimer: (fn: () => void) => {
      const id = next++;
      pending.set(id, fn);
      return id;
    },
    clearTimer: (h: unknown) => {
      pending.delete(h as number);
    },
    fireAll: () => {
      const fns = [...pending.values()];
      pending.clear();
      fns.forEach((f) => f());
    },
    get outstanding() {
      return pending.size;
    },
  };
}

/** Settle the microtask queue so a .then chain runs. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("payment script loader", () => {
  it("resolves true when the script loads and the global appears", async () => {
    const { doc, created } = fakeDom();
    let ready = false;
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => ready,
      ...fakeTimers(),
    });

    const p = load();
    ready = true;
    created[0].onload!();
    expect(await p).toBe(true);
  });

  it("resolves false when the script errors", async () => {
    const { doc, created } = fakeDom();
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => false,
      ...fakeTimers(),
    });

    const p = load();
    created[0].onerror!();
    expect(await p).toBe(false);
  });

  // ── THE FREEZE ─────────────────────────────────────────────────────────────
  it("RETRIES after a failure instead of hanging forever", async () => {
    const { doc, created } = fakeDom();
    let ready = false;
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => ready,
      ...fakeTimers(),
    });

    // First click: the network is down.
    const first = load();
    created[0].onerror!();
    created[0].spent = true;
    expect(await first).toBe(false);
    await flush();

    // Second click. The old code attached listeners to the spent tag above and
    // the promise never settled, disabling checkout until a reload.
    const second = load();
    expect(created.length).toBe(2); // a FRESH tag, not the dead one
    expect(created[1].spent).toBe(false);
    ready = true;
    created[1].onload!();

    // The assertion that would have hung: this must settle at all.
    expect(await second).toBe(true);
  });

  it("removes the stale tag rather than listening to it", async () => {
    const { doc, created, attached } = fakeDom();
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => false,
      ...fakeTimers(),
    });
    const first = load();
    created[0].onerror!();
    await first;
    await flush();

    const deadTag = created[0];
    load();
    // The dead tag is gone from the document; only the fresh one is attached.
    expect(created.length).toBe(2);
    expect(attached.length).toBe(1);
    expect(attached).not.toContain(deadTag);
  });

  it("settles on timeout when neither event ever fires", async () => {
    const { doc } = fakeDom();
    const timers = fakeTimers();
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => false,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    const p = load();
    timers.fireAll(); // the request just hung
    expect(await p).toBe(false);
  });

  it("resolves false when onload fires but the global never appears", async () => {
    // A captive portal answering 200 with an HTML page executes as a script that
    // defines nothing. "Loaded" is not the same as "usable".
    const { doc, created } = fakeDom();
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => false,
      ...fakeTimers(),
    });
    const p = load();
    created[0].onload!();
    expect(await p).toBe(false);
  });

  it("shares one in-flight load between concurrent clicks", async () => {
    const { doc, created } = fakeDom();
    let ready = false;
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => ready,
      ...fakeTimers(),
    });

    const a = load();
    const b = load();
    expect(created.length).toBe(1); // one tag, not two
    ready = true;
    created[0].onload!();
    expect(await a).toBe(true);
    expect(await b).toBe(true);
  });

  it("short-circuits once the global is present", async () => {
    const { doc, created } = fakeDom();
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => true,
      ...fakeTimers(),
    });
    expect(await load()).toBe(true);
    expect(created.length).toBe(0); // nothing injected
  });

  it("does not leave a timer running after it settles", async () => {
    const { doc, created } = fakeDom();
    const timers = fakeTimers();
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => doc,
      isReady: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });
    const p = load();
    created[0]?.onload?.();
    await p;
    expect(timers.outstanding).toBe(0);
  });

  it("resolves false with no document rather than throwing", async () => {
    const load = createPaymentScriptLoader({
      src: "https://pay.test/checkout.js",
      getDocument: () => undefined,
      isReady: () => false,
      ...fakeTimers(),
    });
    expect(await load()).toBe(false);
  });
});

// ── Duplicate order prevention ───────────────────────────────────────────────

describe("order reuse", () => {
  const cached = { fingerprint: "REQUEST-A", at: 1_000_000, data: { ok: true } };

  it("reuses the order for an identical request, so a cancel-and-retry makes only one", () => {
    expect(canReuseOrder(cached, "REQUEST-A", cached.at + 5_000)).toBe(true);
  });

  it("does NOT reuse when the request changed — a new address must not ship a stale order", () => {
    expect(canReuseOrder(cached, "REQUEST-B", cached.at + 5_000)).toBe(false);
  });

  it("expires, so an abandoned order is not resurrected at a stale price", () => {
    expect(canReuseOrder(cached, "REQUEST-A", cached.at + ORDER_REUSE_TTL_MS - 1)).toBe(true);
    expect(canReuseOrder(cached, "REQUEST-A", cached.at + ORDER_REUSE_TTL_MS)).toBe(false);
  });

  it("treats a backwards clock jump as expired rather than fresh", () => {
    expect(canReuseOrder(cached, "REQUEST-A", cached.at - 60_000)).toBe(false);
  });

  it("has nothing to reuse on a first payment", () => {
    expect(canReuseOrder(null, "REQUEST-A", 1)).toBe(false);
    expect(canReuseOrder(undefined, "REQUEST-A", 1)).toBe(false);
  });
});

// ── The state machine ────────────────────────────────────────────────────────

describe("pay status", () => {
  it("keeps the button disabled through every in-flight state", () => {
    for (const s of ["submitting", "awaiting_payment", "verifying", "success"] as PayStatus[]) {
      expect(isBusy(s), s).toBe(true);
    }
  });

  it("re-enables the button on idle and on error, so a failure is always recoverable", () => {
    expect(isBusy("idle")).toBe(false);
    expect(isBusy("error")).toBe(false);
  });

  it("names the step actually in progress", () => {
    expect(PAY_BUSY_LABEL.submitting).toMatch(/Preparing/);
    expect(PAY_BUSY_LABEL.awaiting_payment).toMatch(/Waiting/);
    expect(PAY_BUSY_LABEL.verifying).toMatch(/Confirming/);
    // idle and error fall through to the price label.
    expect(PAY_BUSY_LABEL.idle).toBeUndefined();
    expect(PAY_BUSY_LABEL.error).toBeUndefined();
  });
});

// ── Network hops always settle ───────────────────────────────────────────────

describe("postJson", () => {
  it("aborts a hung request instead of leaving the button spinning", async () => {
    const hang: typeof fetch = (_u, init) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new DOMException("Aborted", "AbortError")));
      });

    await expect(postJson("/api/x", { a: 1 }, 10, hang)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("passes the body through and returns the response", async () => {
    const seen: { url?: string; body?: string } = {};
    const ok: typeof fetch = async (u, init) => {
      seen.url = String(u);
      seen.body = String(init?.body);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const res = await postJson("/api/checkout/create-order", { items: [1] }, 1000, ok);
    expect(res.status).toBe(200);
    expect(seen.url).toBe("/api/checkout/create-order");
    expect(JSON.parse(seen.body!)).toEqual({ items: [1] });
  });

  it("clears its timer on success, so a later abort cannot fire", async () => {
    const abortSpy = vi.fn();
    const ok: typeof fetch = async (_u, init) => {
      init?.signal?.addEventListener("abort", abortSpy);
      return new Response("{}", { status: 200 });
    };
    await postJson("/api/x", {}, 5, ok);
    await new Promise((r) => setTimeout(r, 30));
    expect(abortSpy).not.toHaveBeenCalled();
  });
});
