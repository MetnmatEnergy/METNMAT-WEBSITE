import { describe, it, expect } from "vitest";
import { limitRate } from "../apps/website/src/backend/lib/rate-limit";

// With no UPSTASH_* env set, limitRate uses the in-memory fixed-window path.
describe("limitRate (in-memory fallback)", () => {
  it("allows up to the limit, then blocks with a retryAfter", async () => {
    const key = `test-allow-${Math.random()}`;
    const a = await limitRate(key, 3, 60_000);
    const b = await limitRate(key, 3, 60_000);
    const c = await limitRate(key, 3, 60_000);
    const d = await limitRate(key, 3, 60_000);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);
    expect(d.ok).toBe(false);
    expect(d.retryAfter).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", async () => {
    const k1 = `test-iso-1-${Math.random()}`;
    const k2 = `test-iso-2-${Math.random()}`;
    await limitRate(k1, 1, 60_000);
    const blocked = await limitRate(k1, 1, 60_000);
    const other = await limitRate(k2, 1, 60_000);
    expect(blocked.ok).toBe(false);
    expect(other.ok).toBe(true);
  });

  it("resets after the window elapses", async () => {
    const key = `test-window-${Math.random()}`;
    await limitRate(key, 1, 1); // 1ms window
    await new Promise((r) => setTimeout(r, 5));
    const after = await limitRate(key, 1, 1);
    expect(after.ok).toBe(true);
  });
});
