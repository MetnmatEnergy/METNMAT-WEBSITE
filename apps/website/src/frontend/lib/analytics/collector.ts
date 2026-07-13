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
 * Initialize once per real browser. Returns the tracker (or a no-op for bots /
 * opted-out staff / SSR), so callers never need null checks.
 */
export function getTracker(): Tracker {
  if (instance) return instance;
  const noop: Tracker = { track: () => {}, pageView: () => {} };
  if (typeof window === "undefined") return noop;
  try {
    if ((navigator as { webdriver?: boolean }).webdriver) return (instance = noop);
    if (ls.get(K_OPTOUT) === "1") return (instance = noop);
  } catch {
    return noop;
  }

  ensureIds();

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
  const started = new Set<string>();
  document.addEventListener(
    "focusin",
    (e) => {
      try {
        const form = (e.target as Element | null)?.closest?.("form[data-analytics-form]");
        const name = form?.getAttribute("data-analytics-form");
        if (!name || started.has(name)) return;
        started.add(name);
        push({ type: "form_start", ts: Date.now(), path: location.pathname, meta: { form: name.slice(0, 60) } });
      } catch {
        /* ignore */
      }
    },
    { capture: true, passive: true }
  );

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
