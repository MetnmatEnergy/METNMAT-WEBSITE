import { describe, it, expect } from "vitest";
import { productMetaDescription } from "../apps/website/src/frontend/lib/seo";

/**
 * All 68 catalogue products ship with `metaDescription` unset, so every one fell
 * back to `shortDesc` — which is written per product FAMILY, not per SKU. Four
 * descriptions were byte-identical across 11 URLs, and 59 of 68 ran past
 * Google's ~155-character display limit.
 *
 * The three fixtures below are the real Ag/AgCl records that collided in
 * production, verbatim from the CMS: same family prose, genuinely different
 * hardware.
 */
const FAMILY_DESC =
  "The Ag/AgCl Reference Electrode is the industry-standard reference electrode for aqueous electrochemistry, offering a stable and highly reproducible potential across a wide range of experimental conditions.";

const AGCL_GLASS = {
  shortDesc: FAMILY_DESC,
  specs: [
    { label: "liquid junction core", value: "microporous ceramic filter core" },
    { label: "filling solution", value: "3M/3.5M KCl" },
    { label: "Reference Potential", value: "+0.197 V vs. SHE" },
  ],
};
const AGCL_PTFE = {
  shortDesc: FAMILY_DESC,
  specs: [
    { label: "tube diameter", value: "6 mm" },
    { label: "effective length", value: "60 mm" },
    { label: "liquid junction core", value: "Porous PTFE core" },
  ],
};
const AGCL_PEEK = {
  shortDesc: FAMILY_DESC,
  specs: [
    { label: "Body / Material", value: "PEEK" },
    { label: "tube diameter", value: "3 mm" },
    { label: "effective length", value: "60 mm" },
  ],
};

describe("productMetaDescription", () => {
  it("gives three SKUs that share one family description three different descriptions", () => {
    const out = [AGCL_GLASS, AGCL_PTFE, AGCL_PEEK].map(productMetaDescription);
    expect(new Set(out).size).toBe(3);
  });

  it("leads with the specs that actually distinguish the SKU", () => {
    expect(productMetaDescription(AGCL_PEEK)).toContain("Body / Material: PEEK");
    expect(productMetaDescription(AGCL_PTFE)).toContain("Tube diameter: 6 mm");
    expect(productMetaDescription(AGCL_GLASS)).toContain("microporous ceramic filter core");
  });

  it("keeps the family prose after the specs — the specs add to it, they don't replace it", () => {
    expect(productMetaDescription(AGCL_PTFE)).toContain("Ag/AgCl Reference Electrode");
  });

  it("never exceeds Google's display limit", () => {
    for (const p of [AGCL_GLASS, AGCL_PTFE, AGCL_PEEK]) {
      expect(productMetaDescription(p).length).toBeLessThanOrEqual(155);
    }
  });

  it("returns a CMS override completely untouched, however long", () => {
    const override = `x${"y".repeat(400)}`;
    expect(productMetaDescription({ metaDescription: override, shortDesc: "ignored" })).toBe(override);
  });

  it("prefers an override even when it is only whitespace-padded", () => {
    expect(productMetaDescription({ metaDescription: "  Real copy.  ", shortDesc: "fallback" })).toBe("Real copy.");
  });

  it("truncates at a word boundary, never mid-word", () => {
    const out = productMetaDescription({ shortDesc: `${"alpha ".repeat(60)}omega` });
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/alph…$/);
    expect(out.replace(/…$/, "").trim().split(" ").at(-1)).toBe("alpha");
  });

  it("leaves a already-short description alone — no ellipsis, no spec prefix invented", () => {
    expect(productMetaDescription({ shortDesc: "A short one." })).toBe("A short one.");
  });

  it("falls back to prose alone when the product has no specs", () => {
    const out = productMetaDescription({ shortDesc: FAMILY_DESC, specs: [] });
    expect(out.startsWith("The Ag/AgCl")).toBe(true);
  });

  it("skips spec rows missing a label or a value rather than emitting 'undefined'", () => {
    const out = productMetaDescription({
      shortDesc: "Prose.",
      specs: [{ label: "Body", value: "" }, { value: "orphan" }, { label: "Tube diameter", value: "3 mm" }],
    });
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("orphan");
    expect(out).toContain("Tube diameter: 3 mm");
  });

  it("caps the spec prefix so it cannot crowd out the prose", () => {
    const out = productMetaDescription({
      shortDesc: "The prose that must survive.",
      specs: Array.from({ length: 9 }, (_, i) => ({ label: `Spec number ${i}`, value: `value ${i}` })),
    });
    expect(out).toContain("The prose");
  });

  it("handles a product with neither specs nor prose without throwing", () => {
    expect(productMetaDescription({})).toBe("");
  });

  // The two pairs below were still colliding after the first attempt, which took
  // the first three specs in CMS order. Sibling SKUs share their opening specs
  // and split further down, so specs are ranked before slicing.
  it("reaches past the shared opening specs to the body material that splits a pair", () => {
    const shared = [
      { label: "electrode material", value: "Platinum 99.95%" },
      { label: "wire diameter", value: "500 µm" },
      { label: "wire length", value: "37 mm" },
    ];
    const peek = productMetaDescription({ shortDesc: "Prose.", specs: [...shared, { label: "body material", value: "PEEK" }] });
    const ptfe = productMetaDescription({ shortDesc: "Prose.", specs: [...shared, { label: "body material", value: "PTFE" }] });
    expect(peek).not.toBe(ptfe);
    expect(peek).toContain("PEEK");
    expect(ptfe).toContain("PTFE");
  });

  it("reaches a body material sitting sixth, past five identical rows", () => {
    const shared = Array.from({ length: 5 }, (_, i) => ({ label: `Shared ${i}`, value: `same ${i}` }));
    const a = productMetaDescription({ shortDesc: "P.", specs: [...shared, { label: "Body Material", value: "Glass" }] });
    const b = productMetaDescription({ shortDesc: "P.", specs: [...shared, { label: "Body Material", value: "PTFE" }] });
    expect(a).not.toBe(b);
  });

  it("ranks material first, then dimensions, and drops unrelated specs once the three slots are full", () => {
    const out = productMetaDescription({
      shortDesc: "P.",
      specs: [
        { label: "Applications", value: "Cyclic Voltammetry" },
        { label: "Tube diameter", value: "3 mm" },
        { label: "Effective length", value: "60 mm" },
        { label: "Body Material", value: "PEEK" },
      ],
    });
    expect(out.indexOf("Body Material")).toBeLessThan(out.indexOf("Tube diameter"));
    expect(out.indexOf("Tube diameter")).toBeLessThan(out.indexOf("Effective length"));
    // Four candidates, three slots — the unranked one is the one that loses.
    expect(out).not.toContain("Applications");
  });

  it("does not print the same spec twice when the CMS holds punctuation variants of one label", () => {
    const out = productMetaDescription({
      shortDesc: "P.",
      specs: [
        { label: "Body / Material", value: "PEEK" },
        { label: "Body Material", value: "PEEK" },
        { label: "Tube diameter", value: "3 mm" },
      ],
    });
    expect(out).toContain("Body / Material: PEEK");
    expect(out).not.toContain("Body Material: PEEK");
    expect(out).toContain("Tube diameter: 3 mm");
  });

  it("keeps two genuinely different specs that happen to share a value", () => {
    const out = productMetaDescription({
      shortDesc: "P.",
      specs: [
        { label: "Body diameter", value: "6 mm" },
        { label: "Tube diameter", value: "6 mm" },
      ],
    });
    expect(out).toContain("Body diameter: 6 mm");
    expect(out).toContain("Tube diameter: 6 mm");
  });

  it("collapses newlines and runs of whitespace from CMS textareas", () => {
    expect(productMetaDescription({ shortDesc: "One.\n\n  Two.\tThree." })).toBe("One. Two. Three.");
  });
});
