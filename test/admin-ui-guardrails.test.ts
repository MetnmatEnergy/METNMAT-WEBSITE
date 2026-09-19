import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { IMAGE_GUIDANCE, checkImageFile, formatBytes } from "../apps/dashboard/src/lib/image-guidance";
import { PRODUCT_IMAGE_SPEC } from "../apps/dashboard/src/hooks/product-image-spec";
import { MAX_UPLOAD_MB, MAX_UPLOAD_BYTES } from "../apps/dashboard/src/lib/upload-limit";

/**
 * Structural guardrails for the admin's responsive layer and the upload size
 * guide (2026-09-19).
 *
 * The dashboard home and the analytics views are server components styled
 * inline, and inline styles cannot carry media queries. Their two-column
 * sections therefore opt into classes that custom-admin.css collapses on
 * phones. Nothing else enforces that contract: an inline
 * `gridTemplateColumns: "minmax(0, 1.7fr) …"` added back in a later edit
 * would render two cramped columns on a 375px screen and no test would
 * notice. These do.
 *
 * The size guide is the other half: it tells staff the rules BEFORE they
 * upload, so it must state the numbers the server actually enforces.
 */

const ROOT = join(__dirname, "..");
const CMS = join(ROOT, "apps", "dashboard", "src");
const read = (p: string) => readFileSync(join(CMS, p), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");

describe("the dashboard home is responsive through classes, not inline grids", () => {
  const home = stripComments(read("admin/BeforeDashboard.tsx"));
  const css = read("app/(payload)/custom-admin.css");

  it("uses the split class for every two-column section", () => {
    expect(home).not.toMatch(/gridTemplateColumns:\s*"minmax\(0, 1\.7fr\)/);
    expect((home.match(/className="mn-split"/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("the KPI row and action bar are class-driven too", () => {
    expect(home).toMatch(/className="mn-kpis"/);
    expect(home).toMatch(/className="mn-actions"/);
    expect(home).toMatch(/className="mn-panel mn-kpi"/);
  });

  it("the stylesheet collapses those grids to one column below 900px", () => {
    // Single column is the DEFAULT; two columns are opted into at ≥900px.
    expect(css).toMatch(/\.mn-split, \.mn-a-split, \.mn-a-split-rev \{[^}]*grid-template-columns: 1fr;/);
    expect(css).toMatch(/@media \(min-width: 900px\) \{\s*\.mn-split, \.mn-a-split \{ grid-template-columns: minmax\(0, 1\.7fr\) minmax\(0, 1fr\); \}/);
    expect(css).toMatch(/\.mn-panel \{[^}]*background: var\(--theme-elevation-50\)/);
  });

  it("phones get a two-up KPI grid, then one-up on the narrowest screens", () => {
    expect(css).toMatch(/@media \(max-width: 767px\) \{[\s\S]*?\.mn-kpis \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 340px\) \{\s*\.mn-kpis \{ grid-template-columns: 1fr; \}/);
  });

  it("tables scroll inside Payload's container: min-width sits on <table>, never on .table", () => {
    // `.table { min-width: 640px }` made the scroll container itself wider than
    // the phone, so the right-hand columns were clipped instead of scrollable.
    expect(css).toMatch(/\.table table \{ min-width: 640px; \}/);
    expect(css).not.toMatch(/\.table \{[^}]*min-width: 640px/);
  });

  it("small pill buttons keep their size on phones — the 44px floor collided with titles", () => {
    expect(css).toMatch(/\.btn:not\(\.btn--size-small\) \{ min-height: 44px; \}/);
  });
});

describe("the sidebar is ordered and dressed as the owner asked (2026-09-19)", () => {
  const config = stripComments(read("payload.config.ts"));
  const css = read("app/(payload)/custom-admin.css");
  const logo = stripComments(read("admin/NavLogo.tsx"));

  it("Catalog is the first group: Products lead the collections array", () => {
    const arr = /collections: \[([\s\S]*?)\],/.exec(config)![1];
    const names = arr.split(",").map((s) => s.trim()).filter(Boolean);
    expect(names.slice(0, 5)).toEqual(["Products", "Categories", "StockLedger", "ProductSlugRedirects", "CategorySlugRedirects"]);
    expect(names.indexOf("Orders")).toBeGreaterThan(names.indexOf("CategorySlugRedirects"));
  });

  it("the technical collections sit in a System group at the end, not among staff administration", () => {
    for (const f of ["Counters", "AnalyticsEvents", "AnalyticsSessions", "AnalyticsDaily", "IntegrationLogs"]) {
      expect(read(`collections/${f}.ts`), f).toMatch(/group: "System"/);
    }
    for (const f of ["Users", "StaffRoles", "AuditLogs", "DataRequests"]) {
      expect(read(`collections/${f}.ts`), f).toMatch(/group: "Administration"/);
    }
    const arr = /collections: \[([\s\S]*?)\],/.exec(config)![1];
    const names = arr.split(",").map((s) => s.trim()).filter(Boolean);
    expect(names.slice(-5).sort()).toEqual(["AnalyticsDaily", "AnalyticsEvents", "AnalyticsSessions", "Counters", "IntegrationLogs"].sort());
  });

  it("the staff list no longer shows the always-empty PIN column", () => {
    const users = stripComments(read("collections/Users.ts"));
    const cols = /defaultColumns: \[([^\]]+)\]/.exec(users)![1];
    expect(cols).not.toContain('"pin"');
  });

  it("the brand row is a compact lockup, not a full-width logo card", () => {
    expect(logo).toMatch(/className="mn-brand"/);
    expect(logo).toMatch(/metnmat-mark\.png/);
    expect(logo).not.toMatch(/metnmat-logo\.png/);
    expect(css).toMatch(/\.mn-brand \{[^}]*height: 52px/);
  });

  it("every sidebar entry has an icon, keyed by the id DefaultNav assigns", () => {
    const collections = readdirSync(join(CMS, "collections"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => /slug: "([^"]+)"/.exec(read(`collections/${f}`))?.[1])
      .filter((s): s is string => Boolean(s));
    expect(collections.length).toBeGreaterThan(30);
    for (const slug of collections) expect(css, slug).toContain(`#nav-${slug}`);
    for (const g of ["branding", "company", "contact", "social", "seo", "commerce", "homepage", "maintenance", "navigation", "privacy"]) {
      expect(css, g).toContain(`#nav-global-${g}`);
    }
    expect(css).toMatch(/\.nav__link::before \{[\s\S]*?mask: var\(--mn-icon, var\(--mn-icon-dot\)\)/);
  });

  it("both palettes define the sidebar tokens", () => {
    const dark = css.slice(css.indexOf('html[data-theme="dark"]'), css.indexOf('html[data-theme="light"]'));
    const light = css.slice(css.indexOf('html[data-theme="light"]'), css.indexOf("/* ── Base typography"));
    for (const t of ["--mn-nav-bg", "--mn-nav-border", "--mn-nav-muted", "--mn-nav-link", "--mn-nav-hover", "--mn-nav-active", "--mn-nav-active-text"]) {
      expect(dark, `dark ${t}`).toContain(`${t}:`);
      expect(light, `light ${t}`).toContain(`${t}:`);
    }
  });
});

describe("the overview route is phone-safe and themed", () => {
  const layout = read("app/(overview)/layout.tsx");
  const page = stripComments(read("app/(overview)/page.tsx"));

  it("declares a viewport — without it a phone renders the page at desktop width", () => {
    expect(layout).toMatch(/export const viewport: Viewport = \{ width: "device-width", initialScale: 1/);
  });

  it("shares the admin stylesheet and paints from its tokens, not fixed dark hexes", () => {
    expect(layout).toMatch(/import "\.\.\/\(payload\)\/custom-admin\.css"/);
    const hexes = (page.match(/#[0-9a-f]{6}\b/gi) ?? []).map((h) => h.toLowerCase());
    expect(new Set(hexes)).toEqual(new Set(["#d81f26"])); // brand only
  });
});

describe("the login screen says which door is which", () => {
  const login = stripComments(read("admin/PinLogin.tsx"));
  const css = read("app/(payload)/custom-admin.css");

  it("states that the key is the whole sign-in and that recovery is for PIN-less accounts", () => {
    expect(login).toMatch(/There is no email or password to type/);
    expect(login).toMatch(/Recovery accounts only\./);
  });

  it("turns a 429 into a countdown from Retry-After and disables the pad meanwhile", () => {
    expect(login).toMatch(/res\.status === 429/);
    expect(login).toMatch(/res\.headers\.get\("Retry-After"\)/);
    expect(login).toMatch(/disabled=\{disabled\}/);
    expect(login).toMatch(/const disabled = loading \|\| locked;/);
  });

  it("styles the pad from the stylesheet so it follows both palettes and phone widths", () => {
    expect(login).not.toMatch(/style=\{\{\s*width: 56/);
    expect(css).toMatch(/\.mn-pin__digit \{/);
    expect(css).toMatch(/@media \(max-width: 380px\) \{\s*\.mn-pin__pad \{ gap: 8px; \}/);
  });
});

describe("the image size guide states the rules the server enforces", () => {
  it("matches the product resolution floor and the upload ceiling exactly", () => {
    expect(IMAGE_GUIDANCE.productMinShortSide).toBe(PRODUCT_IMAGE_SPEC.minShortSide);
    expect(IMAGE_GUIDANCE.productBest).toEqual({ width: PRODUCT_IMAGE_SPEC.minWidth, height: (PRODUCT_IMAGE_SPEC.minWidth * 3) / 4 });
    expect(IMAGE_GUIDANCE.maxMb).toBe(MAX_UPLOAD_MB);
    expect(IMAGE_GUIDANCE.maxMb * 1_000_000).toBe(MAX_UPLOAD_BYTES);
    expect(IMAGE_GUIDANCE.warnKb * 1024).toBe(PRODUCT_IMAGE_SPEC.warnBytes);
  });

  it("lists exactly the raster formats Media accepts", () => {
    const media = read("collections/Media.ts");
    const mimes = /mimeTypes: \[([^\]]+)\]/.exec(media)![1];
    for (const f of ["png", "jpeg", "webp", "avif"]) expect(mimes).toContain(`image/${f}`);
    expect(IMAGE_GUIDANCE.formats).toEqual(["JPG", "PNG", "WebP", "AVIF"]);
  });

  it("refuses over the ceiling, refuses a small product photo, warns a heavy one, passes the rest", () => {
    expect(checkImageFile({ bytes: 26_000_000, width: 4000, height: 3000 }, true).level).toBe("bad");
    expect(checkImageFile({ bytes: 200_000, width: 1200, height: 800 }, true).level).toBe("bad");
    expect(checkImageFile({ bytes: 900_000, width: 3000, height: 2000 }, true).level).toBe("warn");
    expect(checkImageFile({ bytes: 200_000, width: 3000, height: 2000 }, true).level).toBe("ok");
    // A banner has no floor and no weight warning.
    expect(checkImageFile({ bytes: 900_000, width: 1200, height: 400 }, false).level).toBe("ok");
    // No dimensions (decode failed): the server decides; do not guess "bad".
    expect(checkImageFile({ bytes: 200_000 }, true).level).toBe("ok");
  });

  it("formats sizes the way the sentence expects", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(48_000)).toBe("48 KB");
    expect(formatBytes(2_800_000)).toBe("2.8 MB");
    expect(formatBytes(12_400_000)).toBe("12 MB");
  });
});

describe("the size guide is wired into the media form and the import map", () => {
  const media = stripComments(read("collections/Media.ts"));
  const importMap = read("app/(payload)/admin/importMap.js");

  it("Media renders the hint as its first field and shows size columns in the list", () => {
    const first = /fields: \[\s*\{[\s\S]*?\}/.exec(media)![0];
    expect(first).toMatch(/name: "uploadSizeHint"/);
    expect(first).toMatch(/type: "ui"/);
    expect(first).toMatch(/Field: "\/admin\/UploadSizeHint"/);
    expect(media).toMatch(/defaultColumns: \["filename", "category", "width", "height", "filesize"/);
  });

  it("the import map carries the component — a missing entry renders nothing, silently", () => {
    expect(importMap).toMatch(/from '\.\.\/\.\.\/\.\.\/admin\/UploadSizeHint'/);
    expect(importMap).toMatch(/"\/admin\/UploadSizeHint#default":/);
  });

  it("and still carries both storage adapters (CLAUDE.md gotcha 2)", () => {
    // Lines, as the runbook's `grep -c` counts them: two imports + two map
    // entries. A running `next dev` rewrites this file and drops them to 0.
    const lines = importMap.split("\n").filter((l) => l.includes("ClientUploadHandler"));
    expect(lines.length).toBe(4);
  });
});
