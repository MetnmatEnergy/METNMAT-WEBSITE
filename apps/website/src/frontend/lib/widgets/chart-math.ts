/**
 * Axis ticks and number formatting shared by the blog's interactive models.
 *
 * Deterministic on purpose: widgets render on the server first and hydrate in
 * the browser, so nothing here may depend on the locale (no toLocaleString).
 */

/** "Nice" tick values (1, 2, 2.5, 5 × 10ⁿ) covering [min, max] with about `target` intervals. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [min];
  const raw = (max - min) / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  const first = Math.ceil(min / step - 1e-9) * step;
  for (let v = first; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

/** Widens [min, max] outwards to the nearest nice ticks. */
export function niceDomain(min: number, max: number, target = 5): [number, number] {
  if (!(max > min)) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    return [min - pad, max + pad];
  }
  const t = niceTicks(min, max, target);
  const step = t.length > 1 ? t[1]! - t[0]! : (max - min) / target;
  const lo = t[0]! > min ? t[0]! - step : t[0]!;
  const hi = t[t.length - 1]! < max ? t[t.length - 1]! + step : t[t.length - 1]!;
  return [lo, hi];
}

/** Decade ticks for a log axis, as exponents. */
export function decadeTicks(log10Min: number, log10Max: number, maxTicks = 7): number[] {
  const lo = Math.ceil(log10Min - 1e-9);
  const hi = Math.floor(log10Max + 1e-9);
  const n = hi - lo + 1;
  const every = Math.max(1, Math.ceil(n / maxTicks));
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) if ((e - lo) % every === 0) out.push(e);
  return out;
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
const superscript = (n: number) => String(n).replace(/[-0-9]/g, (c) => SUPERSCRIPT[c] ?? c);

/** 10⁻¹⁴ */
export const pow10 = (exponent: number): string => `10${superscript(Math.round(exponent))}`;

/** Thousands separator for integers, e.g. 1,473 (deterministic). */
function group(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Human number with `sig` significant figures: 1,473 · 0.0285 · 4.6 × 10⁻⁵.
 * Uses U+2212 for minus so negative numbers line up with the axis labels.
 */
export function fmt(x: number, sig = 3): string {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const neg = x < 0;
  const a = Math.abs(x);
  const e = Math.floor(Math.log10(a));
  let body: string;
  if (e >= 6 || e <= -4) {
    const m = a / Math.pow(10, e);
    let mant = Number(m.toPrecision(sig));
    let exp = e;
    if (mant >= 10) {
      mant /= 10;
      exp += 1;
    }
    body = `${trimZeros(mant.toFixed(Math.max(0, sig - 1)))} × ${pow10(exp)}`;
  } else {
    const decimals = Math.max(0, sig - 1 - e);
    const s = Number(a.toPrecision(sig)).toFixed(decimals);
    const [i, d] = s.split(".");
    body = group(i!) + (d ? `.${d}` : "");
    if (d) body = trimZeros(body);
  }
  return neg ? `−${body}` : body;
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** Tick label: like fmt() but keeps integers whole (−1,000, 250). */
export function tickLabel(x: number): string {
  if (x === 0) return "0";
  if (Number.isInteger(x) && Math.abs(x) < 1e6) return (x < 0 ? "−" : "") + group(String(Math.abs(x)));
  return fmt(x, 3);
}

/**
 * A value given by its log₁₀, which may be far outside double range
 * (pO₂ over Al₂O₃ is ~10⁻⁵⁰ bar at 1,000 K): "4.6 × 10⁻¹⁵".
 */
export function fmtFromLog10(log10Value: number, sig = 2): string {
  if (!Number.isFinite(log10Value)) return "–";
  if (log10Value > -4 && log10Value < 6) return fmt(Math.pow(10, log10Value), sig);
  let e = Math.floor(log10Value);
  let m = Number(Math.pow(10, log10Value - e).toPrecision(sig));
  if (m >= 10) {
    m /= 10;
    e += 1;
  }
  return `${trimZeros(m.toFixed(Math.max(0, sig - 1)))} × ${pow10(e)}`;
}

/** Linear map from a domain to a pixel range. */
export function linear(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** Joins the names in a readable list: "FeO, ZnO and SnO₂" (or "… or …"). */
export function listNames(names: string[], conjunction: "and" | "or" = "and"): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names[names.length - 1]}`;
}
