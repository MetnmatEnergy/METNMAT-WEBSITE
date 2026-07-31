import { describe, it, expect } from "vitest";
// @ts-expect-error — generated .mjs data module, no types
import { legacyRedirects } from "../apps/website/legacy-redirects.mjs";

type Rule = { source: string; destination: string; permanent: boolean };
const rules = legacyRedirects as Rule[];

const productRules = rules.filter((r) => r.source.startsWith("/product-page/"));
const specific = productRules.filter((r) => !r.source.includes(":slug"));

// Identity-free words: they appear in most lab-equipment slugs, so they must
// never be what makes two different products look like the same product.
const STOP = new Set(["the", "of", "for", "and", "with", "a", "to", "in", "cell", "set", "setup", "unit"]);
const tok = (s: string) => new Set(s.split("-").filter((w) => w && !STOP.has(w)));

describe("legacy redirect map", () => {
  it("has no duplicate sources (a shadowed rule would silently never fire)", () => {
    const seen = rules.map((r) => r.source);
    expect(seen.filter((s, i) => seen.indexOf(s) !== i)).toEqual([]);
  });

  it("keeps the wildcards last — Next takes the first match, so an early catch-all would swallow every specific product", () => {
    const wildcard = rules.findIndex((r) => r.source === "/product-page/:slug");
    const lastSpecific = rules.map((r) => r.source).reduce((acc, s, i) => (s.startsWith("/product-page/") && !s.includes(":slug") ? i : acc), -1);
    expect(wildcard).toBeGreaterThan(lastSpecific);
    expect(rules.at(-1)?.source).toBe("/post/:slug");
  });

  it("never redirects a product to a DIFFERENT material", () => {
    // Every specific mapping must be provable: the destination is either a
    // prefix of the source (a truncated import) or its identity tokens are a
    // subset of the source's (a size/rod variant collapsing to its base
    // product). Anything else — e.g. a gold electrode pointed at a glassy
    // carbon one — is a factual error shown to a paying customer.
    const violations: string[] = [];
    for (const r of specific) {
      const from = decodeURI(r.source.replace("/product-page/", ""));
      const to = r.destination.replace("/shop/p/", "");
      if (from.startsWith(to)) continue;
      const F = tok(from);
      if ([...tok(to)].every((t) => F.has(t))) continue;
      violations.push(`${from} -> ${to}`);
    }
    // Deduped: slugs containing "φ" are emitted in both raw and percent-encoded
    // form, which decode to the same logical mapping.
    // The hand-verified pairs (abbreviation expansions / reordered specs) are
    // the only allowed exceptions; each was checked against both product names.
    expect([...new Set(violations)].sort()).toEqual(
      [
        "detachable-l-shaped-platinum-disk-electrode-φ4mm -> detachable-l-shaped-platinum-disk-electrode-4-mm",
        "kamoer-kcp-x-mini-peristaltic-pump-24v-with-control-low-flow-rate-19-65ml-min-ad -> kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control",
        "microbial-fuel-cell-stack -> microbial-fuel-cell-stack-ma-mfc-5",
        "pfsa-proton-exchange-membrane-n115-100x100-mm -> perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n115-pem",
        "photovoltaic-biased-photoelectrochemical-cell -> photovoltaic-pv-biased-photoelectrochemical-cell-pec",
      ].sort()
    );
  });

  it("sends every unresolved legacy product to a real page, not a redirect chain into a 404", () => {
    expect(rules.find((r) => r.source === "/product-page/:slug")?.destination).toBe("/shop/all");
    expect(rules.find((r) => r.source === "/post/:slug")?.destination).toBe("/blog");
  });

  it("only ever redirects to internal paths", () => {
    for (const r of rules) expect(r.destination.startsWith("/")).toBe(true);
  });

  it("is permanent throughout — these moves are final", () => {
    expect(rules.every((r) => r.permanent)).toBe(true);
  });
});
