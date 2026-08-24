import { describe, it, expect } from "vitest";
import { POST } from "../apps/website/src/app/api/geo/resolve/route";

/**
 * /api/geo/resolve — the boundary where a browser's coordinates become a
 * region.
 *
 * The browser knows where it is; it does not get to say what that means. These
 * cover the validation half, which runs before any outbound request: the
 * lat/lon are interpolated into a URL, so anything that is not a real
 * coordinate has to be rejected here rather than forwarded.
 *
 * The happy path calls a third-party geocoder and is therefore verified in the
 * browser rather than mocked into a shape that proves nothing.
 */
const post = (body: unknown) =>
  POST(
    new Request("https://www.metnmat.com/api/geo/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

describe("coordinate validation", () => {
  it("rejects a latitude outside ±90", async () => {
    expect((await post({ latitude: 91, longitude: 0 })).status).toBe(400);
    expect((await post({ latitude: -91, longitude: 0 })).status).toBe(400);
  });

  it("rejects a longitude outside ±180", async () => {
    expect((await post({ latitude: 0, longitude: 181 })).status).toBe(400);
    expect((await post({ latitude: 0, longitude: -181 })).status).toBe(400);
  });

  it("rejects missing coordinates", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ latitude: 12.9 })).status).toBe(400);
    expect((await post({ longitude: 77.6 })).status).toBe(400);
  });

  it("rejects values that are not numbers", async () => {
    // These are the ones that would otherwise reach a URL.
    for (const bad of ["12.9/../../etc", "NaN", "Infinity", null, true, {}, []]) {
      expect((await post({ latitude: bad, longitude: bad })).status).toBe(400);
    }
  });

  it("rejects a malformed body rather than throwing", async () => {
    expect((await post("not json")).status).toBe(400);
  });

  it("returns a structured error, never a guessed region", async () => {
    // Guessing here would put a confidently wrong currency in front of someone.
    const body = (await (await post({ latitude: 999, longitude: 999 })).json()) as Record<string, unknown>;
    expect(body.error).toBeTruthy();
    expect(body.region).toBeUndefined();
  });
});
