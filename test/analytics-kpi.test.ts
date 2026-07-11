import { describe, it, expect } from "vitest";
import { resolveRange, delta, istDayOf, istDayStart } from "../apps/dashboard/src/admin/analytics/range";

// Fixed instant: 2026-07-11 12:00 IST (= 06:30 UTC).
const NOW = Date.parse("2026-07-11T06:30:00.000Z");

describe("delta — honest KPI comparisons", () => {
  it('never emits "Infinity%": prev=0 & current>0 → "New"', () => {
    const d = delta(42, 0);
    expect(d.text).toBe("New");
    expect(d.up).toBe(true);
    expect(d.text).not.toMatch(/infinity/i);
  });

  it('both zero → "—"', () => {
    expect(delta(0, 0).text).toBe("—");
  });

  it("normal percentages, signed, one decimal", () => {
    expect(delta(150, 100)).toMatchObject({ text: "+50.0%", up: true, abs: 50 });
    expect(delta(75, 100)).toMatchObject({ text: "-25.0%", up: false, abs: -25 });
    expect(delta(100, 100).text).toBe("+0.0%");
  });
});

describe("resolveRange — IST windows", () => {
  it("today is a single IST day", () => {
    const r = resolveRange({ range: "today", now: NOW });
    expect(r.days).toEqual(["2026-07-11"]);
  });

  it("7d is 7 inclusive days ending today", () => {
    const r = resolveRange({ range: "7d", now: NOW });
    expect(r.days).toHaveLength(7);
    expect(r.days[0]).toBe("2026-07-05");
    expect(r.days[6]).toBe("2026-07-11");
  });

  it("default range is 30d; unknown keys fall back", () => {
    expect(resolveRange({ now: NOW }).days).toHaveLength(30);
    expect(resolveRange({ range: "bogus", now: NOW }).key).toBe("30d");
  });

  it("prev comparison window is equal length, immediately before", () => {
    const r = resolveRange({ range: "7d", compare: "prev", now: NOW });
    expect(r.compareDays).toHaveLength(7);
    expect(r.compareDays[6]).toBe("2026-07-04"); // day before current window starts
    expect(r.compareDays[0]).toBe("2026-06-28");
  });

  it("year comparison shifts 365 days", () => {
    const r = resolveRange({ range: "today", compare: "year", now: NOW });
    expect(r.compareDays).toEqual(["2025-07-11"]);
  });

  it('compare "none" yields no comparison window', () => {
    const r = resolveRange({ range: "30d", compare: "none", now: NOW });
    expect(r.compareDays).toEqual([]);
    expect(r.compareLabel).toBe("");
  });

  it("this-month starts on the 1st (IST)", () => {
    const r = resolveRange({ range: "this-month", now: NOW });
    expect(r.days[0]).toBe("2026-07-01");
    expect(r.days[r.days.length - 1]).toBe("2026-07-11");
  });

  it("prev-month covers the entire previous calendar month", () => {
    const r = resolveRange({ range: "prev-month", now: NOW });
    expect(r.days[0]).toBe("2026-06-01");
    expect(r.days[r.days.length - 1]).toBe("2026-06-30");
    expect(r.days).toHaveLength(30);
  });

  it("custom range validates, orders, and clamps to today", () => {
    const r = resolveRange({ range: "custom", from: "2026-07-05", to: "2026-07-08", now: NOW });
    expect(r.days).toEqual(["2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08"]);
    // swapped bounds are re-ordered
    const swapped = resolveRange({ range: "custom", from: "2026-07-08", to: "2026-07-05", now: NOW });
    expect(swapped.days[0]).toBe("2026-07-05");
    // future end clamps to today
    const future = resolveRange({ range: "custom", from: "2026-07-10", to: "2026-12-31", now: NOW });
    expect(future.days[future.days.length - 1]).toBe("2026-07-11");
    // garbage dates fall back instead of exploding
    const junk = resolveRange({ range: "custom", from: "07/05/2026", to: "junk", now: NOW });
    expect(junk.days.length).toBeGreaterThan(0);
  });

  it("labels render, IST day helpers roundtrip", () => {
    const r = resolveRange({ range: "yesterday", now: NOW });
    expect(r.label).toContain("2026");
    expect(istDayOf(istDayStart("2026-07-11"))).toBe("2026-07-11");
  });
});
