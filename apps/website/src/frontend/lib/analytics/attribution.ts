/**
 * First-party traffic attribution — pure functions, no framework imports
 * (unit-tested from /test via relative imports, per the repo's vitest layout).
 *
 * Classification is FIRST-TOUCH per session, derived only from evidence the
 * browser actually provides: document.referrer + UTM query params. We never
 * infer beyond that — e.g. an AI platform is claimed only when the referrer
 * domain proves it, and the visitor's actual AI "question" is unknowable and
 * therefore never shown anywhere.
 */

export type TrafficSource =
  | "direct"
  | "organic"
  | "ai"
  | "social"
  | "email"
  | "paid"
  | "referral";

export type Attribution = {
  source: TrafficSource;
  /** Human channel detail: "google", "chatgpt", "linkedin", a referrer domain, or "" for direct. */
  channel: string;
  referrerDomain: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

const SEARCH_ENGINES: Record<string, string> = {
  "google.": "google",
  "bing.com": "bing",
  "yahoo.": "yahoo",
  "duckduckgo.com": "duckduckgo",
  "baidu.com": "baidu",
  "yandex.": "yandex",
  "ecosia.org": "ecosia",
  "brave.com": "brave",
};

/** AI answer/chat platforms — referrer-domain evidence only. */
const AI_PLATFORMS: Record<string, string> = {
  "chatgpt.com": "chatgpt",
  "chat.openai.com": "chatgpt",
  "openai.com": "chatgpt",
  "gemini.google.com": "gemini",
  "bard.google.com": "gemini",
  "perplexity.ai": "perplexity",
  "copilot.microsoft.com": "copilot",
  "claude.ai": "claude",
  "you.com": "you.com",
  "phind.com": "phind",
};

const SOCIAL: Record<string, string> = {
  "linkedin.": "linkedin",
  "lnkd.in": "linkedin",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "facebook.com": "facebook",
  "fb.me": "facebook",
  "instagram.com": "instagram",
  "t.co": "x",
  "x.com": "x",
  "twitter.com": "x",
  "wa.me": "whatsapp",
  "whatsapp.com": "whatsapp",
  "reddit.com": "reddit",
  "pinterest.": "pinterest",
};

/** Hostname from any URL-ish string, lowercased, no www. "" when unparsable. */
export function referrerDomain(referrer: string | null | undefined): string {
  const raw = (referrer ?? "").trim();
  if (!raw) return "";
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchMap(domain: string, map: Record<string, string>): string | undefined {
  for (const [needle, label] of Object.entries(map)) {
    if (domain === needle || domain.endsWith(needle) || domain.includes(needle)) return label;
  }
  return undefined;
}

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsocial", "paid-social", "display", "ads", "cpm"]);

/**
 * Classify a session's first touch.
 * Precedence: explicit UTM medium (paid/email) → referrer domain class →
 * utm_source hints → referral → direct.
 */
export function classifyTraffic(opts: {
  referrer?: string | null;
  /** The page's own hostname — same-host referrers are internal, i.e. direct continuation. */
  selfHost?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
}): Attribution {
  const domain = referrerDomain(opts.referrer);
  const self = (opts.selfHost ?? "").toLowerCase().replace(/^www\./, "");
  const utmSource = opts.utmSource?.trim().toLowerCase() || undefined;
  const utmMedium = opts.utmMedium?.trim().toLowerCase() || undefined;
  const utm = {
    utmSource,
    utmMedium,
    utmCampaign: opts.utmCampaign?.trim() || undefined,
    utmTerm: opts.utmTerm?.trim() || undefined,
    utmContent: opts.utmContent?.trim() || undefined,
  };
  const external = domain && domain !== self ? domain : "";

  // 1. Explicit campaign mediums win — the marketer told us what this is.
  if (utmMedium && PAID_MEDIUMS.has(utmMedium)) {
    return { source: "paid", channel: utmSource || external || "campaign", referrerDomain: external, ...utm };
  }
  if (utmMedium === "email" || utmSource === "email" || utmSource === "newsletter") {
    return { source: "email", channel: utmSource || "email", referrerDomain: external, ...utm };
  }

  // 2. Referrer-domain evidence.
  if (external) {
    const ai = matchMap(external, AI_PLATFORMS);
    if (ai) return { source: "ai", channel: ai, referrerDomain: external, ...utm };
    const engine = matchMap(external, SEARCH_ENGINES);
    if (engine) return { source: "organic", channel: engine, referrerDomain: external, ...utm };
    const social = matchMap(external, SOCIAL);
    if (social) return { source: "social", channel: social, referrerDomain: external, ...utm };
    return { source: "referral", channel: external, referrerDomain: external, ...utm };
  }

  // 3. No referrer: UTM-tagged direct entries still credit the campaign source.
  if (utmSource) {
    const ai = matchMap(utmSource, AI_PLATFORMS);
    if (ai) return { source: "ai", channel: ai, referrerDomain: "", ...utm };
    const social = matchMap(utmSource, SOCIAL);
    if (social) return { source: "social", channel: social, referrerDomain: "", ...utm };
    return { source: "referral", channel: utmSource, referrerDomain: "", ...utm };
  }

  return { source: "direct", channel: "", referrerDomain: "", ...utm };
}

// ── Device parsing (coarse, dependency-free) ─────────────────────────────────

export type DeviceInfo = { device: "mobile" | "tablet" | "desktop"; browser: string; os: string };

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  const device: DeviceInfo["device"] = /ipad|tablet|kindle|silk|playbook/i.test(s)
    ? "tablet"
    : /mobi|iphone|android.+mobile|windows phone/i.test(s)
      ? "mobile"
      : "desktop";
  const browser = /edg\//i.test(s)
    ? "Edge"
    : /opr\/|opera/i.test(s)
      ? "Opera"
      : /samsungbrowser/i.test(s)
        ? "Samsung Internet"
        : /firefox\//i.test(s)
          ? "Firefox"
          : /chrome\/|crios\//i.test(s)
            ? "Chrome"
            : /safari\//i.test(s)
              ? "Safari"
              : "Other";
  const os = /windows nt/i.test(s)
    ? "Windows"
    : /iphone|ipad|ipod|ios/i.test(s)
      ? "iOS"
      : /mac os x|macintosh/i.test(s)
        ? "macOS"
        : /android/i.test(s)
          ? "Android"
          : /linux/i.test(s)
            ? "Linux"
            : "Other";
  return { device, browser, os };
}

/** Server-side bot detection by user agent. JS-only collection already drops most crawlers. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const s = (ua ?? "").trim();
  if (!s) return true; // no UA = not a real browser
  return /bot\b|bot\/|crawl|spider|slurp|headless|phantom|lighthouse|pagespeed|pingdom|uptime|statuscake|monitor|scrap|python-requests|python-httpx|curl\/|wget\/|axios\/|go-http-client|node-fetch|okhttp|java\/|libwww|facebookexternalhit|whatsapp\/|telegrambot|preview|prerender|dataminr|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|ccbot|claudebot|amazonbot|applebot/i.test(
    s
  );
}
