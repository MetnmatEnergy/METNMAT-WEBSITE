/**
 * Pourbaix (potential–pH) diagram arithmetic for the blog's interactive model,
 * at 25 °C.
 *
 * Every species is written as the product of oxidising ONE atom of the metal:
 *
 *   M + (y/x) H₂O → (1/x) MₓO_yH_z^q + ((2y − z)/x) H⁺ + n e⁻,   n = (q + 2y − z)/x
 *
 * so its Gibbs energy per metal atom at a given pH and electrode potential E
 * (V vs SHE) is linear in both:
 *
 *   G = [ΔG°f − y·ΔG°f(H₂O)]/x + (RT/x)·ln a   (dissolved species only)
 *       − ((2y − z)/x)·RT·ln10·pH − n·F·E
 *
 * The metal itself is G = 0. At any point the stable form is the species with
 * the lowest G (Pourbaix, Atlas of Electrochemical Equilibria, ch. 2), and
 * because G is linear each species' field is a convex polygon: the plot
 * rectangle clipped by the half-planes G_i ≤ G_j. Boundaries are therefore
 * exact straight lines, not a sampled raster.
 */

export const F_C_PER_MOL = 96485.33212;
export const R_J_PER_MOL_K = 8.314462618;
export const T_K = 298.15;
/** RT·ln10 at 25 °C, kJ/mol (5.708). */
export const RT_LN10_KJ = (R_J_PER_MOL_K * T_K * Math.LN10) / 1000;
/** Nernst slope at 25 °C, V per decade (0.05916). */
export const NERNST_V = (R_J_PER_MOL_K * T_K * Math.LN10) / F_C_PER_MOL;
/** ΔG°f of liquid water, kJ/mol (CODATA). */
export const DGF_WATER_KJ = -237.14;
const F_KJ_PER_V = F_C_PER_MOL / 1000;

export type Phase = "s" | "aq";
export type PourbaixSpecies = {
  /** Neutral composition in ASCII, e.g. "Fe2O3", "HFeO2", "Fe(OH)3". The charge is separate. */
  formula: string;
  charge: number;
  /** What the reader sees, e.g. "Fe₂O₃", "HFeO₂⁻". */
  label: string;
  phase: Phase;
  dGf_kJ_mol: number;
};

export type Composition = { metal: number; O: number; H: number };

/**
 * Counts metal, O and H atoms in an ASCII formula with optional parentheses.
 * Returns an error string for anything else (another element, a stray
 * character), so the schema can say exactly what is wrong.
 */
export function parseFormula(formula: string, element: string): Composition | string {
  let i = 0;
  const s = formula;
  function readCount(): number {
    let d = "";
    while (i < s.length && /[0-9]/.test(s[i]!)) d += s[i++];
    return d ? Number(d) : 1;
  }
  function group(depth: number): Record<string, number> | string {
    if (depth > 3) return "parentheses nest too deeply";
    const counts: Record<string, number> = {};
    while (i < s.length && s[i] !== ")") {
      if (s[i] === "(") {
        i++;
        const inner = group(depth + 1);
        if (typeof inner === "string") return inner;
        if (s[i] !== ")") return "unclosed parenthesis";
        i++;
        const k = readCount();
        for (const [el, n] of Object.entries(inner)) counts[el] = (counts[el] ?? 0) + n * k;
        continue;
      }
      const m = /^[A-Z][a-z]?/.exec(s.slice(i));
      if (!m) return `unexpected "${s[i]}" in ${formula}`;
      i += m[0].length;
      const k = readCount();
      counts[m[0]] = (counts[m[0]] ?? 0) + k;
    }
    return counts;
  }
  const counts = group(0);
  if (typeof counts === "string") return counts;
  if (i !== s.length) return `unbalanced ")" in ${formula}`;
  for (const el of Object.keys(counts)) {
    if (el !== element && el !== "O" && el !== "H") return `${formula} contains ${el}; only ${element}, O and H are supported`;
  }
  const metal = counts[element] ?? 0;
  if (metal < 1) return `${formula} contains no ${element}`;
  return { metal, O: counts.O ?? 0, H: counts.H ?? 0 };
}

/** G per metal atom (kJ) = a + b·pH + c·E. */
export type Term = { a: number; b: number; c: number; electrons: number; protons: number };

export function speciesTerm(sp: PourbaixSpecies, comp: Composition, log10Activity: number): Term {
  const x = comp.metal;
  const protons = (2 * comp.O - comp.H) / x; // H⁺ released per metal atom
  const electrons = (sp.charge + 2 * comp.O - comp.H) / x; // e⁻ released per metal atom
  const activity = sp.phase === "aq" ? (RT_LN10_KJ * log10Activity) / x : 0;
  return {
    a: (sp.dGf_kJ_mol - comp.O * DGF_WATER_KJ) / x + activity,
    b: -protons * RT_LN10_KJ,
    c: -electrons * F_KJ_PER_V,
    electrons,
    protons,
  };
}

export const energy = (t: Term, pH: number, E: number): number => t.a + t.b * pH + t.c * E;

/** Index of the stable species at (pH, E). Ties go to the earlier species. */
export function stableAt(terms: Term[], pH: number, E: number): number {
  let best = 0;
  let g = energy(terms[0]!, pH, E);
  for (let i = 1; i < terms.length; i++) {
    const gi = energy(terms[i]!, pH, E);
    if (gi < g - 1e-12) {
      g = gi;
      best = i;
    }
  }
  return best;
}

/** Potential (V) at which species i and j are equally stable, at this pH; null if that boundary is vertical. */
export function boundaryE(ti: Term, tj: Term, pH: number): number | null {
  const dc = ti.c - tj.c;
  if (Math.abs(dc) < 1e-12) return null;
  return -((ti.a - tj.a) + (ti.b - tj.b) * pH) / dc;
}

export type Pt = [number, number]; // [pH, E]

/** Keeps the part of a convex polygon where a + b·pH + c·E ≤ 0 (Sutherland–Hodgman, one edge). */
function clip(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  const f = (p: Pt) => a + b * p[0] + c * p[1];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k]!;
    const q = poly[(k + 1) % poly.length]!;
    const fp = f(p);
    const fq = f(q);
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

export function polygonArea(poly: Pt[]): number {
  let s = 0;
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k]!;
    const q = poly[(k + 1) % poly.length]!;
    s += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(s) / 2;
}

export function polygonCentroid(poly: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k]!;
    const q = poly[(k + 1) % poly.length]!;
    const cr = p[0] * q[1] - q[0] * p[1];
    a += cr;
    cx += (p[0] + q[0]) * cr;
    cy += (p[1] + q[1]) * cr;
  }
  if (Math.abs(a) < 1e-12) {
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export type Field = { index: number; polygon: Pt[]; area: number; centroid: Pt };

/** The stability field of every species that has one inside the plot rectangle. */
export function fields(terms: Term[], pHRange: [number, number], ERange: [number, number]): Field[] {
  const [p0, p1] = pHRange;
  const [e0, e1] = ERange;
  const rect: Pt[] = [
    [p0, e0],
    [p1, e0],
    [p1, e1],
    [p0, e1],
  ];
  const out: Field[] = [];
  terms.forEach((ti, i) => {
    let poly = rect;
    for (let j = 0; j < terms.length && poly.length; j++) {
      if (j === i) continue;
      const tj = terms[j]!;
      poly = clip(poly, ti.a - tj.a, ti.b - tj.b, ti.c - tj.c);
    }
    const area = poly.length >= 3 ? polygonArea(poly) : 0;
    if (area > 1e-9) out.push({ index: i, polygon: poly, area, centroid: polygonCentroid(poly) });
  });
  return out;
}

/** Potential (V vs SHE) of the hydrogen line, 2H⁺ + 2e⁻ → H₂ at 1 bar. */
export const hydrogenLineE = (pH: number): number => -NERNST_V * pH;
/** Potential (V vs SHE) of the oxygen line, O₂ + 4H⁺ + 4e⁻ → 2H₂O at 1 bar (1.229 V at pH 0). */
export const oxygenLineE = (pH: number): number => (-2 * DGF_WATER_KJ) / (4 * F_KJ_PER_V) - NERNST_V * pH;

export type Behaviour = "immunity" | "corrosion" | "passivation";

/** The textbook reading of a field: the metal is immune, it corrodes into a dissolved species, or a solid may passivate it. */
export function behaviourOf(sp: Pick<PourbaixSpecies, "formula" | "charge" | "phase">, element: string): Behaviour {
  if (sp.phase === "aq") return "corrosion";
  if (sp.formula === element && sp.charge === 0) return "immunity";
  return "passivation";
}

export type WaterState = "reduced" | "stable" | "oxidised";
export function waterAt(pH: number, E: number): WaterState {
  if (E < hydrogenLineE(pH)) return "reduced";
  if (E > oxygenLineE(pH)) return "oxidised";
  return "stable";
}
