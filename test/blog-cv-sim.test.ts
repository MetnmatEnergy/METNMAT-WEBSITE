import { describe, it, expect } from "vitest";
import {
  analyseCv,
  matsudaAyabe,
  randlesSevcikUa,
  simulateCv,
  type CvParams,
} from "../apps/website/src/frontend/lib/widgets/cv-sim";

/**
 * Acceptance tests for the blog's cyclic-voltammetry widget engine.
 *
 * The reference numbers are the textbook ones a reader will check the model
 * against: Randles–Ševčík for the reversible peak (Bard & Faulkner eq. 6.2.19)
 * and Nicholson's ψ–ΔEp working curve for the quasi-reversible separation
 * (Anal. Chem. 1965, 37, 1351; Bard & Faulkner table 6.5.2).
 */

// 1 mM, 3 mm disk, D = 7.6e-6 cm² s⁻¹ (ferrocyanide-like), 50 mV s⁻¹, 25 °C.
const BASE: CvParams = {
  mechanism: "E",
  n: 1,
  E0_V: 0.2,
  k0_cm_s: 1, // Λ ≈ 260: reversible
  alpha: 0.5,
  D_cm2_s: 7.6e-6,
  C_mM: 1,
  area_cm2: 0.0707,
  scanRate_V_s: 0.05,
  window_V: [0.6, -0.2],
};

const run = (p: Partial<CvParams> = {}) => analyseCv(simulateCv({ ...BASE, ...p }));

describe("cyclic voltammetry simulation", () => {
  it("gives a reversible cathodic peak of about 11.7 µA (Randles–Ševčík)", () => {
    const a = run();
    expect(a.cathodic).not.toBeNull();
    const ip = -a.cathodic!.I_uA;
    expect(ip).toBeGreaterThan(11.6);
    expect(ip).toBeLessThan(11.8);
    // and agrees with the closed form to better than 1 %
    expect(Math.abs(ip / randlesSevcikUa(BASE) - 1)).toBeLessThan(0.01);
  });

  it("draws the cathodic peak as a NEGATIVE current, 28.5 mV past E⁰ (IUPAC convention)", () => {
    const a = run();
    expect(a.cathodic!.I_uA).toBeLessThan(0);
    expect(a.anodic!.I_uA).toBeGreaterThan(0);
    // Reversible: Ep,c = E½ − 28.5 mV/n (Bard & Faulkner eq. 6.2.20), E½ = E⁰ when D_O = D_R.
    expect(a.cathodic!.E_V - BASE.E0_V).toBeCloseTo(-0.0285, 3);
  });

  it("multiplies the peak by about √2 when the scan rate doubles", () => {
    const ip1 = -run().cathodic!.I_uA;
    const ip2 = -run({ scanRate_V_s: 0.1 }).cathodic!.I_uA;
    expect(ip2 / ip1).toBeGreaterThan(1.40);
    expect(ip2 / ip1).toBeLessThan(1.43);
  });

  it("separates the peaks by about 57 mV when reversible and 92 mV at k⁰ = 0.005 cm/s", () => {
    const rev = run().deltaEp_V!;
    expect(rev * 1000).toBeGreaterThan(56);
    expect(rev * 1000).toBeLessThan(60);
    const quasi = run({ k0_cm_s: 0.005 }).deltaEp_V!;
    expect(quasi * 1000).toBeGreaterThan(89);
    expect(quasi * 1000).toBeLessThan(95);
  });

  it("keeps ip,a/ip,c at 1 for a stable couple and drops it when R decays (EC)", () => {
    expect(run().peakRatio!).toBeGreaterThan(0.97);
    expect(run().peakRatio!).toBeLessThan(1.03);
    const ec = run({ mechanism: "EC", kc_s: 1 }).peakRatio!;
    expect(ec).toBeLessThan(0.9);
  });

  it("scales the current linearly with concentration and area", () => {
    const ip = -run().cathodic!.I_uA;
    expect(-run({ C_mM: 2 }).cathodic!.I_uA / ip).toBeCloseTo(2, 6);
    expect(-run({ area_cm2: 0.1414 }).cathodic!.I_uA / ip).toBeCloseTo(2, 6);
  });

  it("classifies the kinetic regime with Matsuda–Ayabe Λ", () => {
    expect(matsudaAyabe(BASE).regime).toBe("reversible");
    expect(matsudaAyabe({ ...BASE, k0_cm_s: 0.005 }).regime).toBe("quasi-reversible");
    expect(matsudaAyabe({ ...BASE, k0_cm_s: 1e-6 }).regime).toBe("irreversible");
  });

  it("reports no cathodic peak when the vertex comes before it", () => {
    const a = run({ window_V: [0.6, 0.19] });
    expect(a.cathodic).toBeNull();
  });

  it("stays finite at the extremes of every slider", () => {
    for (const p of [
      { k0_cm_s: 1e-6 },
      { k0_cm_s: 10 },
      { scanRate_V_s: 0.001 },
      { scanRate_V_s: 10 },
      { mechanism: "EC" as const, kc_s: 1000 },
    ]) {
      const c = simulateCv({ ...BASE, ...p, window_V: [0.8, -0.6] });
      expect(Array.from(c.I_uA).every(Number.isFinite)).toBe(true);
    }
  });

  it("runs fast enough to follow a slider (< 60 ms for the default window)", () => {
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) simulateCv(BASE);
    expect((performance.now() - t0) / 5).toBeLessThan(60);
  });
});
