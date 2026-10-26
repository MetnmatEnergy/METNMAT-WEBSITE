import { describe, it, expect } from "vitest";
import {
  NERNST_V,
  behaviourOf,
  boundaryE,
  fields,
  hydrogenLineE,
  oxygenLineE,
  parseFormula,
  speciesTerm,
  stableAt,
  waterAt,
  type PourbaixSpecies,
} from "../apps/website/src/frontend/lib/widgets/pourbaix-math";
import { parseWidget } from "../apps/website/src/frontend/lib/widgets/schemas";

/**
 * Acceptance tests for the blog's Pourbaix widget arithmetic.
 *
 * Data: the iron–water system with hematite and magnetite as in Pourbaix's
 * Atlas of Electrochemical Equilibria (ΔG°f in kcal/mol × 4.184: Fe²⁺ −20.30,
 * Fe³⁺ −2.53, Fe₃O₄ −242.40, Fe₂O₃ −177.10, HFeO₂⁻ −90.627). The expected
 * boundaries are the Atlas's own published equations, so a pass means the
 * widget reproduces the textbook diagram, not merely itself.
 */
const FE: PourbaixSpecies[] = [
  { formula: "Fe", charge: 0, label: "Fe", phase: "s", dGf_kJ_mol: 0 },
  { formula: "Fe", charge: 2, label: "Fe²⁺", phase: "aq", dGf_kJ_mol: -84.94 },
  { formula: "Fe", charge: 3, label: "Fe³⁺", phase: "aq", dGf_kJ_mol: -10.59 },
  { formula: "Fe3O4", charge: 0, label: "Fe₃O₄", phase: "s", dGf_kJ_mol: -1014.2 },
  { formula: "Fe2O3", charge: 0, label: "Fe₂O₃", phase: "s", dGf_kJ_mol: -740.99 },
  { formula: "HFeO2", charge: -1, label: "HFeO₂⁻", phase: "aq", dGf_kJ_mol: -379.18 },
];
const [Fe, Fe2, Fe3, Mag, Hem, Hfeo2] = [0, 1, 2, 3, 4, 5];

const termsAt = (log10a: number) =>
  FE.map((sp) => {
    const c = parseFormula(sp.formula, "Fe");
    if (typeof c === "string") throw new Error(c);
    return speciesTerm(sp, c, log10a);
  });

/**
 * The potential of the `below`/`above` boundary at this pH, after checking it
 * really is the boundary the diagram draws there: `below` is stable just under
 * it and `above` just over it.
 */
function switchE(log10a: number, pH: number, below: number, above: number): number {
  const t = termsAt(log10a);
  const e = boundaryE(t[below]!, t[above]!, pH);
  if (e === null) throw new Error("vertical boundary");
  expect(stableAt(t, pH, e - 0.005), "species below the line").toBe(below);
  expect(stableAt(t, pH, e + 0.005), "species above the line").toBe(above);
  return e;
}

describe("Pourbaix formula parsing", () => {
  it("counts metal, oxygen and hydrogen, with parentheses", () => {
    expect(parseFormula("Fe2O3", "Fe")).toEqual({ metal: 2, O: 3, H: 0 });
    expect(parseFormula("HFeO2", "Fe")).toEqual({ metal: 1, O: 2, H: 1 });
    expect(parseFormula("Fe(OH)3", "Fe")).toEqual({ metal: 1, O: 3, H: 3 });
    expect(parseFormula("Cr2O3", "Cr")).toEqual({ metal: 2, O: 3, H: 0 });
  });

  it("refuses other elements, missing metal and broken syntax", () => {
    expect(parseFormula("FeCl2", "Fe")).toMatch(/Cl/);
    expect(parseFormula("H2O", "Fe")).toMatch(/no Fe/);
    expect(parseFormula("Fe(OH", "Fe")).toMatch(/unclosed/);
    expect(parseFormula("Fe)2", "Fe")).toMatch(/unbalanced/);
    expect(parseFormula("Fe-2", "Fe")).toMatch(/unexpected/);
  });
});

describe("Pourbaix diagram for iron reproduces the Atlas", () => {
  it("balances electrons and protons per metal atom", () => {
    const t = termsAt(-6);
    expect(t[Fe2]!.electrons).toBe(2);
    expect(t[Hem]!.electrons).toBe(3); // Fe + 1.5 H₂O → ½Fe₂O₃ + 3H⁺ + 3e⁻
    expect(t[Hem]!.protons).toBe(3);
    expect(t[Mag]!.electrons).toBeCloseTo(8 / 3, 12);
    expect(t[Hfeo2]!.electrons).toBe(2); // Fe + 2H₂O → HFeO₂⁻ + 3H⁺ + 2e⁻
    expect(t[Hfeo2]!.protons).toBe(3);
  });

  it("Fe²⁺/Fe: E = −0.440 + 0.0295·log a, so −0.617 V at 10⁻⁶", () => {
    expect(switchE(-6, 2, Fe, Fe2)).toBeCloseTo(-0.440 + 0.02958 * -6, 3);
    expect(switchE(0, 2, Fe, Fe2)).toBeCloseTo(-0.440, 3);
  });

  it("Fe³⁺/Fe²⁺ at 0.771 V, independent of pH and of the (equal) activities", () => {
    // pH 0: at 10⁻² the hematite field already starts at pH 0.43, so higher pH would cross into it
    expect(switchE(-6, 0, Fe2, Fe3)).toBeCloseTo(0.771, 3);
    expect(switchE(-2, 0, Fe2, Fe3)).toBeCloseTo(0.771, 3);
  });

  it("Fe₃O₄/Fe: E = −0.085 − 0.0591·pH", () => {
    expect(switchE(-6, 10, Fe, Mag)).toBeCloseTo(-0.085 - 0.0591 * 10, 2);
  });

  it("Fe₂O₃/Fe₃O₄: E = 0.221 − 0.0591·pH", () => {
    expect(switchE(-6, 10, Mag, Hem)).toBeCloseTo(0.221 - 0.0591 * 10, 2);
  });

  it("Fe₂O₃/Fe²⁺: E = 0.728 − 0.1773·pH − 0.0591·log a", () => {
    // Fe²⁺ below, Fe₂O₃ above, at pH 4 and 10⁻⁶
    expect(switchE(-6, 4, Fe2, Hem)).toBeCloseTo(0.728 - 0.1773 * 4 + 0.0591 * 6, 2);
  });

  it("Fe₂O₃/Fe³⁺: a vertical boundary at log a = −0.72 − 3·pH (pH 1.76 at 10⁻⁶)", () => {
    const t = termsAt(-6);
    expect(boundaryE(t[Hem]!, t[Fe3]!, 1)).toBeNull(); // no electrons exchanged
    expect(stableAt(t, 1.7, 1.2)).toBe(Fe3);
    expect(stableAt(t, 1.82, 1.2)).toBe(Hem);
  });

  it("HFeO₂⁻/Fe₃O₄: E = −1.819 + 0.0295·pH − 0.0886·log a", () => {
    // HFeO₂⁻ needs very alkaline water; at pH 15 and 10⁻⁶ it lies below Fe₃O₄
    const t = termsAt(-6);
    const e = boundaryE(t[Hfeo2]!, t[Mag]!, 15)!;
    expect(e).toBeCloseTo(-1.819 + 0.0295 * 15 + 0.0886 * 6, 2);
  });

  it("classifies the familiar regions", () => {
    const t = termsAt(-6);
    expect(behaviourOf(FE[stableAt(t, 7, -1.0)]!, "Fe")).toBe("immunity");
    expect(behaviourOf(FE[stableAt(t, 2, 0)]!, "Fe")).toBe("corrosion");
    expect(behaviourOf(FE[stableAt(t, 8, 0.4)]!, "Fe")).toBe("passivation");
  });

  it("a lower 'dissolved' threshold widens the corrosion field", () => {
    expect(switchE(-8, 2, Fe, Fe2)).toBeLessThan(switchE(-6, 2, Fe, Fe2));
  });

  it("the fields tile the plot exactly, with no gaps or overlaps", () => {
    const range: [number, number] = [-2, 16];
    const E: [number, number] = [-1.8, 2.2];
    const f = fields(termsAt(-6), range, E);
    const total = f.reduce((s, r) => s + r.area, 0);
    expect(total).toBeCloseTo((range[1] - range[0]) * (E[1] - E[0]), 9);
    // every field's centroid lies inside its own field
    for (const r of f) expect(stableAt(termsAt(-6), r.centroid[0], r.centroid[1])).toBe(r.index);
    expect(f.map((r) => r.index).sort()).toEqual([Fe, Fe2, Fe3, Mag, Hem, Hfeo2]);
  });
});

describe("water lines", () => {
  it("sit at 0 and 1.229 V at pH 0 and fall 59 mV per pH unit", () => {
    expect(NERNST_V).toBeCloseTo(0.05916, 5);
    expect(hydrogenLineE(0)).toBeCloseTo(0, 12);
    expect(oxygenLineE(0)).toBeCloseTo(1.229, 3);
    expect(hydrogenLineE(7)).toBeCloseTo(-0.414, 3);
    expect(oxygenLineE(7)).toBeCloseTo(0.815, 3);
    expect(waterAt(7, -0.6)).toBe("reduced");
    expect(waterAt(7, 0)).toBe("stable");
    expect(waterAt(7, 1.0)).toBe("oxidised");
  });
});

describe("pourbaix config schema", () => {
  const ok = { element: "Fe", species: FE };

  it("accepts the Atlas iron system and fills the defaults", () => {
    const r = parseWidget("pourbaix", ok);
    expect(r.ok).toBe(true);
    if (r.ok && r.value.widget === "pourbaix") {
      expect(r.value.config.logActivity).toEqual({ min: -8, max: 0, default: -6 });
      expect(r.value.config.pHRange).toEqual([-2, 16]);
      expect(r.value.config.showWaterLines).toBe(true);
    }
  });

  it("refuses a system without the metal, a charged solid, a foreign element and unknown keys", () => {
    const noMetal = parseWidget("pourbaix", { ...ok, species: FE.slice(1) });
    expect(noMetal.ok).toBe(false);
    if (!noMetal.ok) expect(noMetal.issues.join(" ")).toMatch(/list the metal itself once/);

    const chargedSolid = parseWidget("pourbaix", { ...ok, species: [...FE.slice(0, 3), { ...FE[3]!, charge: 1 }] });
    expect(!chargedSolid.ok && chargedSolid.issues.join(" ")).toMatch(/neutral/);

    const chloride = parseWidget("pourbaix", { ...ok, species: [...FE, { formula: "FeCl2", charge: 0, label: "FeCl₂", phase: "s", dGf_kJ_mol: -300 }] });
    expect(!chloride.ok && chloride.issues.join(" ")).toMatch(/Cl/);

    const extra = parseWidget("pourbaix", { ...ok, temperatureC: 80 });
    expect(extra.ok).toBe(false);
  });
});
