import { describe, it, expect } from "vitest";
import {
  classifyTraffic,
  referrerDomain,
  parseUserAgent,
  isBotUserAgent,
} from "../apps/website/src/frontend/lib/analytics/attribution";

const SELF = "www.metnmat.com";

describe("referrerDomain", () => {
  it("extracts a lowercased hostname without www", () => {
    expect(referrerDomain("https://WWW.Google.com/search?q=x")).toBe("google.com");
    expect(referrerDomain("https://chatgpt.com/")).toBe("chatgpt.com");
  });

  it("returns empty for missing or unparsable referrers", () => {
    expect(referrerDomain("")).toBe("");
    expect(referrerDomain(null)).toBe("");
    expect(referrerDomain(undefined)).toBe("");
    expect(referrerDomain("not a url")).toBe("");
  });
});

describe("classifyTraffic", () => {
  it("no referrer, no utm → direct", () => {
    const a = classifyTraffic({ referrer: "", selfHost: SELF });
    expect(a.source).toBe("direct");
    expect(a.channel).toBe("");
  });

  it("same-host referrer is internal navigation → direct", () => {
    const a = classifyTraffic({ referrer: "https://www.metnmat.com/products", selfHost: SELF });
    expect(a.source).toBe("direct");
  });

  it("search engines → organic with engine channel", () => {
    expect(classifyTraffic({ referrer: "https://www.google.com/", selfHost: SELF }).source).toBe("organic");
    expect(classifyTraffic({ referrer: "https://www.google.co.in/", selfHost: SELF }).channel).toBe("google");
    expect(classifyTraffic({ referrer: "https://www.bing.com/search", selfHost: SELF }).channel).toBe("bing");
    expect(classifyTraffic({ referrer: "https://duckduckgo.com/", selfHost: SELF }).channel).toBe("duckduckgo");
  });

  it("AI platforms are claimed only on referrer evidence", () => {
    const gpt = classifyTraffic({ referrer: "https://chatgpt.com/", selfHost: SELF });
    expect(gpt.source).toBe("ai");
    expect(gpt.channel).toBe("chatgpt");
    expect(classifyTraffic({ referrer: "https://gemini.google.com/app", selfHost: SELF }).channel).toBe("gemini");
    expect(classifyTraffic({ referrer: "https://www.perplexity.ai/", selfHost: SELF }).channel).toBe("perplexity");
    expect(classifyTraffic({ referrer: "https://copilot.microsoft.com/", selfHost: SELF }).channel).toBe("copilot");
    expect(classifyTraffic({ referrer: "https://claude.ai/", selfHost: SELF }).channel).toBe("claude");
  });

  it("gemini.google.com is AI, not organic (AI checked before engines)", () => {
    expect(classifyTraffic({ referrer: "https://gemini.google.com/", selfHost: SELF }).source).toBe("ai");
  });

  it("social domains → social", () => {
    expect(classifyTraffic({ referrer: "https://www.linkedin.com/feed", selfHost: SELF }).channel).toBe("linkedin");
    expect(classifyTraffic({ referrer: "https://lnkd.in/abc", selfHost: SELF }).source).toBe("social");
    expect(classifyTraffic({ referrer: "https://t.co/xyz", selfHost: SELF }).channel).toBe("x");
    expect(classifyTraffic({ referrer: "https://wa.me/919999", selfHost: SELF }).channel).toBe("whatsapp");
  });

  it("unknown external domain → referral with domain as channel", () => {
    const a = classifyTraffic({ referrer: "https://some-lab.ac.in/links", selfHost: SELF });
    expect(a.source).toBe("referral");
    expect(a.channel).toBe("some-lab.ac.in");
    expect(a.referrerDomain).toBe("some-lab.ac.in");
  });

  it("paid utm_medium wins over referrer classification", () => {
    const a = classifyTraffic({
      referrer: "https://www.google.com/",
      selfHost: SELF,
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "electrodes-q3",
    });
    expect(a.source).toBe("paid");
    expect(a.channel).toBe("google");
    expect(a.utmCampaign).toBe("electrodes-q3");
  });

  it("email medium/source → email", () => {
    expect(classifyTraffic({ selfHost: SELF, utmMedium: "email" }).source).toBe("email");
    expect(classifyTraffic({ selfHost: SELF, utmSource: "newsletter" }).source).toBe("email");
  });

  it("utm_source hints classify no-referrer entries (AI apps strip referrers)", () => {
    expect(classifyTraffic({ selfHost: SELF, utmSource: "chatgpt.com" }).source).toBe("ai");
    expect(classifyTraffic({ selfHost: SELF, utmSource: "linkedin." }).source).toBe("social");
    expect(classifyTraffic({ selfHost: SELF, utmSource: "partner-site" }).source).toBe("referral");
  });

  it("preserves utm fields on the attribution", () => {
    const a = classifyTraffic({ selfHost: SELF, utmSource: "X", utmMedium: "CPC", utmTerm: "ref electrode" });
    expect(a.utmSource).toBe("x"); // normalised lowercase
    expect(a.utmMedium).toBe("cpc");
    expect(a.utmTerm).toBe("ref electrode");
  });
});

describe("parseUserAgent", () => {
  const CHROME_WIN =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const SAFARI_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const CHROME_ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  const IPAD =
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const EDGE_WIN =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";

  it("classifies device / browser / os", () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({ device: "desktop", browser: "Chrome", os: "Windows" });
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ device: "mobile", browser: "Safari", os: "iOS" });
    expect(parseUserAgent(CHROME_ANDROID)).toEqual({ device: "mobile", browser: "Chrome", os: "Android" });
    expect(parseUserAgent(IPAD).device).toBe("tablet");
    expect(parseUserAgent(EDGE_WIN).browser).toBe("Edge");
  });

  it("handles empty UA gracefully", () => {
    expect(parseUserAgent("")).toEqual({ device: "desktop", browser: "Other", os: "Other" });
  });
});

describe("isBotUserAgent", () => {
  it("flags crawlers, tools and AI bots", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "curl/8.4.0",
      "python-requests/2.31",
      "axios/1.6.0",
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/126.0.0.0",
      "GPTBot/1.0",
      "ClaudeBot/1.0",
      "facebookexternalhit/1.1",
      "", // no UA at all = not a browser
    ]) {
      expect(isBotUserAgent(ua), ua || "(empty)").toBe(true);
    }
  });

  it("passes real browsers", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      )
    ).toBe(false);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
      )
    ).toBe(false);
  });
});
