/**
 * One config per blog widget, in the exact shapes of the Widget library block
 * in docs/blog/MASTER-PROMPT.md. Used by the schema tests and to fill a local
 * draft article when checking the widgets by eye.
 *
 * The thermodynamic coefficients are rounded textbook values (Gaskell,
 * Introduction to the Thermodynamics of Materials) chosen to exercise the
 * widget, NOT reviewed data for publication.
 */
export const ELLINGHAM_EXAMPLE = {
  temperatureRangeC: [0, 2000],
  lines: [
    { label: "4Cu + O₂ → 2Cu₂O", A_kJ: -324.4, B_kJ_per_K: 0.138, validFromK: 298, validToK: 1356 },
    { label: "2Ni + O₂ → 2NiO", A_kJ: -471.2, B_kJ_per_K: 0.1724, validFromK: 298, validToK: 1726 },
    { label: "2Fe + O₂ → 2FeO", A_kJ: -544, B_kJ_per_K: 0.138, validFromK: 298, validToK: 1644 },
    {
      label: "2Zn + O₂ → 2ZnO",
      A_kJ: -697.4,
      B_kJ_per_K: 0.1975,
      validFromK: 298,
      validToK: 1180,
      kinks: [{ T_K: 693, label: "Zn melts" }],
    },
    { label: "2Zn(g) + O₂ → 2ZnO", A_kJ: -921.4, B_kJ_per_K: 0.3871, validFromK: 1180, validToK: 2200 },
    { label: "Si + O₂ → SiO₂", A_kJ: -907.1, B_kJ_per_K: 0.175, validFromK: 298, validToK: 1685 },
    { label: "4/3Al + O₂ → 2/3Al₂O₃", A_kJ: -1115, B_kJ_per_K: 0.209, validFromK: 298, validToK: 2327 },
    { label: "2C + O₂ → 2CO", A_kJ: -223.4, B_kJ_per_K: -0.1753, validFromK: 298, validToK: 2500 },
    { label: "C + O₂ → CO₂", A_kJ: -394.1, B_kJ_per_K: -0.00084, validFromK: 298, validToK: 2500 },
    { label: "2H₂ + O₂ → 2H₂O", A_kJ: -492.9, B_kJ_per_K: 0.1096, validFromK: 298, validToK: 2500 },
  ],
  showScales: { pO2: true, H2_H2O: true, CO_CO2: true },
  highlight: ["2Fe + O₂ → 2FeO", "2C + O₂ → 2CO"],
};

export const CV_EXAMPLE = {
  mechanism: "E",
  n: 1,
  E0_V: 0.22,
  ref: "vs Ag/AgCl (3 M KCl)",
  k0_cm_s: 0.005,
  alpha: 0.5,
  D_cm2_s: 7.6e-6,
  C_mM: 1,
  area_cm2: 0.0707,
  scanRate_V_s: { min: 0.01, max: 1, default: 0.05 },
  window_V: [0.6, -0.2],
  sliders: ["scanRate_V_s", "k0_cm_s", "C_mM"],
};

export const FUNCTION_PLOT_EXAMPLE = {
  x: { symbol: "η", label: "Overpotential", unit: "V", min: -0.25, max: 0.25, log: false },
  y: { label: "Current density", unit: "mA/cm²", log: false, min: -20, max: 20 },
  params: [
    { symbol: "i0", label: "Exchange current density", unit: "mA/cm²", min: 0.01, max: 2, step: 0.01, default: 0.5 },
    { symbol: "a", label: "Transfer coefficient", unit: "", min: 0.2, max: 0.8, step: 0.05, default: 0.5 },
  ],
  curves: [
    { label: "Butler–Volmer", expr: "i0*(exp(a*F*η/(R*298.15)) - exp(-(1-a)*F*η/(R*298.15)))" },
    { label: "Anodic Tafel line", expr: "i0*exp(a*F*η/(R*298.15))" },
  ],
  markers: [{ label: "Equilibrium", x: 0 }],
};
