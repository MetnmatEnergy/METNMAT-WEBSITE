import type { Payload } from "payload";

/**
 * Analytics ingestion — writes one validated batch from the website into the
 * three analytics collections using RAW mongoose models (the Counters
 * pattern): schema-default inserts without Payload hook overhead, and true
 * atomic $inc/upsert semantics Payload's read-modify-write update() cannot
 * give. Rollups therefore need no cron: every batch increments its own day.
 *
 * The website already sanitised the payload (whitelist, caps, bot filter);
 * this side re-checks shapes defensively but trusts the key-gated caller for
 * semantics.
 */

type RawModel = {
  insertMany: (docs: Record<string, unknown>[], opts?: Record<string, unknown>) => Promise<unknown>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>
  ) => Promise<unknown>;
};

const model = (payload: Payload, slug: string): RawModel =>
  (payload.db as unknown as { collections: Record<string, RawModel> }).collections[slug];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDay = (epochMs: number): string => new Date(epochMs + IST_OFFSET_MS).toISOString().slice(0, 10);

const EVENT_TYPES = new Set([
  "page_view",
  "page_leave",
  "cta_click",
  "outbound_click",
  "form_start",
  "form_submit",
  "search",
  "purchase",
]);

const ID_RE = /^[a-zA-Z0-9-]{10,64}$/;
/** Mongo map keys must not contain dots/$ — dimensions are constrained anyway. */
const safeKey = (s: string): string => s.replace(/[.$]/g, "_").slice(0, 40) || "unknown";

type InEvent = {
  type: string;
  ts: number;
  path: string;
  entity?: string;
  meta?: Record<string, string | number | boolean>;
};

type InBatch = {
  vid?: string;
  sid?: string;
  events?: InEvent[];
  geo?: { country?: string; region?: string; city?: string };
  newSession?: {
    landing?: string;
    attribution?: {
      source?: string;
      channel?: string;
      referrerDomain?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmTerm?: string;
      utmContent?: string;
    };
    device?: { device?: string; browser?: string; os?: string };
    geo?: { country?: string; region?: string; city?: string };
  };
};

export async function ingestAnalyticsBatch(
  payload: Payload,
  raw: unknown
): Promise<{ ok: true; events: number }> {
  const body = (raw ?? {}) as InBatch;
  const vid = typeof body.vid === "string" && ID_RE.test(body.vid) ? body.vid : null;
  const sid = typeof body.sid === "string" && ID_RE.test(body.sid) ? body.sid : null;
  if (!vid || !sid || !Array.isArray(body.events)) throw new Error("bad batch shape");

  const now = Date.now();
  const events = body.events
    .filter(
      (e): e is InEvent =>
        !!e &&
        typeof e === "object" &&
        typeof e.type === "string" &&
        EVENT_TYPES.has(e.type) &&
        typeof e.path === "string" &&
        Number.isFinite(Number(e.ts))
    )
    .slice(0, 25);
  if (events.length === 0) return { ok: true, events: 0 };

  // Clamp client-supplied timestamps to a sane window before they drive day/
  // session bucketing (defense-in-depth against rollup poisoning — the website
  // collector already validates ~±1h, but this is the trust boundary for the
  // internal key). Everything downstream reads the clamped value.
  const MIN_TS = now - 14 * 86_400_000;
  const MAX_TS = now + 5 * 60_000;
  for (const e of events) {
    const t = Number(e.ts);
    e.ts = t < MIN_TS ? MIN_TS : t > MAX_TS ? MAX_TS : t;
  }

  // ── 1. Raw events ───────────────────────────────────────────────────────────
  const eventDocs = events.map((e) => {
    const [entityType, entitySlug] = typeof e.entity === "string" ? e.entity.split(":") : [undefined, undefined];
    return {
      type: e.type,
      ts: new Date(Number(e.ts)),
      day: istDay(Number(e.ts)),
      path: String(e.path).slice(0, 300),
      ...(entityType && entitySlug ? { entityType, entitySlug } : {}),
      sid,
      vid,
      ...(e.meta && typeof e.meta === "object" ? { meta: e.meta } : {}),
    };
  });
  await model(payload, "analytics-events").insertMany(eventDocs, { ordered: false });

  // ── 2. Session upsert ───────────────────────────────────────────────────────
  const pageViews = events.filter((e) => e.type === "page_view");
  const lastView = pageViews[pageViews.length - 1];
  const firstTs = Math.min(...events.map((e) => Number(e.ts)));
  const lastTs = Math.max(...events.map((e) => Number(e.ts)));

  const enquirySubmit = events.find(
    (e) => e.type === "form_submit" && typeof e.meta?.form === "string" && ["quote", "contact", "support"].includes(String(e.meta.form))
  );
  const purchase = events.find((e) => e.type === "purchase");

  const ns = body.newSession;
  // Batch-level geo backfills sessions that started before the provider was
  // enabled. Fall back to the original newSession location for old senders.
  const geo = body.geo ?? ns?.geo;
  const geoFields = {
    ...(geo?.country ? { country: String(geo.country).slice(0, 60) } : {}),
    ...(geo?.region ? { region: String(geo.region).slice(0, 80) } : {}),
    ...(geo?.city ? { city: String(geo.city).slice(0, 80) } : {}),
  };
  const setOnInsert: Record<string, unknown> = {
    sid,
    vid,
    day: istDay(firstTs),
    startedAt: new Date(firstTs),
    entryPath: (ns?.landing || events[0].path).slice(0, 300),
    source: safeKey(String(ns?.attribution?.source || "direct")),
    channel: String(ns?.attribution?.channel || "").slice(0, 100),
    referrerDomain: String(ns?.attribution?.referrerDomain || "").slice(0, 200),
    utmSource: String(ns?.attribution?.utmSource || "").slice(0, 100),
    utmMedium: String(ns?.attribution?.utmMedium || "").slice(0, 100),
    utmCampaign: String(ns?.attribution?.utmCampaign || "").slice(0, 100),
    utmTerm: String(ns?.attribution?.utmTerm || "").slice(0, 100),
    utmContent: String(ns?.attribution?.utmContent || "").slice(0, 100),
    device: String(ns?.device?.device || "desktop"),
    browser: String(ns?.device?.browser || "Other").slice(0, 40),
    os: String(ns?.device?.os || "Other").slice(0, 40),
    createdAt: new Date(),
  };
  const sessionUpdate: Record<string, unknown> = {
    $setOnInsert: setOnInsert,
    $set: {
      lastAt: new Date(lastTs),
      updatedAt: new Date(),
      ...geoFields,
      ...(lastView ? { exitPath: String(lastView.path).slice(0, 300) } : {}),
      ...(enquirySubmit ? { convertedEnquiry: true } : {}),
      ...(purchase
        ? {
            convertedPurchase: true,
            orderNumber: String(purchase.meta?.order ?? "").slice(0, 40),
            purchaseTotal: Number(purchase.meta?.total) || 0,
          }
        : {}),
    },
    $inc: { pageViews: pageViews.length, events: events.length },
  };
  const sessions = model(payload, "analytics-sessions");
  try {
    await sessions.findOneAndUpdate({ sid }, sessionUpdate, { upsert: true, setDefaultsOnInsert: true });
  } catch (e) {
    // Upsert race on the unique sid: second writer retries as a plain update.
    if ((e as { code?: number })?.code === 11000) {
      await sessions.findOneAndUpdate({ sid }, sessionUpdate, { upsert: false });
    } else {
      throw e;
    }
  }

  // ── 3. Daily rollup $inc ────────────────────────────────────────────────────
  const day = istDay(firstTs);
  const inc: Record<string, number> = {};
  const bump = (k: string, by = 1) => {
    inc[k] = (inc[k] ?? 0) + by;
  };
  for (const e of events) {
    if (e.type === "page_view") bump("pageViews");
    else if (e.type === "cta_click") bump("ctaClicks");
    else if (e.type === "outbound_click") bump("outboundClicks");
    else if (e.type === "form_start") bump("formStarts");
    else if (e.type === "form_submit") bump("formSubmits");
    else if (e.type === "search") bump("searches");
    else if (e.type === "purchase") {
      bump("purchases");
      bump("purchaseTotal", Number(e.meta?.total) || 0);
    }
  }
  if (ns) {
    bump("sessions");
    bump(`bySource.${safeKey(String(ns.attribution?.source || "direct"))}`);
    bump(`byDevice.${safeKey(String(ns.device?.device || "desktop"))}`);
    if (geo?.country) bump(`byCountry.${safeKey(String(geo.country))}`);
  }
  // A batch with no daily-counted events and no new session (e.g. a page_leave-
  // only sendBeacon on unload) leaves inc empty. Mongo rejects `{ $inc: {} }`,
  // which would 500 AFTER the raw events + session already persisted and make
  // the collector's retry double-count. page_leave isn't a daily metric, so we
  // simply skip the rollup when there's nothing to increment.
  if (Object.keys(inc).length > 0) {
    const daily = model(payload, "analytics-daily");
    const dailyUpdate = {
      $inc: inc,
      $setOnInsert: { day, createdAt: new Date() },
      $set: { updatedAt: new Date() },
    };
    try {
      await daily.findOneAndUpdate({ day }, dailyUpdate, { upsert: true, setDefaultsOnInsert: true });
    } catch (e) {
      if ((e as { code?: number })?.code === 11000) {
        await daily.findOneAndUpdate({ day }, dailyUpdate, { upsert: false });
      } else {
        throw e;
      }
    }
  }

  return { ok: true, events: events.length };
}

/**
 * Ensure the raw-Mongo indexes Payload's field config can't express — called
 * once from onInit. TTL: raw events expire after ANALYTICS_RAW_RETENTION_DAYS
 * (default 180). Payload's adapter already creates a plain {createdAt:1} index,
 * and Mongo refuses a second index on the same key pattern — so when createIndex
 * conflicts we CONVERT the existing index to TTL via collMod (also how a later
 * retention change takes effect: collMod just updates expireAfterSeconds).
 */
export async function ensureAnalyticsIndexes(payload: Payload): Promise<void> {
  const days = Math.max(30, Number(process.env.ANALYTICS_RAW_RETENTION_DAYS) || 180);
  const seconds = days * 86400;
  const events = model(payload, "analytics-events") as unknown as {
    collection: {
      collectionName: string;
      createIndex: (spec: Record<string, number>, opts?: Record<string, unknown>) => Promise<string>;
    };
    db: { db: { command: (cmd: Record<string, unknown>) => Promise<unknown> } };
  };
  try {
    await events.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: seconds });
    payload.logger.info(`[analytics] raw-event TTL ensured (${days}d retention).`);
    return;
  } catch {
    /* index exists with different options — convert below */
  }
  try {
    await events.db.db.command({
      collMod: events.collection.collectionName,
      index: { keyPattern: { createdAt: 1 }, expireAfterSeconds: seconds },
    });
    payload.logger.info(`[analytics] raw-event TTL ensured via collMod (${days}d retention).`);
  } catch (e) {
    payload.logger.warn(`[analytics] TTL index ensure failed: ${(e as Error).message}`);
  }
}
