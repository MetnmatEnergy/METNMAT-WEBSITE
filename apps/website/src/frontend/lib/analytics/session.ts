/**
 * Session + event contract for first-party analytics — pure functions and
 * constants, no framework imports (unit-tested from /test).
 *
 * Session definition: a visitor's activity window; a NEW session starts after
 * 30 minutes of inactivity (industry-standard fixed window). Ids live in
 * localStorage so they are shared across tabs, survive refresh/duplication,
 * and expire purely by inactivity — the server never mints ids, it only
 * aggregates what the collector reports.
 */

export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** localStorage keys — mm- prefix per site convention. */
export const K_VISITOR = "mm-vid";
export const K_SESSION = "mm-sid";
export const K_LAST_ACTIVE = "mm-slast";
/** Staff/self-exclusion flag (set from the CMS "exclude my visits" helper). */
export const K_OPTOUT = "mm-analytics-optout";

/** Event types the pipeline accepts — the server whitelist is the source of truth. */
export const EVENT_TYPES = [
  "page_view",
  "page_leave",
  "cta_click",
  "outbound_click",
  "form_start",
  "form_submit",
  "search",
  "purchase",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** One collected event as sent over the wire (validated server-side). */
export type CollectedEvent = {
  type: EventType;
  /** Client epoch ms — used for ordering/dwell; server stamps receive time too. */
  ts: number;
  path: string;
  /** Entity tag for detail pages: "product:slug", "project:slug", "blog:slug". */
  entity?: string;
  /** Type-specific extras, hard-capped server-side. */
  meta?: Record<string, string | number | boolean>;
};

export type CollectPayload = {
  v: 1;
  vid: string;
  sid: string;
  /** Set only on the first batch of a brand-new session — carries attribution. */
  newSession?: {
    referrer: string;
    utm: Partial<Record<"source" | "medium" | "campaign" | "term" | "content", string>>;
    landing: string;
  };
  events: CollectedEvent[];
};

/** Wire/size limits — enforced server-side, respected client-side. */
export const LIMITS = {
  maxEventsPerBatch: 25,
  maxPathLen: 300,
  maxEntityLen: 120,
  maxMetaKeys: 8,
  maxMetaValueLen: 200,
  maxBodyBytes: 20_000,
} as const;

/**
 * Decide whether the stored session is still alive, given the last-activity
 * stamp. Pure so the 30-minute window is directly testable.
 */
export function isSessionAlive(lastActiveMs: number | null | undefined, nowMs: number): boolean {
  if (!lastActiveMs || !Number.isFinite(lastActiveMs)) return false;
  if (lastActiveMs > nowMs) return false; // clock skew / tampered stamp
  return nowMs - lastActiveMs < SESSION_IDLE_MS;
}

/** IST day bucket ("YYYY-MM-DD") — business timezone, matching invoice FY logic. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export function istDay(epochMs: number): string {
  return new Date(epochMs + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Random id (UUID when available, time-salted fallback otherwise). */
export function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Basic shape check for ids coming back off the wire (defense in depth). */
export const ID_RE = /^[a-zA-Z0-9-]{10,64}$/;
