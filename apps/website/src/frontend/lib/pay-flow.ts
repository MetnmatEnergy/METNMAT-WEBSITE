/**
 * Checkout pay-flow primitives.
 *
 * These live outside the checkout page so the parts that decide whether the Pay
 * button can get stuck are testable without a browser. The page holds the React
 * state; this holds the rules.
 */

/** Where the pay flow is. Every transition is explicit; there is no implicit idle. */
export type PayStatus =
  | "idle"
  | "submitting"
  | "awaiting_payment"
  | "verifying"
  | "success"
  | "error";

/**
 * Timeouts. Every network hop in the pay path has one, because the failure that
 * matters here is not an error response — it is no response at all, which left
 * the button disabled forever with no way back except a page reload.
 */
export const SCRIPT_TIMEOUT_MS = 15_000;
export const CREATE_ORDER_TIMEOUT_MS = 25_000;
export const RESOLVE_TIMEOUT_MS = 15_000;
/** Generous: the money has already moved, so we want to hear the answer. */
export const VERIFY_TIMEOUT_MS = 30_000;
/** Backstop above the sum of the real timeouts. Should never fire. */
export const WATCHDOG_MS: Partial<Record<PayStatus, number>> = {
  submitting: 90_000,
  verifying: 60_000,
};
/** A created order stops being reusable once its prices could have moved. */
export const ORDER_REUSE_TTL_MS = 15 * 60_000;

/**
 * What the button says while it is working. Each one names the step actually in
 * progress, so a customer waiting on the provider's window is not told we are
 * still "opening" it.
 */
export const PAY_BUSY_LABEL: Partial<Record<PayStatus, string>> = {
  submitting: "Preparing secure payment…",
  awaiting_payment: "Waiting for payment…",
  verifying: "Confirming your payment…",
  success: "Payment confirmed — redirecting…",
};

/** Statuses in which the Pay button must stay disabled. */
export const isBusy = (s: PayStatus): boolean =>
  s === "submitting" || s === "awaiting_payment" || s === "verifying" || s === "success";

/** True when a fetch rejected because we aborted it on our own timeout. */
export const isTimeout = (e: unknown): boolean =>
  typeof DOMException !== "undefined" &&
  e instanceof DOMException &&
  (e.name === "AbortError" || e.name === "TimeoutError");

/** POST JSON that always settles — an aborted request beats a hung button. */
export async function postJson(
  url: string,
  body: unknown,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Order reuse ──────────────────────────────────────────────────────────────

export type CachedOrder<T> = { fingerprint: string; at: number; data: T };

/**
 * Whether the order already created for this checkout can be reused.
 *
 * Every Pay click minted a fresh payment order AND a fresh pending Order row, so
 * cancelling the payment window and pressing Pay again left an abandoned order
 * behind each time — one customer, one payment, a trail of pending rows for
 * staff to reconcile.
 *
 * The fingerprint covers the WHOLE request, so changing the cart or the address
 * correctly starts a new order rather than reusing one bound to a stale address.
 * The TTL stops an order abandoned for a quarter of an hour being resurrected at
 * a price that may since have moved.
 */
export function canReuseOrder<T>(
  cached: CachedOrder<T> | null | undefined,
  fingerprint: string,
  now: number,
  ttlMs: number = ORDER_REUSE_TTL_MS
): boolean {
  if (!cached) return false;
  if (cached.fingerprint !== fingerprint) return false;
  const age = now - cached.at;
  // A clock that jumped backwards must not make a stale order look fresh.
  return age >= 0 && age < ttlMs;
}

// ── Payment script loading ───────────────────────────────────────────────────

type LoaderDeps = {
  src: string;
  timeoutMs?: number;
  /** Indirection so tests can supply a fake document/window. */
  getDocument: () => Pick<Document, "querySelectorAll" | "createElement" | "body"> | undefined;
  isReady: () => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

/**
 * Build a loader for a third-party payment script.
 *
 * WHAT WAS WRONG
 * The original looked for an existing <script> tag and, if it found one,
 * attached load/error listeners to it. A tag left behind by a FAILED attempt has
 * already fired its event, so those listeners never ran and the returned promise
 * NEVER SETTLED. The caller had already disabled the Pay button and nothing
 * downstream could re-enable it, so the second Pay click after any network blip
 * disabled checkout permanently — only a page reload recovered it. Nothing timed
 * out either, so a request that merely hung produced the same dead end on the
 * very first click.
 *
 * Now: one shared in-flight promise (concurrent clicks share a load), a stale tag
 * is removed rather than listened to, a timeout guarantees settlement, and a
 * failure is never cached so the next click genuinely retries.
 */
export function createPaymentScriptLoader(deps: LoaderDeps): () => Promise<boolean> {
  const timeoutMs = deps.timeoutMs ?? SCRIPT_TIMEOUT_MS;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let inflight: Promise<boolean> | null = null;

  return function load(): Promise<boolean> {
    if (deps.isReady()) return Promise.resolve(true);
    if (inflight) return inflight;

    const doc = deps.getDocument();
    if (!doc) return Promise.resolve(false);

    const started = new Promise<boolean>((resolve) => {
      // A tag from a previous failed attempt has already fired its event, so
      // listening to it now would never hear anything. Drop it and start over.
      doc.querySelectorAll(`script[src="${deps.src}"]`).forEach((el) => el.remove());

      const el = doc.createElement("script") as HTMLScriptElement;
      el.src = deps.src;
      el.async = true;

      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimer(timer);
        // onload can fire without the global appearing (a captive portal serving
        // an HTML error page with a 200, say), so check for what we actually need.
        resolve(ok && deps.isReady());
      };
      const timer = setTimer(() => finish(false), timeoutMs);

      el.onload = () => finish(true);
      el.onerror = () => finish(false);
      doc.body.appendChild(el);
    }).then((ok) => {
      // Never cache a failure: the next click must be able to retry.
      if (!ok) inflight = null;
      return ok;
    });

    inflight = started;
    return started;
  };
}
