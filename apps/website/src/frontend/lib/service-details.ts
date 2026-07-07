/**
 * Rich per-service detail for the /services deck (ServiceCardStack) — a fuller
 * explanation, four concrete capability chips, and a one-line outcome for each
 * service. The CMS only stores slug/title/summary/icon, so this map (keyed by
 * slug, exactly like SERVICE_IMAGES) carries the deeper copy the "Every service,
 * explained" cards render. A slug missing here degrades gracefully — the card
 * falls back to the summary and generic chips.
 *
 * Copy is drafted to be technically accurate for a real metallurgy & materials
 * R&D lab and distinct per service (no two cards share a capability chip).
 */
export type ServiceDetail = {
  /** 2-sentence explanation shown as the card body (richer than the summary). */
  detail: string;
  /** Exactly 4 specific capability / technique / deliverable chips. */
  points: string[];
  /** One-line "what you walk away with". */
  outcome: string;
};

export const SERVICE_DETAILS: Record<string, ServiceDetail> = {
  "product-process-development": {
    detail:
      "We take your product or process from concept and a lab-scale prototype through pilot runs to a repeatable industrial route. Each step is de-risked with real test data, so what leaves our lab is a specification your plant can run.",
    points: [
      "Lab-scale prototyping",
      "Pilot-run validation",
      "Process route design",
      "Industrial scale-up transfer",
    ],
    outcome: "A production-ready process proven from lab to plant",
  },
  "applied-research-consultancy": {
    detail:
      "When a process problem stalls your line and in-house trials have run dry, we take it end to end — feasibility scoping, a designed experimental program, and root-cause analysis. You get costed recommendations and hands-on support until the fix holds at scale.",
    points: [
      "Feasibility & literature scoping",
      "DOE experimental program",
      "Root-cause investigation",
      "Costed recommendations",
    ],
    outcome: "A fix that holds where in-house trials stalled",
  },
  "process-quality-improvement": {
    detail:
      "When your line loses yield to cracks, porosity, or inclusions, we section and characterize the failed parts to trace each defect to its source. Then we map governing parameters, tighten the process window, and add checks that keep it from returning.",
    points: [
      "Fractography & defect metallography",
      "Inclusion cleanliness rating",
      "Process-window mapping",
      "SPC yield tracking",
    ],
    outcome: "Fewer defects, higher yield, and a controlled process window",
  },
  "product-benchmarking": {
    detail:
      "We put your product and its competitors on the same bench — teardown, composition analysis, and matched property testing — so every claimed difference is measured, not assumed. You learn where your material leads, where it trails, and the real opening to differentiate.",
    points: [
      "Competitor product teardown",
      "OES/XRF composition analysis",
      "Side-by-side property testing",
      "Gap & differentiation analysis",
    ],
    outcome: "A measured scorecard of where you lead and lag",
  },
  "microstructure-heat-treatment": {
    detail:
      "We design and validate heat-treatment cycles — annealing, quenching, tempering, aging and solutionizing — to tune the phases, grain size and precipitates that set your properties. You get a repeatable schedule, proven on micrographs and hardness data, for your target property balance.",
    points: [
      "TTT/CCT cycle design",
      "Quench & temper optimization",
      "Precipitate & aging control",
      "Grain-size & texture control",
    ],
    outcome: "A validated heat-treatment schedule ready for production",
  },
  "modeling-simulations": {
    detail:
      "We model your process and product before any metal is poured — CALPHAD phase prediction, thermal and stress FEA, and solidification simulation — to expose defects and property trade-offs on screen. You reach the plant with narrowed parameters and far fewer physical trials.",
    points: [
      "CALPHAD phase prediction",
      "Thermal & stress FEA",
      "Casting & solidification simulation",
      "Materials property modeling",
    ],
    outcome: "A design proven before the first melt",
  },
  "materials-testing-characterization": {
    detail:
      "We characterize your material across mechanical testing, microstructure imaging, phase identification, and compositional analysis in one workflow. Every test ties back to a data-backed report you can act on — properties measured, structure resolved, and failures explained.",
    points: [
      "Tensile, hardness, impact",
      "SEM & optical microstructure",
      "XRD phase identification",
      "EDS & DSC/TGA analysis",
    ],
    outcome: "A data-backed report on every property and phase",
  },
  "materials-processing-facilities": {
    detail:
      "Run your material through our in-house processing line — melting and casting, powder metallurgy and sintering, rolling and thermo-mechanical forming, and coating or synthesis rigs. We fabricate your samples, tune the route, and scale a proven process from bench to pilot line.",
    points: [
      "Melting & casting furnaces",
      "Powder metallurgy & sintering",
      "Rolling & thermo-mechanical forming",
      "Coating & synthesis lines",
    ],
    outcome: "Fabricated prototypes and a pilot-ready processing route",
  },
};
