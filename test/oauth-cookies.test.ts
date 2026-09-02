import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * The bug this guards against.
 *
 * In production the OAuth handshake cookies are named with the `__Host-` prefix,
 * which is only VALID on a Set-Cookie that also carries Secure. The callback
 * cleared them with `{ path: "/", maxAge: 0 }` and no `secure`, so the browser
 * rejected the header outright and the cookies were never cleared — the used
 * PKCE verifier and CSRF state stayed in the jar until they expired on their
 * own. The cleanup ran on every path and did nothing.
 *
 * A delete is a set with maxAge 0, so the attributes have to match. These tests
 * assert exactly that, under production conditions.
 */

const ORIGINAL_ENV = process.env.NODE_ENV;

/** Load the module fresh under a chosen NODE_ENV — the options are module-level. */
async function loadUnder(env: string) {
  vi.resetModules();
  // NODE_ENV is readonly in the Node types but writable at runtime, which is the
  // only way to exercise the production branch from a test run.
  (process.env as Record<string, string>).NODE_ENV = env;
  return import("../apps/website/src/backend/lib/google-oauth");
}

afterEach(() => {
  (process.env as Record<string, string>).NODE_ENV = ORIGINAL_ENV ?? "test";
  vi.resetModules();
});

describe("OAuth handshake cookies", () => {
  it("uses the __Host- prefix in production", async () => {
    const m = await loadUnder("production");
    for (const name of m.OAUTH_TEMP_COOKIES) {
      expect(name.startsWith("__Host-"), name).toBe(true);
    }
  });

  it("CLEARS with Secure in production, or the browser rejects the delete", async () => {
    const m = await loadUnder("production");
    expect(m.oauthClearOptions.secure).toBe(true);
    expect(m.oauthClearOptions.maxAge).toBe(0);
    // __Host- also requires Path=/ and forbids a Domain attribute.
    expect(m.oauthClearOptions.path).toBe("/");
    expect("domain" in m.oauthClearOptions).toBe(false);
  });

  it("clears with the SAME attributes it sets, so the two cannot drift", async () => {
    const m = await loadUnder("production");
    const { maxAge: _clearAge, ...clearAttrs } = m.oauthClearOptions;
    expect(clearAttrs).toEqual(m.oauthCookieOptions);
  });

  it("keeps the handshake cookies httpOnly and lax on both paths", async () => {
    const m = await loadUnder("production");
    for (const opts of [m.oauthCookieOptions, m.oauthClearOptions]) {
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe("lax");
    }
  });

  it("drops the prefix and Secure outside production, where __Host- is rejected", async () => {
    const m = await loadUnder("development");
    for (const name of m.OAUTH_TEMP_COOKIES) {
      expect(name.startsWith("__Host-"), name).toBe(false);
    }
    // A Secure cookie is never stored over plain http://localhost.
    expect(m.oauthCookieOptions.secure).toBe(false);
    expect(m.oauthClearOptions.secure).toBe(false);
  });

  it("expires the handshake in minutes, not for the session", async () => {
    const m = await loadUnder("production");
    expect(m.OAUTH_COOKIE_MAX_AGE).toBeGreaterThan(0);
    expect(m.OAUTH_COOKIE_MAX_AGE).toBeLessThanOrEqual(15 * 60);
  });
});
