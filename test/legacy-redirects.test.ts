import { describe, it, expect } from "vitest";
// @ts-expect-error — generated .mjs data module, no types
import { legacyRedirects } from "../apps/website/legacy-redirects.mjs";

type Rule = { source: string; destination: string; statusCode: number };
const rules = legacyRedirects as Rule[];

const productRules = rules.filter((r) => r.source.startsWith("/product-page/") && !r.source.includes(":slug"));
const mapOf = (s: string) => productRules.find((r) => decodeURI(r.source) === `/product-page/${s}`)?.destination;

describe("legacy redirect map", () => {
  it("has no duplicate sources (a shadowed rule would silently never fire)", () => {
    const seen = rules.map((r) => r.source);
    expect(seen.filter((s, i) => seen.indexOf(s) !== i)).toEqual([]);
  });

  it("keeps the wildcards last — Next takes the first match, so an early catch-all would swallow every specific product", () => {
    const wildcard = rules.findIndex((r) => r.source === "/product-page/:slug");
    const lastSpecific = rules
      .map((r) => r.source)
      .reduce((acc, s, i) => (s.startsWith("/product-page/") && !s.includes(":slug") ? i : acc), -1);
    expect(wildcard).toBeGreaterThan(lastSpecific);
    expect(rules.at(-1)?.source).toBe("/post/:slug");
  });

  it("never redirects a product to a different material", () => {
    // The chemistry a customer searched for must survive the redirect. This is
    // the cheap slug-level backstop; the generator enforces the real rule against
    // each product's spec table.
    const MATERIALS = [
      ["platinum", "pt"],
      ["gold", "au"],
      ["graphite"],
      ["glassy"],
      ["titanium", "ti"],
      ["copper"],
      ["zinc"],
      ["aluminum"],
      ["agcl"],
      ["hgo"],
      ["hg2cl2", "calomel"],
      ["hg2so4"],
    ];
    const familyOf = (s: string) =>
      new Set(MATERIALS.filter((alts) => alts.some((a) => new RegExp(`(^|-)${a}(-|$)`).test(s))).map((a) => a[0]));

    const bad: string[] = [];
    for (const r of productRules) {
      const from = decodeURI(r.source).replace("/product-page/", "");
      const to = r.destination.replace("/shop/p/", "");
      const F = familyOf(from);
      const T = familyOf(to);
      if (F.size && T.size && ![...T].some((t) => F.has(t))) bad.push(`${from} -> ${to}`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  // Regression pins. Every one of these was WRONG in the first shipped version:
  // slug-token matching collapsed variants onto whichever catalogue slug happened
  // to be a shorter string, which is a different SKU — a platinum SHEET, a PEEK
  // Ø3 probe — not a family page. Body material and form factor decide whether
  // the part fits the customer's cell, so these must not drift back.
  it.each([
    // platinum: wire / ring / spiral must never land on the SHEET SKU
    ["platinum-wire-counter-electrode-φ1-37mm-ptfe-rod", "platinum-wire-counter-electrode-1-37-mm"],
    ["platinum-wire-counter-electrode-φ1-37mm-peek-rod", "platinum-wire-counter-electrode-1-37-mm-ptwk"],
    ["platinum-wire-ring-counter-electrode-φ0-5-230mm", "platinum-ring-counter-electrode-0-5-230-mm"],
    ["platinum-counter-electrode-with-spring-shaped-pt-wire-electrode-sheath", "platinum-spiral-counter-electrode"],
    // …while the sheet URLs still do
    ["platinum-sheet-counter-electrode-30-30-0-1mm", "platinum-counter-electrode"],
    // Ag/AgCl: glass / PTFE / PEEK bodies are three different SKUs
    ["silver-silver-chloride-ag-agcl-reference-electrode-φ6-140mm-glass-rod", "ag-agcl-reference-electrode-6-140-mm"],
    ["silver-silver-chloride-ag-agcl-reference-electrode-φ6mm-ptfe-rod", "ag-agcl-reference-electrode-6-mm"],
    ["silver-silver-chloride-ag-agcl-reference-electrode-peek-rod", "silver-silver-chloride-ag-agcl-reference-electrode"],
    // Hg/HgO: same three-body split
    ["mercury-oxide-reference-electrode-hg-hgo-galss-rod-φ6-70mm", "hg-hgo-reference-electrode-6-70-mm"],
    ["mercury-oxide-reference-electrode-hg-hgo-ptfe-rod-φ6-60mm", "hg-hgo-reference-electrode-6-60-mm"],
    ["mercury-oxide-reference-electrode-hg-hgo-peek-rod-φ4-60mm", "mercury-oxide-reference-electrode-hg-hgo"],
    // graphite: rod ≠ plate
    ["graphite-rod-counter-electrode-φ6-120mm", "graphite-rod-counter-electrode-6-80-mm"],
    ["graphite-plate-counter-electrode-10-10mm-thickness-3mm", "graphite-counter-electrode"],
    // straight vs L-shaped are different parts
    ["glassy-carbon-electrode-straight-type-ptfe-rod-φ3mm", "glassy-carbon-electrode-straight-type-ptfe-rod"],
    ["l-shaped-glassy-carbon-electrode-ptfe-rod-φ3mm", "l-shaped-glassy-carbon-disk-working-electrode-3-mm"],
  ])("maps %s to the SKU that matches its body and dimensions", (from, to) => {
    expect(mapOf(from)).toBe(`/shop/p/${to}`);
  });

  it("sends every unresolved legacy product to a real page, not a redirect chain into a 404", () => {
    expect(rules.find((r) => r.source === "/product-page/:slug")?.destination).toBe("/shop/all");
    expect(rules.find((r) => r.source === "/post/:slug")?.destination).toBe("/blog");
  });

  it("only ever redirects to internal paths", () => {
    for (const r of rules) expect(r.destination.startsWith("/")).toBe(true);
  });

  it("uses a literal 301 — Next's permanent:true emits 308, and the brief's gate (and every SEO tool) expects 301", () => {
    expect(rules.every((r) => r.statusCode === 301)).toBe(true);
  });
});
