import { describe, it, expect } from "vitest";
import { parseWidget } from "../apps/website/src/frontend/lib/widgets/schemas";
import { CV_EXAMPLE, ELLINGHAM_EXAMPLE, FUNCTION_PLOT_EXAMPLE } from "./fixtures/blog-widget-configs";

/**
 * Widget configs are written by a language model and pasted by an editor, so
 * the schema is the gate between them and the reader. A config either passes
 * whole or the article shows "Interactive model unavailable" with these
 * messages; it is never drawn half-right.
 */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const issues = (widget: string, config: unknown) => {
  const r = parseWidget(widget, config);
  expect(r.ok, JSON.stringify(config).slice(0, 80)).toBe(false);
  return r.ok ? "" : r.issues.join("\n");
};

describe("widget config schemas", () => {
  it("accepts one example of each widget in the prompt's shapes", () => {
    for (const [w, c] of [
      ["ellingham", ELLINGHAM_EXAMPLE],
      ["cyclic-voltammetry", CV_EXAMPLE],
      ["function-plot", FUNCTION_PLOT_EXAMPLE],
    ] as const) {
      const r = parseWidget(w, c);
      expect(r.ok, r.ok ? w : `${w}: ${r.issues.join("; ")}`).toBe(true);
    }
  });

  it("fills documented defaults", () => {
    const r = parseWidget("ellingham", { temperatureRangeC: [0, 1500], lines: ELLINGHAM_EXAMPLE.lines.slice(0, 2) });
    expect(r.ok && r.value.widget === "ellingham" && r.value.config.showScales).toEqual({ pO2: false, H2_H2O: false, CO_CO2: false });
    const cv = clone(CV_EXAMPLE) as Record<string, unknown>;
    delete cv.alpha;
    delete cv.sliders;
    const r2 = parseWidget("cyclic-voltammetry", cv);
    expect(r2.ok && r2.value.widget === "cyclic-voltammetry" && [r2.value.config.alpha, r2.value.config.sliders]).toEqual([
      0.5,
      ["scanRate_V_s", "k0_cm_s", "C_mM"],
    ]);
  });

  it("accepts the config as a JSON string, refuses broken JSON and unknown widgets", () => {
    expect(parseWidget("function-plot", JSON.stringify(FUNCTION_PLOT_EXAMPLE)).ok).toBe(true);
    expect(issues("function-plot", "{ not json")).toMatch(/not valid JSON/);
    expect(issues("phase-diagram", {})).toMatch(/unknown widget "phase-diagram"/);
    expect(issues("ellingham", null)).not.toBe("");
  });

  it("refuses misspelt keys instead of dropping them", () => {
    const c = clone(ELLINGHAM_EXAMPLE) as Record<string, unknown>;
    c.showScale = c.showScales;
    expect(issues("ellingham", c)).toMatch(/showScale/);
  });

  describe("ellingham", () => {
    it("checks highlights, validity ranges and the lines each scale needs", () => {
      const c = clone(ELLINGHAM_EXAMPLE);
      c.highlight = ["2Fe + O2 → 2FeO"]; // ASCII 2, not the label
      expect(issues("ellingham", c)).toMatch(/not the label of any line/);

      const d = clone(ELLINGHAM_EXAMPLE);
      d.lines[0]!.validToK = 200;
      expect(issues("ellingham", d)).toMatch(/validToK must be greater/);

      const noH = clone(ELLINGHAM_EXAMPLE);
      noH.lines = noH.lines.filter((l) => !l.label.startsWith("2H₂"));
      noH.highlight = [];
      expect(issues("ellingham", noH)).toMatch(/H₂\/H₂O scale needs/);

      const noC = clone(ELLINGHAM_EXAMPLE);
      noC.lines = noC.lines.filter((l) => l.label !== "C + O₂ → CO₂");
      expect(issues("ellingham", noC)).toMatch(/CO\/CO₂ scale needs/);

      const range = clone(ELLINGHAM_EXAMPLE);
      range.temperatureRangeC = [1500, 500];
      expect(issues("ellingham", range)).toMatch(/low to high/);
    });

    it("refuses a kink outside its line and duplicate labels", () => {
      const c = clone(ELLINGHAM_EXAMPLE);
      c.lines[3]!.kinks = [{ T_K: 1500, label: "Zn boils" }];
      expect(issues("ellingham", c)).toMatch(/kink lies outside/);
      const d = clone(ELLINGHAM_EXAMPLE);
      d.lines.push(clone(d.lines[0]!));
      expect(issues("ellingham", d)).toMatch(/duplicate label/);
    });
  });

  describe("cyclic-voltammetry", () => {
    it("starts at the positive end, because the bulk species is the oxidised form", () => {
      const c = clone(CV_EXAMPLE);
      c.window_V = [-0.2, 0.6];
      expect(issues("cyclic-voltammetry", c)).toMatch(/starts at the positive end/);
      const d = clone(CV_EXAMPLE);
      d.E0_V = 0.7;
      expect(issues("cyclic-voltammetry", d)).toMatch(/E0_V must lie inside window_V/);
    });

    it("keeps the scan-rate default inside its range and needs kc_s for EC", () => {
      const c = clone(CV_EXAMPLE);
      c.scanRate_V_s.default = 5;
      expect(issues("cyclic-voltammetry", c)).toMatch(/default must lie between/);
      expect(issues("cyclic-voltammetry", { ...clone(CV_EXAMPLE), mechanism: "EC" })).toMatch(/needs kc_s/);
      expect(parseWidget("cyclic-voltammetry", { ...clone(CV_EXAMPLE), mechanism: "EC", kc_s: 2, sliders: ["kc_s"] }).ok).toBe(true);
      expect(issues("cyclic-voltammetry", { ...clone(CV_EXAMPLE), sliders: ["kc_s"] })).toMatch(/only a control for the EC/);
    });

    it("bounds physical inputs to where the model holds", () => {
      expect(issues("cyclic-voltammetry", { ...clone(CV_EXAMPLE), D_cm2_s: 1 })).toMatch(/D_cm2_s/);
      expect(issues("cyclic-voltammetry", { ...clone(CV_EXAMPLE), alpha: 0 })).toMatch(/alpha/);
      expect(issues("cyclic-voltammetry", { ...clone(CV_EXAMPLE), window_V: [2, -2] })).toMatch(/wider than the simulation/);
    });
  });

  describe("function-plot", () => {
    it("parses every expression against the declared symbols", () => {
      const c = clone(FUNCTION_PLOT_EXAMPLE);
      c.curves[0]!.expr = "i0 * exp(b * η)";
      expect(issues("function-plot", c)).toMatch(/curves\.0\.expr: unknown name "b"/);
      const d = clone(FUNCTION_PLOT_EXAMPLE);
      d.curves[0]!.expr = "fetch(1)";
      expect(issues("function-plot", d)).toMatch(/unknown function "fetch"/);
    });

    it("refuses symbols that shadow constants or repeat", () => {
      const c = clone(FUNCTION_PLOT_EXAMPLE);
      c.params[1]!.symbol = "R";
      expect(issues("function-plot", c)).toMatch(/built-in function or constant/);
      const d = clone(FUNCTION_PLOT_EXAMPLE);
      d.params[1]!.symbol = "i0";
      expect(issues("function-plot", d)).toMatch(/declared twice/);
    });

    it("checks slider and axis ranges", () => {
      const c = clone(FUNCTION_PLOT_EXAMPLE);
      c.params[0]!.default = 5;
      expect(issues("function-plot", c)).toMatch(/default must lie between/);
      const d = clone(FUNCTION_PLOT_EXAMPLE);
      d.x = { ...d.x, log: true };
      expect(issues("function-plot", d)).toMatch(/log axis needs min > 0/);
      const e = clone(FUNCTION_PLOT_EXAMPLE);
      e.markers = [{ label: "far", x: 3 }];
      expect(issues("function-plot", e)).toMatch(/outside the x range/);
    });
  });
});
