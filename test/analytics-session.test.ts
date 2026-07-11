import { describe, it, expect } from "vitest";
import {
  SESSION_IDLE_MS,
  isSessionAlive,
  istDay,
  randomId,
  ID_RE,
  EVENT_TYPES,
  LIMITS,
} from "../apps/website/src/frontend/lib/analytics/session";

describe("isSessionAlive — the 30-minute window", () => {
  const NOW = 1_752_200_000_000;

  it("alive strictly under 30 minutes of inactivity", () => {
    expect(isSessionAlive(NOW - 1, NOW)).toBe(true);
    expect(isSessionAlive(NOW - (SESSION_IDLE_MS - 1), NOW)).toBe(true);
  });

  it("dead at exactly 30 minutes and beyond", () => {
    expect(isSessionAlive(NOW - SESSION_IDLE_MS, NOW)).toBe(false);
    expect(isSessionAlive(NOW - SESSION_IDLE_MS - 1, NOW)).toBe(false);
  });

  it("rejects missing, non-finite, and future stamps (clock skew / tampering)", () => {
    expect(isSessionAlive(null, NOW)).toBe(false);
    expect(isSessionAlive(undefined, NOW)).toBe(false);
    expect(isSessionAlive(NaN, NOW)).toBe(false);
    expect(isSessionAlive(NOW + 1000, NOW)).toBe(false);
  });
});

describe("istDay — IST calendar bucketing", () => {
  it("buckets by IST, not UTC", () => {
    // 2026-07-10 20:00 UTC = 2026-07-11 01:30 IST → next IST day
    expect(istDay(Date.parse("2026-07-10T20:00:00.000Z"))).toBe("2026-07-11");
    // 2026-07-10 18:29 UTC = 2026-07-10 23:59 IST → still same IST day
    expect(istDay(Date.parse("2026-07-10T18:29:00.000Z"))).toBe("2026-07-10");
    // IST midnight boundary: 18:30 UTC flips the day
    expect(istDay(Date.parse("2026-07-10T18:30:00.000Z"))).toBe("2026-07-11");
  });
});

describe("randomId / ID_RE", () => {
  it("generates ids the wire regex accepts, unique across calls", () => {
    const a = randomId();
    const b = randomId();
    expect(a).not.toBe(b);
    expect(ID_RE.test(a)).toBe(true);
    expect(ID_RE.test(b)).toBe(true);
  });

  it("regex rejects malformed wire ids", () => {
    expect(ID_RE.test("short")).toBe(false);
    expect(ID_RE.test("has spaces here yes")).toBe(false);
    expect(ID_RE.test("semi;colon-injection-x")).toBe(false);
    expect(ID_RE.test("x".repeat(65))).toBe(false);
    expect(ID_RE.test("$where-1234567890")).toBe(false);
  });
});

describe("wire contract constants", () => {
  it("event whitelist matches the server's expectations", () => {
    expect(EVENT_TYPES).toEqual([
      "page_view",
      "page_leave",
      "cta_click",
      "outbound_click",
      "form_start",
      "form_submit",
      "search",
      "purchase",
    ]);
  });

  it("limits stay within sendBeacon-safe sizes", () => {
    expect(LIMITS.maxBodyBytes).toBeLessThanOrEqual(64_000); // sendBeacon budget
    expect(LIMITS.maxEventsPerBatch).toBeGreaterThan(0);
    expect(LIMITS.maxMetaKeys).toBeLessThanOrEqual(16);
  });
});
