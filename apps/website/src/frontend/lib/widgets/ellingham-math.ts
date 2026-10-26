/**
 * Ellingham–Richardson diagram arithmetic for the blog's `ellingham` widget.
 * Pure, so test/blog-ellingham.test.ts checks the same numbers the reader sees.
 *
 * Every reaction is written per mol O₂ and ΔG° = A + B·T (kJ per mol O₂, T in
 * kelvin). Conventions follow Gaskell, Introduction to the Thermodynamics of
 * Materials, ch. 12:
 *  - A metal M can be reduced from its oxide by reductant X at T when the X
 *    line lies BELOW the M line there (ΔG°_X(T) < ΔG°_M(T)).
 *  - The oxygen potential of a gas is RT ln pO₂. For H₂/H₂O it is
 *    ΔG°_H₂ − 2RT ln(pH₂/pH₂O); for CO/CO₂, ΔG°_CO − 2RT ln(pCO/pCO₂).
 *    An oxide whose line lies above that potential is reduced; below it, stable.
 *  - On the plot, ΔG° becomes more negative DOWNWARDS (see yToPx), so the most
 *    stable oxides sit at the bottom, as in every textbook.
 */

/** Gas constant in kJ mol⁻¹ K⁻¹. */
export const R_KJ = 0.008314462618;
export const ZERO_C_IN_K = 273.15;

export type EllinghamLine = {
  label: string;
  A_kJ: number;
  B_kJ_per_K: number;
  validFromK: number;
  validToK: number;
  kinks?: { T_K: number; label: string }[];
};

export type Reductant = "C" | "CO" | "H2";

export const dG = (l: Pick<EllinghamLine, "A_kJ" | "B_kJ_per_K">, T_K: number): number => l.A_kJ + l.B_kJ_per_K * T_K;

/** Temperature (K) where two lines cross, or null when they are parallel. */
export function crossingK(a: EllinghamLine, b: EllinghamLine): number | null {
  const dB = a.B_kJ_per_K - b.B_kJ_per_K;
  if (Math.abs(dB) < 1e-12) return null;
  return (b.A_kJ - a.A_kJ) / dB;
}

export const isValidAt = (l: EllinghamLine, T_K: number): boolean => T_K >= l.validFromK && T_K <= l.validToK;

const SUBSCRIPT_DIGITS: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

/** Splits a label like "2Fe + O₂ → 2FeO" into its two sides (null when there is no arrow). */
function sides(label: string): [string, string] | null {
  const m = label.split(/\s*(?:→|⟶|->|=>|=)\s*/);
  if (m.length !== 2) return null;
  return [m[0]!, m[1]!];
}

/** ASCII form for matching: subscripts → digits, no spaces, no phase marks. */
function normalise(s: string): string {
  return s
    .replace(/[₀-₉]/g, (d) => SUBSCRIPT_DIGITS[d] ?? d)
    .replace(/\((?:s|l|g|aq|liq|gas)\)/gi, "")
    .replace(/\s+/g, "");
}

/**
 * Which reductant a line describes, read from its reactants: "2C + O₂ → 2CO"
 * and "C + O₂ → CO₂" are carbon, "2CO + O₂ → 2CO₂" is CO, "2H₂ + O₂ → 2H₂O"
 * is hydrogen. Everything else is an oxide that might be reduced.
 */
export function reductantOf(label: string): Reductant | null {
  const s = sides(label);
  if (!s) return null;
  const terms = normalise(s[0])
    .split("+")
    .map((t) => t.replace(/^[\d./]+/, ""))
    .filter((t) => t && t !== "O2")
    .sort();
  if (terms.length !== 1) return null;
  if (terms[0] === "C") return "C";
  if (terms[0] === "CO") return "CO";
  if (terms[0] === "H2") return "H2";
  return null;
}

/** "4/3Al + O₂ → 2/3Al₂O₃" → "Al₂O₃"; falls back to the whole label. */
export function oxideName(label: string): string {
  const s = sides(label);
  if (!s) return label.trim();
  return (
    s[1]
      .replace(/^[\d./\s]+/, "")
      .replace(/\s*\((?:s|l|g|aq|liq|gas)\)\s*$/i, "")
      .trim() || label.trim()
  );
}

/**
 * The 2CO + O₂ → 2CO₂ line: given directly, or derived from the two carbon
 * lines as 2·(C + O₂ → CO₂) − (2C + O₂ → 2CO). Null when neither is possible.
 */
export function coLine(lines: EllinghamLine[]): EllinghamLine | null {
  const direct = lines.find((l) => reductantOf(l.label) === "CO");
  if (direct) return direct;
  const carbon = lines.filter((l) => reductantOf(l.label) === "C");
  const toCO = carbon.find((l) => /CO(?!2)/.test(normalise(sides(l.label)?.[1] ?? "")));
  const toCO2 = carbon.find((l) => /CO2/.test(normalise(sides(l.label)?.[1] ?? "")));
  if (!toCO || !toCO2) return null;
  return {
    label: "2CO + O₂ → 2CO₂",
    A_kJ: 2 * toCO2.A_kJ - toCO.A_kJ,
    B_kJ_per_K: 2 * toCO2.B_kJ_per_K - toCO.B_kJ_per_K,
    validFromK: Math.max(toCO.validFromK, toCO2.validFromK),
    validToK: Math.min(toCO.validToK, toCO2.validToK),
  };
}

/** RT ln pO₂ in kJ per mol O₂, for pO₂ = 10^log10pO2 bar. */
export const oxygenPotentialFromPO2 = (T_K: number, log10pO2: number): number => R_KJ * T_K * Math.LN10 * log10pO2;

/** Oxygen potential of a reducing gas X₂/X₂O (or CO/CO₂) at ratio 10^log10Ratio, kJ per mol O₂. */
export const oxygenPotentialFromRatio = (line: EllinghamLine, T_K: number, log10Ratio: number): number =>
  dG(line, T_K) - 2 * R_KJ * T_K * Math.LN10 * log10Ratio;

/** Equilibrium log₁₀ pO₂ (bar) over an oxide at T. */
export const equilibriumLog10PO2 = (oxide: EllinghamLine, T_K: number): number =>
  dG(oxide, T_K) / (R_KJ * T_K * Math.LN10);

/** Equilibrium log₁₀(pH₂/pH₂O) or log₁₀(pCO/pCO₂) over an oxide at T. */
export const equilibriumLog10Ratio = (gasLine: EllinghamLine, oxide: EllinghamLine, T_K: number): number =>
  (dG(gasLine, T_K) - dG(oxide, T_K)) / (2 * R_KJ * T_K * Math.LN10);

export type ReductionVerdict = {
  /** The reductant's oxygen potential at T (kJ per mol O₂), or null when it has no line valid at T. */
  potential: number | null;
  reduces: string[];
  cannot: string[];
};

/**
 * Which oxides valid at T lie above a given oxygen potential (reduced) and
 * which lie below it (stable). Names come from oxideName(); duplicates from
 * piecewise lines collapse because only one piece is valid at a time.
 */
export function classifyOxides(lines: EllinghamLine[], T_K: number, potential: number | null): ReductionVerdict {
  const reduces: string[] = [];
  const cannot: string[] = [];
  if (potential === null) return { potential, reduces, cannot };
  for (const l of lines) {
    if (reductantOf(l.label) || !isValidAt(l, T_K)) continue;
    const name = oxideName(l.label);
    if (reduces.includes(name) || cannot.includes(name)) continue;
    (dG(l, T_K) > potential ? reduces : cannot).push(name);
  }
  return { potential, reduces, cannot };
}

/** Lowest ΔG° among the lines of one reductant valid at T (carbon: CO or CO₂, whichever is more stable). */
export function reductantPotential(lines: EllinghamLine[], kind: Reductant, T_K: number): number | null {
  let best: number | null = null;
  for (const l of lines) {
    if (reductantOf(l.label) !== kind || !isValidAt(l, T_K)) continue;
    const g = dG(l, T_K);
    if (best === null || g < best) best = g;
  }
  return best;
}

/** Plot transform for ΔG°: more negative values map to LARGER pixel y, i.e. lower on screen. */
export function yToPx(dGkJ: number, yMin: number, yMax: number, top: number, height: number): number {
  return top + ((yMax - dGkJ) / (yMax - yMin)) * height;
}
