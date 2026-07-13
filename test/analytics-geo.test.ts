import { afterEach, describe, expect, it, vi } from "vitest";
import {
  geoAnalyticsConfigured,
  lookupGeo,
} from "../apps/website/src/backend/services/analytics.service";
import { ingestAnalyticsBatch } from "../apps/dashboard/src/hooks/analytics-ingest";

const originalToken = process.env.ANALYTICS_GEO_TOKEN;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalToken === undefined) delete process.env.ANALYTICS_GEO_TOKEN;
  else process.env.ANALYTICS_GEO_TOKEN = originalToken;
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  vi.unstubAllGlobals();
});

describe("IPinfo Lite analytics geography", () => {
  it("reports disabled and skips lookup when the token is absent", async () => {
    delete process.env.ANALYTICS_GEO_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(geoAnalyticsConfigured()).toBe(false);
    await expect(lookupGeo("203.0.113.10")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the Lite endpoint, Bearer auth and site referrer", async () => {
    process.env.ANALYTICS_GEO_TOKEN = "  test-ipinfo-token  ";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.metnmat.com/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ country_code: "IN", country: "India" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(geoAnalyticsConfigured()).toBe(true);
    await expect(lookupGeo("203.0.113.11")).resolves.toEqual({ country: "India" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.ipinfo.io/lite/203.0.113.11");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-ipinfo-token",
      Referer: "https://www.metnmat.com/",
    });
  });
});

describe("analytics geo backfill", () => {
  it("updates geography on an existing session from batch-level enrichment", async () => {
    const insertMany = vi.fn().mockResolvedValue(undefined);
    const sessionUpsert = vi.fn().mockResolvedValue(undefined);
    const dailyUpsert = vi.fn().mockResolvedValue(undefined);
    const payload = {
      db: {
        collections: {
          "analytics-events": { insertMany },
          "analytics-sessions": { findOneAndUpdate: sessionUpsert },
          "analytics-daily": { findOneAndUpdate: dailyUpsert },
        },
      },
    };

    await ingestAnalyticsBatch(payload as never, {
      vid: "visitor-123456",
      sid: "session-123456",
      geo: { country: "India" },
      events: [{ type: "page_view", ts: Date.now(), path: "/shop" }],
      // Intentionally no newSession: this session began before geo was enabled.
    });

    expect(sessionUpsert).toHaveBeenCalledTimes(1);
    const [, update] = sessionUpsert.mock.calls[0] as [
      unknown,
      {
        $set: Record<string, unknown>;
        $setOnInsert: Record<string, unknown>;
      },
    ];
    expect(update.$set.country).toBe("India");
    expect(update.$setOnInsert).not.toHaveProperty("country");
  });
});
