import { describe, it, expect } from "vitest";
import { clientIp } from "../apps/website/src/backend/lib/rate-limit";

// clientIp is the RATE-LIMIT KEY. If a caller can choose it, every per-IP limit
// on the site is bypassable by rotating one header — so these are security
// tests, not formatting tests, and they had no coverage at all before.
//
// Production topology (AWS): client → Caddy → 127.0.0.1:3100. Caddy's
// reverse_proxy appends the connecting peer to X-Forwarded-For and there is no
// header_up override for it, so the real client is always the RIGHTMOST token.
const req = (headers: Record<string, string>) => new Request("https://www.metnmat.com/", { headers });

describe("clientIp", () => {
  it("returns the only token when Caddy is the sole hop", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("ignores a spoofed prefix — the attacker's value is never rightmost", () => {
    // What an attacker sending `X-Forwarded-For: 8.8.8.8` actually produces
    // once Caddy has appended the peer it saw.
    expect(clientIp(req({ "x-forwarded-for": "8.8.8.8, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("cannot be tricked by a spoofed chain that ends in a plausible proxy", () => {
    // The whole left side is caller-controlled. None of it is reachable,
    // because the peer Caddy appended is still last.
    const spoof = "8.8.8.8, 35.201.95.137, 10.0.0.1, 203.0.113.7";
    expect(clientIp(req({ "x-forwarded-for": spoof }))).toBe("203.0.113.7");
  });

  it("normalizes IPv4-mapped IPv6", () => {
    expect(clientIp(req({ "x-forwarded-for": "::ffff:203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("tolerates whitespace and empty segments", () => {
    expect(clientIp(req({ "x-forwarded-for": " 8.8.8.8 ,, 203.0.113.7 " }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip only when XFF is absent", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("prefers XFF over x-real-ip, which is forgeable", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "1.2.3.4" }))).toBe("203.0.113.7");
  });

  it("returns a constant rather than throwing when neither header is present", () => {
    // "unknown" buckets everyone together, which is the safe direction for a
    // limiter: it over-restricts rather than letting a caller opt out of one.
    expect(clientIp(req({}))).toBe("unknown");
  });

  it("never returns a token the caller placed to the left", () => {
    // Property check over the shape an attacker controls: whatever they prepend,
    // the answer is the peer Caddy appended.
    for (const junk of ["1.1.1.1", "::ffff:9.9.9.9", "not-an-ip", "  ", "a, b, c"]) {
      expect(clientIp(req({ "x-forwarded-for": `${junk}, 203.0.113.7` }))).toBe("203.0.113.7");
    }
  });
});
