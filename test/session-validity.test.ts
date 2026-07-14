import { describe, it, expect } from "vitest";
import { tokenNotBeforeReset, SESSION_SKEW_MS } from "../apps/website/src/backend/lib/session-validity";

/**
 * Build a JWT-shaped string whose payload carries `iat` (seconds). Only the
 * middle segment is decoded by the check, so the header/signature are dummies.
 */
function tokenWithIat(iatSeconds: number): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: "c1", iat: iatSeconds })}.sig`;
}

describe("tokenNotBeforeReset (fail-open password-change session invalidation)", () => {
  const nowSec = 1_800_000_000; // fixed instant (seconds)
  const nowMs = nowSec * 1000;

  it("keeps every token valid when the account never changed a password", () => {
    const old = tokenWithIat(nowSec - 10_000);
    expect(tokenNotBeforeReset(old, undefined)).toBe(true);
    expect(tokenNotBeforeReset(old, 0)).toBe(true);
    expect(tokenNotBeforeReset(old, null)).toBe(true);
  });

  it("INVALIDATES a token issued before the password change", () => {
    const stolen = tokenWithIat(nowSec - 3600); // issued an hour before
    expect(tokenNotBeforeReset(stolen, nowMs)).toBe(false);
  });

  it("keeps a token issued after the password change valid", () => {
    const fresh = tokenWithIat(nowSec + 5);
    expect(tokenNotBeforeReset(fresh, nowMs)).toBe(true);
  });

  it("keeps a same-second freshly-minted token valid via the skew (iat floors below svf)", () => {
    // svf recorded a few hundred ms into the second; the re-login token floors
    // its iat to the second boundary — must still be accepted.
    const svf = nowMs + 800;
    const reloginToken = tokenWithIat(nowSec); // floored
    expect(tokenNotBeforeReset(reloginToken, svf)).toBe(true);
    // ...and anything within the skew window is tolerated.
    expect(tokenNotBeforeReset(tokenWithIat(nowSec), nowMs + SESSION_SKEW_MS - 1)).toBe(true);
  });

  it("FAILS OPEN on a malformed / unreadable token (never signs out on a decode error)", () => {
    expect(tokenNotBeforeReset("not-a-jwt", nowMs)).toBe(true);
    expect(tokenNotBeforeReset("", nowMs)).toBe(true);
    expect(tokenNotBeforeReset("a.b", nowMs)).toBe(true); // no readable iat
    const noIat = `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ id: "c1" })).toString("base64url")}.sig`;
    expect(tokenNotBeforeReset(noIat, nowMs)).toBe(true);
  });
});
