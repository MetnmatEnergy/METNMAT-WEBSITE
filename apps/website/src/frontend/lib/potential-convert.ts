/**
 * Reference electrode conversions for /tools/potential-converter.
 *
 * Researchers measure against one reference and must report against another,
 * usually RHE, and Google autocomplete shows them searching for exactly that.
 * Potentials are against the standard hydrogen electrode at 25 °C, checked on
 * 2026-11-04 against Bard & Faulkner, Metrohm AN-EC-002 and the papers cited on
 * the page. Where sources disagree, the electrode's `note` says so in plain words.
 */
export type ElectrodeFamily = {
  id: string;
  name: string;
  /** The element on the tile in the dropdown. */
  symbol: string;
  hint: string;
};

export const ELECTRODE_FAMILIES: ElectrodeFamily[] = [
  { id: "agcl", name: "Silver chloride, Ag/AgCl", symbol: "Ag", hint: "Neutral and acidic solutions" },
  { id: "calomel", name: "Calomel, SCE", symbol: "Hg", hint: "Aqueous solutions, corrosion work" },
  { id: "hgo", name: "Mercury oxide, Hg/HgO", symbol: "Hg", hint: "Alkaline solutions" },
  { id: "mse", name: "Mercurous sulfate, Hg/Hg₂SO₄", symbol: "Hg", hint: "Sulfuric acid, chloride-free work" },
  { id: "hydrogen", name: "Hydrogen scales", symbol: "H", hint: "The scales results are reported on" },
];

export type ReferenceElectrode = {
  id: string;
  family: string;
  /** The full name, shown on the dropdown button and in the table. */
  label: string;
  /** The filling solution, shown under the family in the dropdown. */
  fill: string;
  /** The name used in the formula. */
  short: string;
  /** Potential against SHE at 25 °C, in volts. */
  vsShe: number;
  /** True only for RHE, whose zero moves with the electrolyte. */
  followsPh?: boolean;
  /** Where this electrode belongs. */
  useIn: string;
  /** Where published figures differ from this one. */
  note?: string;
  /** The pH range outside which this electrode should not sit in the cell. */
  fit?: { minPh?: number; maxPh?: number; warning: string };
};

const AGCL_FIT = { maxPh: 13, warning: "Ag/AgCl does not suit strong alkali. Hg/HgO is the usual choice there." };
const HGO_FIT = { minPh: 7, warning: "Hg/HgO belongs in alkaline solutions, because HgO dissolves in acid." };
const MSE_FIT = { maxPh: 7, warning: "Hg/Hg₂SO₄ does not suit alkaline solutions. Hg/HgO is the usual choice there." };

export const REFERENCE_ELECTRODES: ReferenceElectrode[] = [
  { id: "agcl-sat", family: "agcl", label: "Ag/AgCl, saturated KCl", fill: "Saturated KCl", short: "Ag/AgCl", vsShe: 0.197, useIn: "Neutral and acidic solutions", note: "Published figures run from +0.195 to +0.199 V.", fit: AGCL_FIT },
  { id: "agcl-35m", family: "agcl", label: "Ag/AgCl, 3.5 M KCl", fill: "3.5 M KCl", short: "Ag/AgCl", vsShe: 0.205, useIn: "Neutral and acidic solutions", fit: AGCL_FIT },
  { id: "agcl-3m", family: "agcl", label: "Ag/AgCl, 3 M KCl", fill: "3 M KCl", short: "Ag/AgCl", vsShe: 0.21, useIn: "Neutral and acidic solutions", fit: AGCL_FIT },
  { id: "agcl-1m", family: "agcl", label: "Ag/AgCl, 1 M KCl", fill: "1 M KCl", short: "Ag/AgCl", vsShe: 0.235, useIn: "Neutral and acidic solutions", fit: AGCL_FIT },
  { id: "sce", family: "calomel", label: "Saturated calomel (SCE)", fill: "Saturated KCl", short: "SCE", vsShe: 0.241, useIn: "Aqueous solutions, corrosion work", note: "Published figures run from +0.241 to +0.244 V." },
  { id: "hgo-koh", family: "hgo", label: "Hg/HgO, 1 M KOH", fill: "1 M KOH", short: "Hg/HgO", vsShe: 0.098, useIn: "Alkaline solutions", note: "The figure most papers use. At pH 14 it puts Hg/HgO 0.927 V above RHE, in line with the 0.923 to 0.927 V labs measure. Some papers use +0.094 to +0.108 V.", fit: HGO_FIT },
  { id: "hgo-naoh", family: "hgo", label: "Hg/HgO, 1 M NaOH", fill: "1 M NaOH", short: "Hg/HgO", vsShe: 0.108, useIn: "Alkaline solutions", note: "Calculated from activity data. Metrohm's table lists +0.140 V, which puts results about 30 mV higher.", fit: HGO_FIT },
  { id: "mse", family: "mse", label: "Hg/Hg₂SO₄, saturated K₂SO₄", fill: "Saturated K₂SO₄", short: "Hg/Hg₂SO₄", vsShe: 0.64, useIn: "Sulfuric acid, chloride-free work", note: "Some handbooks give +0.65 V.", fit: MSE_FIT },
  { id: "mse-h2so4", family: "mse", label: "Hg/Hg₂SO₄, 0.5 M H₂SO₄", fill: "0.5 M H₂SO₄", short: "Hg/Hg₂SO₄", vsShe: 0.68, useIn: "Sulfuric acid, chloride-free work", fit: MSE_FIT },
  { id: "rhe", family: "hydrogen", label: "Reversible hydrogen (RHE)", fill: "RHE", short: "RHE", vsShe: 0, followsPh: true, useIn: "Comparing results across pH" },
  { id: "she", family: "hydrogen", label: "Standard hydrogen (SHE)", fill: "SHE", short: "SHE", vsShe: 0, useIn: "The zero of the scale" },
];

/** The usual pH figures for common electrolytes, as papers quote them. */
export const ELECTROLYTE_PRESETS = [
  { label: "0.5 M H₂SO₄", pH: 0.3 },
  { label: "0.1 M HClO₄", pH: 1 },
  { label: "PBS", pH: 7.4 },
  { label: "0.1 M KOH", pH: 13 },
  { label: "1 M KOH", pH: 14 },
];

/** RT ln(10) / F at 25 °C, in volts per pH unit. */
export const NERNST_SLOPE = 0.0592;

export const electrodeById = (id: string) => REFERENCE_ELECTRODES.find((r) => r.id === id) ?? REFERENCE_ELECTRODES[0];

/** Where this scale's zero sits against SHE. Only RHE depends on the pH. */
export const zeroVsShe = (r: ReferenceElectrode, pH: number) => (r.followsPh ? -NERNST_SLOPE * pH : r.vsShe);

/** The same potential, counted from a different zero. */
export const convert = (measured: number, from: ReferenceElectrode, to: ReferenceElectrode, pH: number) =>
  measured + zeroVsShe(from, pH) - zeroVsShe(to, pH);

/** The sum behind `convert`, as the terms the page shows. Zero terms are left out. */
export function conversionTerms(measured: number, from: ReferenceElectrode, to: ReferenceElectrode, pH: number) {
  const terms = [{ label: "your reading", value: measured }];
  if (from.id === to.id) return terms;
  const offset = (r: ReferenceElectrode, sign: 1 | -1) => {
    if (r.followsPh) terms.push({ label: `0.0592 × pH ${pH}`, value: -sign * NERNST_SLOPE * pH });
    else if (r.vsShe !== 0) terms.push({ label: `${r.short} vs SHE`, value: sign * r.vsShe });
  };
  offset(from, 1);
  offset(to, -1);
  return terms;
}

/** Why this electrode should not be in a cell at this pH, if it should not. */
export function phWarning(r: ReferenceElectrode, pH: number) {
  if (!r.fit) return undefined;
  const { minPh = -Infinity, maxPh = Infinity, warning } = r.fit;
  return pH < minPh || pH > maxPh ? warning : undefined;
}

/** A signed number with a true minus sign, and no "−0.000". */
export function signed(v: number, digits = 3) {
  const text = Math.abs(v).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${v > 0 ? "+" : "−"}${text}`;
}

export const volts = (v: number) => `${signed(v)} V`;

export const formatVsShe = (r: ReferenceElectrode) => (r.followsPh ? "−0.0592 × pH" : volts(r.vsShe));

/** Reads what people type: a comma for a point, and a true minus sign. */
export function parseNumber(text: string) {
  const t = text.trim().replace("−", "-").replace(",", ".");
  return t === "" ? NaN : Number(t);
}

export type RulerWindow = { min: number; max: number; step: number };

/**
 * The stretch of the SHE axis the ruler shows. It holds still for everyday
 * values, so the rulers slide rather than rescale, and widens only when a
 * value would fall off the end.
 */
export function rulerWindow(values: number[]): RulerWindow {
  const lo = Math.min(-1, ...values);
  const hi = Math.max(1.5, ...values);
  const raw = (hi - lo) / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const m = raw / power;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * power;
  return { min: Math.floor((lo - step / 4) / step) * step, max: Math.ceil((hi + step / 4) / step) * step, step };
}

/** The ticks of one ruler, in its own volts, reaching past both ends so a slide never shows a gap. */
export function rulerTicks(view: RulerWindow, zero: number) {
  const minor = view.step / 5;
  const reach = view.max - view.min;
  const first = Math.floor((view.min - zero - reach / 2) / view.step) * 5;
  const last = Math.ceil((view.max - zero + reach / 2) / view.step) * 5;
  const digits = view.step >= 1 ? 0 : 1;
  const ticks: { volts: number; label?: string }[] = [];
  for (let i = first; i <= last; i++) {
    ticks.push({ volts: i === 0 ? 0 : i * minor, label: i % 5 === 0 ? (i === 0 ? "0" : signed(i * minor, digits)) : undefined });
  }
  return ticks;
}
