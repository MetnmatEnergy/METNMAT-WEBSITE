import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { alertResearchGroup, type FormAlert } from "../apps/website/src/backend/lib/group-alert";

/**
 * Form submissions also post a heads-up into the Metnmat Research WhatsApp
 * group, through the Command Center's already-linked worker. The form must
 * never notice: no config, a CC that is down, a slow CC and an offline session
 * all end as `false` and a log line, never a throw.
 */

const RFQ: FormAlert = {
  kind: "quote",
  reference: "RFQ-2026-00123",
  name: "Priya Nair",
  email: "priya@example.com",
  product: "Ag/AgCl reference electrode · qty 4",
  attachments: 2,
};

const ENV = ["COMMAND_CENTER_URL", "WEBSITE_ALERT_API_KEY"] as const;
let saved: Record<string, string | undefined>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  process.env.COMMAND_CENTER_URL = "http://127.0.0.1:3000/";
  process.env.WEBSITE_ALERT_API_KEY = "alert-test-key";
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("alertResearchGroup", () => {
  it("posts the fields to the CC notify route with the alert key", async () => {
    expect(await alertResearchGroup(RFQ)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3000/api/integrations/website/notify");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer alert-test-key");
    expect(JSON.parse(init.body as string)).toEqual(RFQ);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("is off, without a request, unless both settings are present", async () => {
    delete process.env.WEBSITE_ALERT_API_KEY;
    expect(await alertResearchGroup(RFQ)).toBe(false);
    process.env.WEBSITE_ALERT_API_KEY = "PLACEHOLDER_SET_ME";
    expect(await alertResearchGroup(RFQ)).toBe(false);
    process.env.WEBSITE_ALERT_API_KEY = "alert-test-key";
    delete process.env.COMMAND_CENTER_URL;
    expect(await alertResearchGroup(RFQ)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives a submission without a reference a one-off id", async () => {
    await alertResearchGroup({ ...RFQ, reference: undefined });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.reference).toMatch(/^WEB-[0-9A-F]{12}$/);
  });

  it("reports an offline WhatsApp session as false and logs the reason", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, unavailable: true, error: "session is not connected" }), {
        status: 503,
      }),
    );
    expect(await alertResearchGroup(RFQ)).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/HTTP 503 \(session is not connected\)/));
  });

  it("never throws: an unreachable or timed-out CC is false", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(alertResearchGroup(RFQ)).resolves.toBe(false);
    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    await expect(alertResearchGroup(RFQ)).resolves.toBe(false);
  });
});

describe("every public form alerts the group", () => {
  const route = (p: string) => readFileSync(new URL(`../apps/website/src/app/api/${p}/route.ts`, import.meta.url), "utf8");

  it.each(["quote", "contact", "support", "blog/submit"])("/api/%s calls alertResearchGroup", (p) => {
    expect(route(p)).toMatch(/void (?:alertResearchGroup\(|checkEmailSanity\()/);
    expect(route(p)).toContain("alertResearchGroup({");
  });

  it("the support alert never carries the customer's email or phone", () => {
    const call = /alertResearchGroup\(\{[\s\S]*?\}\);/.exec(route("support"))?.[0] ?? "";
    expect(call).toContain('kind: "support"');
    expect(call).not.toMatch(/\bemail\b|\bphone\b/);
  });
});
