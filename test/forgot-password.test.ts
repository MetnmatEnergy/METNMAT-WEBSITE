import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Password reset has to keep two things apart that the route was conflating.
 *
 * NOT revealing whether an account exists is correct and must not regress: an
 * endpoint that answers differently for a known and an unknown address is an
 * account-enumeration oracle.
 *
 * But the catch-all also swallowed OUR OWN failures. A CMS that was down, or
 * answering 500, still produced "Check your email" — so the customer waited for
 * a mail that had not been sent and never would be, with no way to find out but
 * to keep waiting. A transport failure is information about us, not about the
 * account, so reporting it reveals nothing.
 */

const realFetch = globalThis.fetch;

vi.mock("@/backend/lib/rate-limit", () => ({
  limitRate: vi.fn(async () => ({ ok: true })),
  clientIp: vi.fn(() => "203.0.113.11"),
}));

let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  ({ POST } = await import("@/app/api/account/forgot/route"));
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const ask = (email: string) =>
  POST(
    new Request("https://www.metnmat.com/api/account/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  );

describe("POST /api/account/forgot", () => {
  it("succeeds when the CMS accepts the request", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const res = await ask("known@customer.test");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it("answers a KNOWN and an UNKNOWN address identically", async () => {
    // The enumeration guarantee. Payload answers the same either way and so
    // must we — including for a 404, which is not our failure.
    const responses = [200, 404];
    const seen: Array<{ status: number; body: unknown }> = [];
    for (const status of responses) {
      globalThis.fetch = vi.fn(
        async () => new Response("{}", { status })
      ) as unknown as typeof fetch;
      vi.resetModules();
      ({ POST } = await import("@/app/api/account/forgot/route"));
      const res = await ask("someone@customer.test");
      seen.push({ status: res.status, body: await res.json() });
    }
    expect(seen[0]).toEqual(seen[1]);
  });

  it("does NOT claim success when the CMS is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const res = await ask("known@customer.test");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
    // The message must not hint at whether the account exists.
    expect(body.error!.toLowerCase()).not.toMatch(/account|exist|found|unknown/);
  });

  it("does NOT claim success when the CMS answers 500", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("boom", { status: 500 })
    ) as unknown as typeof fetch;
    const res = await ask("known@customer.test");
    expect(res.status).toBe(502);
  });

  it("still refuses an empty email", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const res = await ask("   ");
    expect(res.status).toBe(400);
  });
});

describe("rate limiting is not weakened by the change", () => {
  /** Fail only the per-EMAIL budget, leaving the per-IP one open. */
  async function loadWithEmailThrottled() {
    vi.resetModules();
    vi.doMock("@/backend/lib/rate-limit", () => ({
      limitRate: vi.fn(async (key: string) =>
        key.startsWith("forgot:email:") ? { ok: false, retryAfter: 60 } : { ok: true }
      ),
      clientIp: vi.fn(() => "203.0.113.11"),
    }));
    return import("@/app/api/account/forgot/route");
  }

  it("hides a per-EMAIL throttle behind an ordinary success", async () => {
    // This one must stay opaque: answering differently for a throttled address
    // would make the throttle itself the enumeration oracle, since only an
    // address someone has been hammering reaches its limit.
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    const mod = await loadWithEmailThrottled();
    const res = await mod.POST(
      new Request("https://www.metnmat.com/api/account/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "spammed@customer.test" }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    // And it must not spend a CMS call doing it.
    expect(spy).not.toHaveBeenCalled();
    vi.doUnmock("@/backend/lib/rate-limit");
  });

  it("still answers a per-IP flood with 429, which reveals nothing about accounts", async () => {
    vi.resetModules();
    vi.doMock("@/backend/lib/rate-limit", () => ({
      limitRate: vi.fn(async () => ({ ok: false, retryAfter: 60 })),
      clientIp: vi.fn(() => "203.0.113.11"),
    }));
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const mod = await import("@/app/api/account/forgot/route");
    const res = await mod.POST(
      new Request("https://www.metnmat.com/api/account/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "anyone@customer.test" }),
      })
    );
    expect(res.status).toBe(429);
    vi.doUnmock("@/backend/lib/rate-limit");
  });
});
