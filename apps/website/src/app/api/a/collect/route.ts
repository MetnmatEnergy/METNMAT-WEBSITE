import { NextResponse } from "next/server";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import {
  classifyTraffic,
  parseUserAgent,
  isBotUserAgent,
} from "@/frontend/lib/analytics/attribution";
import { EVENT_TYPES, LIMITS, ID_RE, type CollectedEvent } from "@/frontend/lib/analytics/session";
import { forwardToCms, lookupGeo, type IngestBatch } from "@/backend/services/analytics.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/a/collect — first-party analytics ingestion (same-origin beacons).
 *
 * Trust model: this is a PUBLIC endpoint; everything in the body is attacker-
 * controllable. Defenses, in order: rate limit → byte cap → strict shape/enum
 * whitelist with hard field caps → server-side bot UA filter → sanitised
 * enrichment. The response is always 204 (even for dropped bots) so the
 * endpoint leaks nothing about filtering — and, like /api/blog/views, it must
 * NEVER error a page over analytics.
 *
 * Privacy: the visitor IP is used transiently for rate limiting and (only when
 * ANALYTICS_GEO_TOKEN is configured) one coarse geo lookup; it is never stored
 * and never forwarded to the CMS.
 */

const VALID_TYPES = new Set<string>(EVENT_TYPES);
const KNOWN_ENTITY = /^(product|project|blog|service):[a-z0-9-]{1,100}$/;

function sanitizeMeta(meta: unknown): Record<string, string | number | boolean> | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (n >= LIMITS.maxMetaKeys) break;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,30}$/.test(k)) continue; // no $-operators, no dots
    if (typeof v === "string") out[k] = v.slice(0, LIMITS.maxMetaValueLen);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else continue;
    n++;
  }
  return n > 0 ? out : undefined;
}

function sanitizePath(p: unknown): string | null {
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//")) return null;
  // Strip query/hash — never ingest tokens or search params by accident.
  return p.split(/[?#]/)[0].slice(0, LIMITS.maxPathLen);
}

export async function POST(req: Request): Promise<Response> {
  const ok204 = () => new NextResponse(null, { status: 204 });

  // Generous for real browsing (batches), tight enough to blunt floods.
  const rl = await limitRate(`collect:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return ok204(); // silently drop — never error a page over analytics

  const ua = req.headers.get("user-agent");
  if (isBotUserAgent(ua)) return ok204();

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return ok204();
  }
  if (!raw || raw.length > LIMITS.maxBodyBytes) return ok204();

  let body: {
    v?: number;
    vid?: string;
    sid?: string;
    newSession?: {
      referrer?: string;
      landing?: string;
      utm?: Partial<Record<"source" | "medium" | "campaign" | "term" | "content", string>>;
    };
    events?: unknown[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return ok204();
  }

  if (body.v !== 1) return ok204();
  const vid = typeof body.vid === "string" && ID_RE.test(body.vid) ? body.vid : null;
  const sid = typeof body.sid === "string" && ID_RE.test(body.sid) ? body.sid : null;
  if (!vid || !sid || !Array.isArray(body.events)) return ok204();

  const events: CollectedEvent[] = [];
  for (const e of body.events.slice(0, LIMITS.maxEventsPerBatch)) {
    if (!e || typeof e !== "object") continue;
    const ev = e as Record<string, unknown>;
    if (typeof ev.type !== "string" || !VALID_TYPES.has(ev.type)) continue;
    const path = sanitizePath(ev.path);
    if (!path) continue;
    const ts = Number(ev.ts);
    // Reject nonsense clocks: accept only within ±1h of server time.
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 3_600_000) continue;
    const entity =
      typeof ev.entity === "string" && KNOWN_ENTITY.test(ev.entity) ? ev.entity : undefined;
    events.push({
      type: ev.type as CollectedEvent["type"],
      ts,
      path,
      ...(entity ? { entity } : {}),
      ...(sanitizeMeta(ev.meta) ? { meta: sanitizeMeta(ev.meta) } : {}),
    });
  }
  if (events.length === 0) return ok204();

  const batch: IngestBatch = { vid, sid, events };

  // Resolve geo for every accepted batch, not only at session birth. This
  // backfills active sessions after ANALYTICS_GEO_TOKEN is enabled; the
  // per-instance cache keeps repeat activity from causing repeat provider calls.
  const geo = await lookupGeo(clientIp(req));
  if (geo) batch.geo = geo;

  if (body.newSession && typeof body.newSession === "object") {
    const ns = body.newSession;
    const landing = sanitizePath(ns.landing) || events[0].path;
    const utm = ns.utm && typeof ns.utm === "object" ? ns.utm : {};
    const attribution = classifyTraffic({
      referrer: typeof ns.referrer === "string" ? ns.referrer.slice(0, 500) : "",
      selfHost: new URL(req.url).hostname,
      utmSource: typeof utm.source === "string" ? utm.source.slice(0, 100) : undefined,
      utmMedium: typeof utm.medium === "string" ? utm.medium.slice(0, 100) : undefined,
      utmCampaign: typeof utm.campaign === "string" ? utm.campaign.slice(0, 100) : undefined,
      utmTerm: typeof utm.term === "string" ? utm.term.slice(0, 100) : undefined,
      utmContent: typeof utm.content === "string" ? utm.content.slice(0, 100) : undefined,
    });
    const device = parseUserAgent(ua);
    batch.newSession = { landing, attribution, device, ...(geo ? { geo } : {}) };
  }

  // Ack the browser immediately; the CMS hop rides on the same invocation
  // awaited AFTER the response is constructed (Cloud Run keeps the instance
  // alive for the request; a 5s timeout bounds it).
  await forwardToCms(batch);
  return ok204();
}
