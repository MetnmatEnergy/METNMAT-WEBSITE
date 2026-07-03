import { describe, it, expect } from "vitest";
import {
  mintVisitorToken,
  verifyVisitorToken,
  registerView,
  parseViewedCookie,
  serializeViewedCookie,
} from "../apps/website/src/backend/lib/blog-visitor";

const DAY = 86_400_000;
const ID_A = "a".repeat(24);
const ID_B = "b".repeat(24);

describe("visitor tokens", () => {
  it("mints tokens that verify to a stable id", () => {
    const token = mintVisitorToken();
    const id = verifyVisitorToken(token);
    expect(id).toBeTruthy();
    expect(verifyVisitorToken(token)).toBe(id);
  });
  it("rejects forged / malformed / oversized tokens", () => {
    expect(verifyVisitorToken(null)).toBeNull();
    expect(verifyVisitorToken("")).toBeNull();
    expect(verifyVisitorToken("abc")).toBeNull();
    expect(verifyVisitorToken("abc.def")).toBeNull();
    const token = mintVisitorToken();
    expect(verifyVisitorToken(`x${token.slice(1)}`)).toBeNull();
    expect(verifyVisitorToken("a".repeat(200))).toBeNull();
  });
});

describe("view dedupe cookie", () => {
  it("counts the first view and dedupes within the same day", () => {
    const now = Date.now();
    const first = registerView(undefined, ID_A, now);
    expect(first).toContain(ID_A);
    expect(registerView(first, ID_A, now + 1000)).toBeNull(); // same day → not counted
  });
  it("counts again on a later day and tracks articles independently", () => {
    const now = Date.now();
    const c1 = registerView(undefined, ID_A, now)!;
    expect(registerView(c1, ID_B, now)).toContain(ID_B); // other article counts
    expect(registerView(c1, ID_A, now + 2 * DAY)).toContain(ID_A); // next day counts
  });
  it("ignores garbage cookies and caps entries", () => {
    expect(parseViewedCookie("not-a-cookie;;;").size).toBe(0);
    const map = new Map<string, number>();
    for (let i = 0; i < 100; i++) map.set(String(i).padStart(24, "0"), i);
    const serialized = serializeViewedCookie(map);
    expect(parseViewedCookie(serialized).size).toBeLessThanOrEqual(60);
  });
});
