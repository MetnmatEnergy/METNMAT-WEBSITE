"use client";

/**
 * First-party analytics collector — the only tracking on the site.
 *
 * Principles (generalized from the proven blog ViewTracker pipeline):
 *  - lightweight and lazy: no work until after hydration, ~zero render cost;
 *  - fail-silent: analytics must NEVER break or slow a page (all catches empty);
 *  - same-origin only: relative /api/a/collect (CSP-safe, immune to apex-308);
 *  - batched: queue flushes every 5s / 20 events / on pagehide via sendBeacon
 *    (fetch keepalive fallback), so navigation-away events still arrive;
 *  - privacy-light: anonymous random ids, no PII, no form CONTENT ever read,
 *    server stores no IPs; staff can self-exclude via the mm-analytics-optout
 *    flag; bots self-exclude (navigator.webdriver) and are UA-filtered again
 *    server-side.
 */

import {
  K_VISITOR,
  K_SESSION,
  K_LAST_ACTIVE,
  K_OPTOUT,
  LIMITS,
  isSessionAlive,
  randomId,
  type CollectPayload,
  type CollectedEvent,
  type EventType,
} from "./session";
import { hasAnalyticsConsent, K_CONSENT } from "../consent";

type Tracker = {
  track: (type: EventType, data?: { entity?: string; meta?: CollectedEvent["meta"] }) => void;
  pageView: (path: string, entity?: string) => void;
};

let instance: Tracker | null = null;
const queue: CollectedEvent[] = [];
let newSessionInfo: CollectPayload["newSession"] | undefined;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let vid = "";
let sid = "";

const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable — session-only tracking still works in-memory */
    }
  },
};

function ensureIds(): boolean {
  const now = Date.now();
  vid = ls.get(K_VISITOR) || "";
  if (!vid) {
    vid = randomId();
    ls.set(K_VISITOR, vid);
  }
  const last = Number(ls.get(K_LAST_ACTIVE) || 0);
  sid = ls.get(K_SESSION) || "";
  const alive = Boolean(sid) && isSessionAlive(last, now);
  if (!alive) {
    sid = randomId();
    ls.set(K_SESSION, sid);
    // First-touch attribution captured exactly once, at session birth.
    const q = new URLSearchParams(location.search);
    newSessionInfo = {
      referrer: document.referrer || "",
      landing: location.pathname,
      utm: {
        ...(q.get("utm_source") ? { source: q.get("utm_source")! } : {}),
        ...(q.get("utm_medium") ? { medium: q.get("utm_medium")! } : {}),
        ...(q.get("utm_campaign") ? { campaign: q.get("utm_campaign")! } : {}),
        ...(q.get("utm_term") ? { term: q.get("utm_term")! } : {}),
        ...(q.get("utm_content") ? { content: q.get("utm_content")! } : {}),
      },
    };
  }
  ls.set(K_LAST_ACTIVE, String(now));
  return !alive; // true = brand-new session
}

function send(useBeacon: boolean): void {
  if (queue.length === 0) return;
  const events = queue.splice(0, LIMITS.maxEventsPerBatch);
  const payload: CollectPayload = { v: 1, vid, sid, events };
  if (newSessionInfo) {
    payload.newSession = newSessionInfo;
    newSessionInfo = undefined; // attribution rides on exactly one batch
  }
  const body = JSON.stringify(payload);
  try {
    if (useBeacon && navigator.sendBeacon) {
      // Blob with content-type so the route can req.json() it.
      const ok = navigator.sendBeacon("/api/a/collect", new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    void fetch("/api/a/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never surface analytics failures */
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    send(false);
  }, 5000);
}

function push(ev: CollectedEvent): void {
  // The single chokepoint every event passes through, and the only reliable
  // place to enforce withdrawal. resetTracker() can drop the memoised tracker
  // but it CANNOT unbind the delegated click/focusin/scroll/pagehide listeners
  // registered below in getTracker() — those call push()/send() directly and
  // never consult getTracker() again. Without this check a withdrawn visitor
  // kept beaconing for the rest of the page load, which DPDP s.6(6) forbids
  // and which contradicts what /privacy tells them.
  if (!hasAnalyticsConsent()) return;
  queue.push(ev);
  ls.set(K_LAST_ACTIVE, String(Date.now()));
  if (queue.length >= 20) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    send(false);
  } else {
    scheduleFlush();
  }
}

// ── Page-leave instrumentation (dwell + scroll depth) ────────────────────────
let pageStart = 0;
let pagePath = "";
let maxScroll = 0;

let scrollScheduled = false;
function sampleScroll(): void {
  scrollScheduled = false;
  const doc = document.documentElement;
  const total = doc.scrollHeight - window.innerHeight;
  if (total <= 0) {
    maxScroll = 100;
    return;
  }
  const pct = Math.min(100, Math.round(((window.scrollY || doc.scrollTop) / total) * 100));
  if (pct > maxScroll) maxScroll = pct;
}

/** Throttle to one measurement per animation frame — the raw scroll event fires
 *  dozens of times per gesture and each reads layout (scrollHeight/innerHeight),
 *  which would thrash on long pages. */
function onScroll(): void {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(sampleScroll);
}

function recordLeave(): void {
  if (!pagePath) return;
  const dwell = Math.max(0, Math.round((Date.now() - pageStart) / 1000));
  push({ type: "page_leave", ts: Date.now(), path: pagePath, meta: { dwell, scroll: maxScroll } });
}

/**
 * Drop the cached instance so the next getTracker() re-evaluates consent.
 *
 * getTracker() memoises, which is right for a page load but wrong the moment a
 * visitor changes their mind: without this, granting consent would do nothing
 * until a reload, and withdrawing it would leave a live tracker running.
 * The queue is dropped too — anything collected before withdrawal must not be
 * flushed afterwards.
 */
export function resetTracker(): void {
  instance = null;
  queue.length = 0;
  newSessionInfo = undefined;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  vid = "";
  sid = "";
  // Also drop the in-flight page-leave state. Leaving it set meant that after
  // withdraw-then-re-accept, the first page_view emitted a page_leave whose
  // dwell and scroll described browsing done WHILE consent was withdrawn.
  pagePath = "";
  pageStart = 0;
  maxScroll = 0;
}

/**
 * Withdrawal in ANOTHER tab reaches this one only as a `storage` event —
 * localStorage is shared across tabs but CustomEvents are not. Without this a
 * second open tab kept its memoised tracker alive and ensureIds() re-minted the
 * mm-vid that withdrawal had just erased, re-persisting the identifier and
 * starting a fresh session. DPDP s.6(6) requires processing to cease and s.8(7)
 * requires erasure; having two tabs open is ordinary on a catalogue site.
 */
let consentWatched = false;
function watchConsent(): void {
  if (consentWatched || typeof window === "undefined") return;
  consentWatched = true;
  window.addEventListener("storage", (e) => {
    // key === null means localStorage.clear(); treat it as a consent change too.
    if (e.key !== null && e.key !== K_CONSENT) return;
    if (!hasAnalyticsConsent()) resetTracker();
  });
}

/**
 * Forms whose first focus has already been reported, deduped per page view.
 *
 * Module scope, not per-`getTracker()`: the focusin listener below is bound
 * once for the life of the page, and `pageView()` clears this same set, so the
 * two must refer to one object. When it lived inside getTracker() a consent
 * re-grant produced a second listener with a second, empty set — the dedup this
 * exists for stopped working, and one focus reported `form_start` twice.
 */
const startedForms = new Set<string>();

/**
 * Bind the delegated DOM listeners. ONCE per page, whatever happens to consent.
 *
 * These used to be registered inside getTracker(), after its `if (instance)`
 * memoisation check. That looked like "register once" and was not: withdrawing
 * consent calls resetTracker(), which nulls `instance`, so the next grant fell
 * through the check and registered the whole set AGAIN. Nothing ever removed
 * them — each handler is an inline closure, so removeEventListener could not
 * have matched even if it had been called. Measured on production: every
 * withdraw-then-grant cycle added exactly five permanent listeners
 * (pagehide, visibilitychange, scroll, click, focusin), growing linearly and
 * without bound.
 *
 * The cost was not only the listeners. Each duplicate handler calls push()
 * independently, so after N re-grants one click emitted N `cta_click` events
 * and one form focus N `form_start` events — the funnel over-counting that
 * pageView()'s dedup reset was written to prevent.
 *
 * Binding once is safe because consent is enforced at the other end: push()
 * drops every event while consent is absent (see its comment), so listeners
 * bound during an earlier grant sit inert through a withdrawal and resume on
 * re-grant. That is the same contract as before — only the duplication is gone.
 */
let listenersBound = false;
function bindListeners(): void {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  // Deliver whatever is queued when the page is being backgrounded/closed —
  // the one moment fetch can be killed, hence sendBeacon.
  window.addEventListener("pagehide", () => {
    recordLeave();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    send(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send(true);
  });
  window.addEventListener("scroll", onScroll, { passive: true });

  // Outbound + tagged-CTA clicks via one delegated listener.
  document.addEventListener(
    "click",
    (e) => {
      try {
        const el = (e.target as Element | null)?.closest?.("a[href], [data-track]") as
          | (HTMLAnchorElement & { dataset: DOMStringMap })
          | null;
        if (!el) return;
        const label = el.getAttribute("data-track");
        if (label) {
          push({ type: "cta_click", ts: Date.now(), path: location.pathname, meta: { label: label.slice(0, 80) } });
          return;
        }
        const href = el.getAttribute("href") || "";
        if (/^(https?:)?\/\//.test(href)) {
          const host = new URL(href, location.href).hostname.replace(/^www\./, "");
          const selfHost = location.hostname.replace(/^www\./, "");
          if (host && host !== selfHost) {
            push({ type: "outbound_click", ts: Date.now(), path: location.pathname, meta: { to: host } });
          }
        }
      } catch {
        /* ignore */
      }
    },
    { capture: true, passive: true }
  );

  // Generic form starts: first focus inside any form[data-analytics-form].
  document.addEventListener(
    "focusin",
    (e) => {
      try {
        const form = (e.target as Element | null)?.closest?.("form[data-analytics-form]");
        const name = form?.getAttribute("data-analytics-form");
        if (!name || startedForms.has(name)) return;
        startedForms.add(name);
        push({ type: "form_start", ts: Date.now(), path: location.pathname, meta: { form: name.slice(0, 60) } });
      } catch {
        /* ignore */
      }
    },
    { capture: true, passive: true }
  );
}

/** Test seam: how many times the delegated listeners have been bound. */
export function __listenersBoundForTest(): boolean {
  return listenersBound;
}

/**
 * Initialize once per real browser. Returns the tracker (or a no-op for bots /
 * opted-out staff / SSR / anyone who has not consented), so callers never need
 * null checks.
 */
export function getTracker(): Tracker {
  const noop: Tracker = { track: () => {}, pageView: () => {} };
  if (typeof window === "undefined") return noop;

  // Consent is checked BEFORE the memoisation, not after. Reading it after
  // `if (instance) return instance` made consent an init-time decision: a tab
  // that had already built a tracker never re-read it, so a withdrawal made
  // elsewhere could not stop that tab. It is never cached as `instance` either,
  // so an undecided visitor who accepts a moment later starts being measured
  // without a reload.
  try {
    if (!hasAnalyticsConsent()) {
      if (instance) resetTracker();
      return noop;
    }
  } catch {
    return noop;
  }

  if (instance) return instance;
  try {
    if ((navigator as { webdriver?: boolean }).webdriver) return (instance = noop);
    if (ls.get(K_OPTOUT) === "1") return (instance = noop);
  } catch {
    return noop;
  }

  watchConsent();
  ensureIds();

  bindListeners();

  instance = {
    track(type, data) {
      try {
        // Session may have idled out between interactions — re-check on every event.
        ensureIds();
        push({
          type,
          ts: Date.now(),
          path: location.pathname.slice(0, LIMITS.maxPathLen),
          ...(data?.entity ? { entity: data.entity.slice(0, LIMITS.maxEntityLen) } : {}),
          ...(data?.meta ? { meta: data.meta } : {}),
        });
      } catch {
        /* ignore */
      }
    },
    pageView(path, entity) {
      try {
        // Close out the previous page first (SPA navigation has no pagehide).
        recordLeave();
        // Reset form-start dedup per page view — deduping for the whole tab
        // lifetime let a form be re-shown (SPA nav back to it, or after a submit)
        // without a new form_start, so the funnel could report >100% completion.
        startedForms.clear();
        pagePath = path.slice(0, LIMITS.maxPathLen);
        pageStart = Date.now();
        maxScroll = 0;
        ensureIds();
        push({
          type: "page_view",
          ts: Date.now(),
          path: pagePath,
          ...(entity ? { entity: entity.slice(0, LIMITS.maxEntityLen) } : {}),
        });
      } catch {
        /* ignore */
      }
    },
  };
  return instance;
}
