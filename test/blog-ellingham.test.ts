import { describe, it, expect } from "vitest";
import {
  classifyOxides,
  coLine,
  crossingK,
  dG,
  equilibriumLog10PO2,
  equilibriumLog10Ratio,
  oxideName,
  oxygenPotentialFromRatio,
  reductantOf,
  reductantPotential,
  yToPx,
  type EllinghamLine,
} from "../apps/website/src/frontend/lib/widgets/ellingham-math";

/**
 * Acceptance tests for the blog's Ellingham widget arithmetic.
 *
 * The 2026-10 pilot's model-written prototype computed every value correctly
 * and still drew the ΔG° axis upside down. The direction test below is the one
 * that would have caught it.
 *
 * Coefficients (kJ per mol O₂, ΔG° = A + B·T): FeO and CO from the acceptance
 * brief; CO₂, H₂O and Al₂O₃ rounded from Gaskell, Introduction to the
 * Thermodynamics of Materials, table of standard Gibbs energies. They exist
 * here to exercise the logic, not as data the site publishes.
 */
const line = (label: string, A_kJ: number, B_kJ_per_K: number, validFromK = 298, validToK = 2500): EllinghamLine => ({
  label,
  A_kJ,
  B_kJ_per_K,
  validFromK,
  validToK,
});
const FeO = line("2Fe + O₂ → 2FeO", -544, 0.138);
const CO = line("2C + O₂ → 2CO", -223.4, -0.1753);
const CO2 = line("C + O₂ → CO₂", -394.1, -0.00084);
const H2O = line("2H₂ + O₂ → 2H₂O", -492.9, 0.1096);
const Al2O3 = line("4/3Al + O₂ → 2/3Al₂O₃", -1115, 0.209);
const LINES = [FeO, CO, CO2, H2O, Al2O3];

describe("Ellingham arithmetic", () => {
  it("puts the FeO and C/CO crossing at about 1,025 K", () => {
    const T = crossingK(FeO, CO)!;
    expect(T).toBeGreaterThan(1020);
    expect(T).toBeLessThan(1030);
    expect(dG(FeO, T)).toBeCloseTo(dG(CO, T), 9);
  });

  it("returns null for parallel lines", () => {
    expect(crossingK(FeO, line("x", -100, 0.138))).toBeNull();
  });

  it("draws ΔG° more negative DOWNWARDS, so stable oxides sit at the bottom", () => {
    const top = 20;
    const height = 400;
    const yMin = -1200;
    const yMax = 0;
    expect(yToPx(0, yMin, yMax, top, height)).toBe(top);
    expect(yToPx(-1200, yMin, yMax, top, height)).toBe(top + height);
    // Al₂O₃ (more stable) must be drawn BELOW FeO at every temperature.
    for (const T of [500, 1000, 1500, 2000]) {
      expect(yToPx(dG(Al2O3, T), yMin, yMax, top, height)).toBeGreaterThan(yToPx(dG(FeO, T), yMin, yMax, top, height));
    }
  });

  it("recognises reductant lines from their reactants and names oxides from their products", () => {
    expect(reductantOf("2C + O₂ → 2CO")).toBe("C");
    expect(reductantOf("C + O2 -> CO2")).toBe("C");
    expect(reductantOf("2CO + O₂ → 2CO₂")).toBe("CO");
    expect(reductantOf("2H₂ + O₂ → 2H₂O")).toBe("H2");
    expect(reductantOf("O₂ + 2H₂ → 2H₂O (g)")).toBe("H2");
    expect(reductantOf("2Fe + O₂ → 2FeO")).toBeNull();
    expect(reductantOf("2Ca + O₂ → 2CaO")).toBeNull(); // starts with C, is not carbon
    expect(reductantOf("2Co + O₂ → 2CoO")).toBeNull(); // cobalt, not CO
    expect(oxideName("4/3Al + O₂ → 2/3Al₂O₃")).toBe("Al₂O₃");
    expect(oxideName("2Fe + O₂ → 2FeO")).toBe("FeO");
    expect(oxideName("2Zn(g) + O₂ → 2ZnO(s)")).toBe("ZnO");
  });

  it("derives 2CO + O₂ → 2CO₂ from the two carbon lines (Gaskell: −564.8 + 0.1736·T)", () => {
    const l = coLine(LINES)!;
    expect(l.A_kJ).toBeCloseTo(-564.8, 6);
    expect(l.B_kJ_per_K).toBeCloseTo(0.17362, 6);
    expect(coLine([FeO, CO])).toBeNull();
  });

  it("says carbon reduces FeO but not Al₂O₃ at 1,200 °C, and neither below the crossing", () => {
    const hot = 1473.15;
    const c = classifyOxides(LINES, hot, reductantPotential(LINES, "C", hot));
    expect(c.reduces).toEqual(["FeO"]);
    expect(c.cannot).toEqual(["Al₂O₃"]);
    const cool = 900;
    expect(classifyOxides(LINES, cool, reductantPotential(LINES, "C", cool)).reduces).toEqual([]);
  });

  it("takes the more stable carbon product (CO₂ below ~980 K, CO above)", () => {
    expect(reductantPotential(LINES, "C", 700)).toBeCloseTo(dG(CO2, 700), 9);
    expect(reductantPotential(LINES, "C", 1500)).toBeCloseTo(dG(CO, 1500), 9);
  });

  it("lets excess hydrogen reduce what equal pressures cannot (truth rule 11)", () => {
    const T = 900;
    expect(classifyOxides(LINES, T, oxygenPotentialFromRatio(H2O, T, 0)).reduces).toEqual([]);
    // the minimum pH₂/pH₂O for FeO at 900 K, then a decade above it
    const need = equilibriumLog10Ratio(H2O, FeO, T);
    expect(need).toBeGreaterThan(0);
    expect(classifyOxides(LINES, T, oxygenPotentialFromRatio(H2O, T, need + 1)).reduces).toEqual(["FeO"]);
  });

  it("gives the equilibrium oxygen pressure over FeO at 1,473 K as about 10⁻¹²·¹ bar", () => {
    expect(equilibriumLog10PO2(FeO, 1473.15)).toBeCloseTo(-12.08, 1);
  });

  it("ignores lines outside their validity range", () => {
    const piece = line("2Mg + O₂ → 2MgO", -1200, 0.2, 298, 1000);
    const r = classifyOxides([piece, CO], 1500, reductantPotential([piece, CO], "C", 1500));
    expect(r.reduces).toEqual([]);
    expect(r.cannot).toEqual([]);
  });
});
