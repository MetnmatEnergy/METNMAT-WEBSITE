/**
 * Cyclic voltammetry by finite differences — the engine behind the blog's
 * `cyclic-voltammetry` widget. Pure: no React, no DOM, so the acceptance tests
 * in test/blog-cv-sim.test.ts run it exactly as the browser does.
 *
 * Model (Bard & Faulkner, Electrochemical Methods, 2nd ed., ch. 6 and §1.3;
 * Compton & Banks, Understanding Voltammetry, ch. 3):
 *  - O + n e⁻ ⇌ R at a planar electrode, semi-infinite linear diffusion,
 *    D_O = D_R = D, only O in the bulk at concentration C*.
 *  - Butler–Volmer at the surface: flux = k⁰[c_O e^(−αθ) − c_R e^((1−α)θ)],
 *    θ = nF(E − E⁰)/RT.
 *  - EC: R → Z (first order, irreversible, rate constant k_c), R only.
 *  - The sweep starts at the positive end, because the bulk species is the
 *    oxidised form: E runs start → vertex → start at |v|.
 *  - No uncompensated resistance, no double-layer charging.
 *
 * Dimensionless form: τ = f·v·t (so θ moves by exactly ±1 per unit τ),
 * χ = x / √(D/(f·v)), f = nF/RT. Then ∂c/∂τ = ∂²c/∂χ², the rate constant is
 * K⁰ = k⁰/√(D f v) (Matsuda–Ayabe Λ), and the current is
 * i = −n F A C* √(D f v) · ∂c_O/∂χ|₀, signed the IUPAC way: cathodic current
 * is negative. For a reversible couple the cathodic peak of ∂c_O/∂χ|₀ is the
 * Randles–Ševčík constant 0.4463.
 *
 * Numerics: fully implicit (backward Euler) on an exponentially expanding
 * grid. Each step eliminates the tridiagonal system from the bulk inwards so
 * that the first interior points are linear in the surface concentrations;
 * Butler–Volmer and flux conservation then close a 2×2 linear system for
 * c_O(0) and c_R(0). The surface flux uses a three-point one-sided
 * difference. Step and grid are fixed by STEP_THETA / H0 / GRID_RATIO,
 * which the tests pin against Randles–Ševčík and Nicholson's ψ–ΔEp table.
 */

export const FARADAY = 96485.33212; // C mol⁻¹ (CODATA 2018, exact)
export const GAS_R = 8.314462618; // J mol⁻¹ K⁻¹ (CODATA 2018, exact)

export type CvParams = {
  mechanism: "E" | "EC";
  n: number;
  E0_V: number;
  k0_cm_s: number;
  alpha: number;
  D_cm2_s: number;
  C_mM: number;
  area_cm2: number;
  scanRate_V_s: number;
  /** [start, vertex]; start is the positive end. */
  window_V: readonly [number, number];
  kc_s?: number;
  T_K?: number;
};

export type CvCurve = {
  /** Potential of each point, V (same reference as E0). */
  E: Float64Array;
  /** Current of each point, µA, IUPAC sign (cathodic negative). */
  I_uA: Float64Array;
  /** Index of the last point of the forward (cathodic) sweep. */
  vertexIndex: number;
};

/** Dimensionless potential step per time step (≈0.5 mV at n = 1, 25 °C). */
const STEP_THETA = 0.02;
/** First grid spacing and expansion ratio, in units of √(D/(f v)). */
const H0 = 2e-3;
const GRID_RATIO = 1.06;

export function simulateCv(p: CvParams): CvCurve {
  const T = p.T_K ?? 298.15;
  const f = (p.n * FARADAY) / (GAS_R * T); // V⁻¹
  const v = p.scanRate_V_s;
  const [eStart, eVertex] = p.window_V;
  const thetaStart = f * (eStart - p.E0_V);
  const thetaVertex = f * (eVertex - p.E0_V);
  const span = Math.abs(thetaStart - thetaVertex);
  const stepsPerSweep = Math.max(50, Math.ceil(span / STEP_THETA));
  const dTheta = span / stepsPerSweep;
  const dTau = dTheta; // |dθ/dτ| = 1
  const tauTotal = 2 * span;

  const K0 = p.k0_cm_s / Math.sqrt(p.D_cm2_s * f * v);
  const Kc = p.mechanism === "EC" ? Math.max(0, p.kc_s ?? 0) / (f * v) : 0;
  const alpha = p.alpha;

  // ── Expanding grid out to six diffusion lengths of the whole experiment ──
  const xMax = 6 * Math.sqrt(tauTotal);
  const xs: number[] = [0];
  for (let h = H0; xs[xs.length - 1]! < xMax; h *= GRID_RATIO) xs.push(xs[xs.length - 1]! + h);
  const N = xs.length; // nodes 0..N-1; node N-1 is the bulk boundary
  const x = Float64Array.from(xs);

  // Interior coefficients (identical for both species except the reaction term).
  const lo = new Float64Array(N); // multiplies c[i-1]
  const up = new Float64Array(N); // multiplies c[i+1]
  for (let i = 1; i < N - 1; i++) {
    const hm = x[i]! - x[i - 1]!;
    const hp = x[i + 1]! - x[i]!;
    lo[i] = (2 * dTau) / (hm * (hm + hp));
    up[i] = (2 * dTau) / (hp * (hm + hp));
  }
  // Three-point one-sided derivative at x = 0 on a non-uniform grid.
  const h0 = x[1]! - x[0]!;
  const h1 = x[2]! - x[1]!;
  const d0 = -(2 * h0 + h1) / (h0 * (h0 + h1));
  const d1 = (h0 + h1) / (h0 * h1);
  const d2 = -h0 / (h1 * (h0 + h1));

  const cO = new Float64Array(N).fill(1);
  const cR = new Float64Array(N).fill(0);
  const PO = new Float64Array(N);
  const QO = new Float64Array(N);
  const PR = new Float64Array(N);
  const QR = new Float64Array(N);

  /**
   * Eliminate interior nodes from the bulk inwards: c[i] = P[i] + Q[i]·c[i-1].
   * Returns {u, w} with surface flux ∂c/∂χ|₀ = u + w·c[0].
   */
  const eliminate = (c: Float64Array, P: Float64Array, Q: Float64Array, bulk: number, k: number) => {
    P[N - 1] = bulk;
    Q[N - 1] = 0;
    for (let i = N - 2; i >= 1; i--) {
      const denom = 1 + lo[i]! + up[i]! + k * dTau - up[i]! * Q[i + 1]!;
      P[i] = (c[i]! + up[i]! * P[i + 1]!) / denom;
      Q[i] = lo[i]! / denom;
    }
    // c1 = P1 + Q1 c0 ; c2 = P2 + Q2 c1
    const c1u = P[1]!;
    const c1w = Q[1]!;
    const c2u = P[2]! + Q[2]! * c1u;
    const c2w = Q[2]! * c1w;
    return { u: d1 * c1u + d2 * c2u, w: d0 + d1 * c1w + d2 * c2w };
  };
  const backSubstitute = (c: Float64Array, P: Float64Array, Q: Float64Array, c0: number) => {
    c[0] = c0;
    for (let i = 1; i < N - 1; i++) c[i] = P[i]! + Q[i]! * c[i - 1]!;
    c[N - 1] = P[N - 1]!;
  };

  const total = 2 * stepsPerSweep;
  const E = new Float64Array(total + 1);
  const I = new Float64Array(total + 1);
  // i = −nFAC*√(Dfv)·J, C* in mol cm⁻³, reported in µA.
  const iScale = -p.n * FARADAY * p.area_cm2 * (p.C_mM * 1e-6) * Math.sqrt(p.D_cm2_s * f * v) * 1e6;
  E[0] = eStart;
  I[0] = 0;

  for (let k = 1; k <= total; k++) {
    const theta =
      k <= stepsPerSweep ? thetaStart - k * dTheta : thetaVertex + (k - stepsPerSweep) * dTheta;
    const kf = K0 * Math.exp(-alpha * theta);
    const kb = K0 * Math.exp((1 - alpha) * theta);
    const o = eliminate(cO, PO, QO, 1, 0);
    const r = eliminate(cR, PR, QR, 0, Kc);
    // (1) u_O + w_O c_O0 = kf c_O0 − kb c_R0        (Butler–Volmer)
    // (2) u_R + w_R c_R0 = −(u_O + w_O c_O0)         (flux of R = −flux of O)
    const a11 = o.w - kf;
    const a12 = kb;
    const b1 = -o.u;
    const a21 = o.w;
    const a22 = r.w;
    const b2 = -o.u - r.u;
    const det = a11 * a22 - a12 * a21;
    const cO0 = (b1 * a22 - a12 * b2) / det;
    const cR0 = (a11 * b2 - a21 * b1) / det;
    backSubstitute(cO, PO, QO, cO0);
    backSubstitute(cR, PR, QR, cR0);
    const J = o.u + o.w * cO0;
    E[k] = p.E0_V + theta / f;
    I[k] = iScale * J;
  }
  return { E, I_uA: I, vertexIndex: stepsPerSweep };
}

export type CvPeak = { E_V: number; I_uA: number; index: number };

/** Sub-sample peak position by fitting a parabola through the three points. */
function refine(E: Float64Array, I: Float64Array, j: number): CvPeak {
  if (j <= 0 || j >= E.length - 1) return { E_V: E[j]!, I_uA: I[j]!, index: j };
  const y0 = I[j - 1]!;
  const y1 = I[j]!;
  const y2 = I[j + 1]!;
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return { E_V: E[j]!, I_uA: y1, index: j };
  const t = (0.5 * (y0 - y2)) / denom; // offset in steps, |t| ≤ 0.5
  const dE = (E[j + 1]! - E[j - 1]!) / 2;
  return { E_V: E[j]! + t * dE, I_uA: y1 - 0.25 * (y0 - y2) * t, index: j };
}

export type CvAnalysis = {
  /** Cathodic peak (most negative current on the forward sweep), or null if the window ends first. */
  cathodic: CvPeak | null;
  /** Anodic peak on the return sweep, measured from zero current, or null. */
  anodic: CvPeak | null;
  /** Ep,a − Ep,c in V, when both peaks exist. */
  deltaEp_V: number | null;
  /**
   * ip,a/ip,c by Nicholson's empirical relation (Anal. Chem. 1966, 38, 1406):
   * (ipa)₀/ipc + 0.485·(isp)₀/ipc + 0.086, which corrects for the decaying
   * cathodic baseline. 1 for a stable, reversible couple.
   */
  peakRatio: number | null;
};

export function analyseCv(curve: CvCurve): CvAnalysis {
  const { E, I_uA: I, vertexIndex: v } = curve;
  let jc = 0;
  for (let j = 1; j <= v; j++) if (I[j]! < I[jc]!) jc = j;
  let ja = v;
  for (let j = v; j < I.length; j++) if (I[j]! > I[ja]!) ja = j;
  // A peak needs a turn on both sides; a minimum on the edge means the window cut it off.
  const cathodic = jc > 0 && jc < v && I[jc]! < 0 ? refine(E, I, jc) : null;
  const anodic = ja > v && ja < I.length - 1 ? refine(E, I, ja) : null;
  const deltaEp_V = cathodic && anodic ? anodic.E_V - cathodic.E_V : null;
  let peakRatio: number | null = null;
  if (cathodic && anodic) {
    const ipc = -cathodic.I_uA;
    const ipa0 = anodic.I_uA;
    const isp0 = -I[v]!;
    peakRatio = ipa0 / ipc + (0.485 * isp0) / ipc + 0.086;
  }
  return { cathodic, anodic, deltaEp_V, peakRatio };
}

/** Randles–Ševčík reversible peak current, µA (Bard & Faulkner eq. 6.2.19). */
export function randlesSevcikUa(p: Pick<CvParams, "n" | "area_cm2" | "C_mM" | "D_cm2_s" | "scanRate_V_s" | "T_K">): number {
  const T = p.T_K ?? 298.15;
  const f = (p.n * FARADAY) / (GAS_R * T);
  return 0.4463 * p.n * FARADAY * p.area_cm2 * p.C_mM * 1e-6 * Math.sqrt(p.D_cm2_s * f * p.scanRate_V_s) * 1e6;
}

/**
 * Matsuda–Ayabe Λ = k⁰/√(D f v). Λ ≥ 15 reversible; 15 > Λ > 10^(−2(1+α))
 * quasi-reversible; below that, irreversible (Bard & Faulkner §6.4).
 */
export function matsudaAyabe(p: Pick<CvParams, "n" | "k0_cm_s" | "D_cm2_s" | "scanRate_V_s" | "alpha" | "T_K">): {
  lambda: number;
  regime: "reversible" | "quasi-reversible" | "irreversible";
} {
  const T = p.T_K ?? 298.15;
  const f = (p.n * FARADAY) / (GAS_R * T);
  const lambda = p.k0_cm_s / Math.sqrt(p.D_cm2_s * f * p.scanRate_V_s);
  const regime =
    lambda >= 15 ? "reversible" : lambda > Math.pow(10, -2 * (1 + p.alpha)) ? "quasi-reversible" : "irreversible";
  return { lambda, regime };
}
