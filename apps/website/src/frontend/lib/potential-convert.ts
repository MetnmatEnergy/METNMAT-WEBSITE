/**
 * Reference electrode conversions for /tools/potential-converter.
 *
 * Researchers measure against one reference and must report against another,
 * usually RHE, and Google autocomplete shows them searching for exactly that.
 * Potentials are the textbook values at 25 °C against the standard hydrogen
 * electrode. Real electrodes differ by a few millivolts, which the page says.
 */
export type ReferenceElectrode = {
  id: string;
  label: string;
  /** Potential against SHE at 25 °C, in volts. */
  vsShe: number;
  /** Where this electrode belongs. */
  useIn: string;
};

export const REFERENCE_ELECTRODES: ReferenceElectrode[] = [
  { id: "agcl-sat", label: "Ag/AgCl, saturated KCl", vsShe: 0.197, useIn: "Neutral and acidic solutions" },
  { id: "agcl-3m", label: "Ag/AgCl, 3 M KCl", vsShe: 0.21, useIn: "Neutral and acidic solutions" },
  { id: "agcl-1m", label: "Ag/AgCl, 1 M KCl", vsShe: 0.235, useIn: "Neutral and acidic solutions" },
  { id: "sce", label: "Saturated calomel (SCE)", vsShe: 0.241, useIn: "Aqueous solutions, corrosion work" },
  { id: "hgo-koh", label: "Hg/HgO, 1 M KOH", vsShe: 0.098, useIn: "Alkaline solutions" },
  { id: "hgo-naoh", label: "Hg/HgO, 1 M NaOH", vsShe: 0.14, useIn: "Alkaline solutions" },
  { id: "mse", label: "Hg/Hg₂SO₄, saturated K₂SO₄", vsShe: 0.64, useIn: "Sulfuric acid, chloride-free work" },
  { id: "she", label: "Standard hydrogen electrode (SHE)", vsShe: 0, useIn: "The zero of the scale" },
];

/** RT ln(10) / F at 25 °C, in volts per pH unit. */
export const NERNST_SLOPE = 0.0592;

export const toShe = (measured: number, reference: number) => measured + reference;

/** E(RHE) = E(measured) + E(reference vs SHE) + 0.0592 × pH, at 25 °C. */
export const toRhe = (measured: number, reference: number, pH: number) => toShe(measured, reference) + NERNST_SLOPE * pH;

/** The same potential expressed against a second reference electrode. */
export const toOtherReference = (measured: number, from: number, to: number) => measured + from - to;
