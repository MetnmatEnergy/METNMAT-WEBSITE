/**
 * Config contracts for the blog's interactive models.
 *
 * The weekly article generator (docs/blog/MASTER-PROMPT.md, "Widget library")
 * makes a language model write a JSON config for one of these widgets, never
 * code. This file is the other half of that contract: each config is checked
 * here, on the server, before any widget code is sent to the reader. A config
 * that fails renders a visible "model unavailable" panel listing the reasons
 * instead of a broken or misleading plot.
 *
 * Objects are strict on purpose: a misspelt optional key ("showScale") would
 * otherwise be dropped silently and the model would render without it.
 *
 * Adding a widget = a schema here + a component in
 * frontend/components/blog/widgets + its id in the CMS select
 * (apps/dashboard/src/blocks/blog-blocks.ts) + a line in the prompt's
 * widget library. test/blog-widget-registry.test.ts keeps the lists in step.
 */
import { z } from "zod";
import { reductantOf, coLine, ZERO_C_IN_K } from "./ellingham-math";
import { compileExpr, RESERVED, SYMBOL_PATTERN } from "./expr";
import { parseFormula } from "./pourbaix-math";

export const WIDGET_IDS = ["ellingham", "cyclic-voltammetry", "function-plot", "pourbaix"] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

const label = (max = 80) => z.string().trim().min(1).max(max);
const text = (max = 80) => z.string().trim().max(max);

// ── ellingham ────────────────────────────────────────────────────────────────

const ellinghamLine = z
  .strictObject({
    label: label(),
    A_kJ: z.number().min(-3000).max(1000),
    B_kJ_per_K: z.number().min(-1).max(1),
    validFromK: z.number().min(0).max(6000),
    validToK: z.number().min(0).max(6000),
    kinks: z
      .array(z.strictObject({ T_K: z.number().min(0).max(6000), label: label(40) }))
      .max(6)
      .default([]),
  })
  .superRefine((l, ctx) => {
    if (l.validToK <= l.validFromK) {
      ctx.addIssue({ code: "custom", path: ["validToK"], message: "validToK must be greater than validFromK" });
    }
    l.kinks.forEach((k, i) => {
      if (k.T_K < l.validFromK || k.T_K > l.validToK) {
        ctx.addIssue({ code: "custom", path: ["kinks", i, "T_K"], message: "kink lies outside the line's validity range" });
      }
    });
  });

export const ellinghamConfig = z
  .strictObject({
    temperatureRangeC: z.tuple([z.number().min(-273.15).max(5000), z.number().min(-273.15).max(5000)]),
    lines: z.array(ellinghamLine).min(1).max(24),
    showScales: z
      .strictObject({
        pO2: z.boolean().default(false),
        H2_H2O: z.boolean().default(false),
        CO_CO2: z.boolean().default(false),
      })
      .default({ pO2: false, H2_H2O: false, CO_CO2: false }),
    highlight: z.array(label()).max(24).default([]),
  })
  .superRefine((c, ctx) => {
    const [lo, hi] = c.temperatureRangeC;
    if (hi <= lo) {
      ctx.addIssue({ code: "custom", path: ["temperatureRangeC"], message: "the range must run from low to high" });
    }
    const labels = new Set<string>();
    c.lines.forEach((l, i) => {
      if (labels.has(l.label)) ctx.addIssue({ code: "custom", path: ["lines", i, "label"], message: `duplicate label "${l.label}"` });
      labels.add(l.label);
    });
    c.highlight.forEach((h, i) => {
      if (!labels.has(h)) ctx.addIssue({ code: "custom", path: ["highlight", i], message: `"${h}" is not the label of any line` });
    });
    const loK = lo + ZERO_C_IN_K;
    const hiK = hi + ZERO_C_IN_K;
    if (!c.lines.some((l) => l.validToK > loK && l.validFromK < hiK)) {
      ctx.addIssue({ code: "custom", path: ["lines"], message: "no line is valid anywhere in temperatureRangeC" });
    }
    if (c.showScales.H2_H2O && !c.lines.some((l) => reductantOf(l.label) === "H2")) {
      ctx.addIssue({
        code: "custom",
        path: ["showScales", "H2_H2O"],
        message: 'the H₂/H₂O scale needs a "2H₂ + O₂ → 2H₂O" line',
      });
    }
    if (c.showScales.CO_CO2 && !coLine(c.lines)) {
      ctx.addIssue({
        code: "custom",
        path: ["showScales", "CO_CO2"],
        message: 'the CO/CO₂ scale needs a "2CO + O₂ → 2CO₂" line, or both "2C + O₂ → 2CO" and "C + O₂ → CO₂"',
      });
    }
  });
export type EllinghamConfig = z.output<typeof ellinghamConfig>;

// ── cyclic-voltammetry ───────────────────────────────────────────────────────

export const CV_SLIDERS = ["scanRate_V_s", "k0_cm_s", "C_mM", "kc_s"] as const;

export const cvConfig = z
  .strictObject({
    mechanism: z.enum(["E", "EC"]).default("E"),
    n: z.number().int().min(1).max(4).default(1),
    E0_V: z.number().min(-3).max(3),
    ref: label(60),
    k0_cm_s: z.number().min(1e-7).max(100),
    alpha: z.number().min(0.1).max(0.9).default(0.5),
    D_cm2_s: z.number().min(1e-8).max(1e-3),
    C_mM: z.number().min(1e-3).max(1000),
    area_cm2: z.number().min(1e-6).max(100),
    scanRate_V_s: z.strictObject({
      min: z.number().min(1e-4).max(1000),
      max: z.number().min(1e-4).max(1000),
      default: z.number().min(1e-4).max(1000),
    }),
    window_V: z.tuple([z.number().min(-4).max(4), z.number().min(-4).max(4)]),
    kc_s: z.number().min(0).max(1e6).optional(),
    sliders: z.array(z.enum(CV_SLIDERS)).max(4).default(["scanRate_V_s", "k0_cm_s", "C_mM"]),
  })
  .superRefine((c, ctx) => {
    const { min, max, default: d } = c.scanRate_V_s;
    if (max <= min) ctx.addIssue({ code: "custom", path: ["scanRate_V_s", "max"], message: "max must be greater than min" });
    if (d < min || d > max) ctx.addIssue({ code: "custom", path: ["scanRate_V_s", "default"], message: "default must lie between min and max" });
    const [start, vertex] = c.window_V;
    if (start <= vertex) {
      ctx.addIssue({
        code: "custom",
        path: ["window_V"],
        message: "the bulk species is the oxidised form, so the scan starts at the positive end: window_V[0] must be greater than window_V[1]",
      });
    } else if (c.E0_V >= start || c.E0_V <= vertex) {
      ctx.addIssue({ code: "custom", path: ["E0_V"], message: "E0_V must lie inside window_V" });
    }
    if (Math.abs(start - vertex) * c.n > 3) {
      ctx.addIssue({ code: "custom", path: ["window_V"], message: "the window is wider than the simulation allows (3 V / n)" });
    }
    if (c.mechanism === "EC" && c.kc_s === undefined) {
      ctx.addIssue({ code: "custom", path: ["kc_s"], message: "the EC mechanism needs kc_s" });
    }
    if (c.mechanism === "E" && c.sliders.includes("kc_s")) {
      ctx.addIssue({ code: "custom", path: ["sliders"], message: "kc_s is only a control for the EC mechanism" });
    }
    if (new Set(c.sliders).size !== c.sliders.length) {
      ctx.addIssue({ code: "custom", path: ["sliders"], message: "a slider is listed twice" });
    }
  });
export type CvConfig = z.output<typeof cvConfig>;

// ── function-plot ────────────────────────────────────────────────────────────

const symbol = z
  .string()
  .regex(SYMBOL_PATTERN, "a symbol is a letter followed by letters, digits or _")
  .max(12)
  .refine((s) => !RESERVED.has(s), { message: "this name is a built-in function or constant" });

export const functionPlotConfig = z
  .strictObject({
    x: z.strictObject({
      symbol,
      label: label(60),
      unit: text(20).default(""),
      min: z.number(),
      max: z.number(),
      log: z.boolean().default(false),
    }),
    y: z.strictObject({
      label: label(60),
      unit: text(20).default(""),
      log: z.boolean().default(false),
      // Optional fixed axis. Without it the axis is fitted once, across every
      // slider's range, so it does not jump while the reader drags.
      min: z.number().optional(),
      max: z.number().optional(),
    }),
    params: z
      .array(
        z.strictObject({
          symbol,
          label: label(60),
          unit: text(20).default(""),
          min: z.number(),
          max: z.number(),
          step: z.number().positive(),
          default: z.number(),
        }),
      )
      .max(8)
      .default([]),
    curves: z.array(z.strictObject({ label: label(60), expr: z.string().trim().min(1).max(500) })).min(1).max(6),
    markers: z.array(z.strictObject({ label: label(40), x: z.number() })).max(8).default([]),
  })
  .superRefine((c, ctx) => {
    if (c.x.max <= c.x.min) ctx.addIssue({ code: "custom", path: ["x", "max"], message: "max must be greater than min" });
    if (c.x.log && c.x.min <= 0) ctx.addIssue({ code: "custom", path: ["x", "min"], message: "a log axis needs min > 0" });
    if (c.y.min !== undefined && c.y.max !== undefined && c.y.max <= c.y.min) {
      ctx.addIssue({ code: "custom", path: ["y", "max"], message: "max must be greater than min" });
    }
    if (c.y.log && c.y.min !== undefined && c.y.min <= 0) {
      ctx.addIssue({ code: "custom", path: ["y", "min"], message: "a log axis needs min > 0" });
    }
    const seen = new Set([c.x.symbol]);
    c.params.forEach((p, i) => {
      if (seen.has(p.symbol)) ctx.addIssue({ code: "custom", path: ["params", i, "symbol"], message: `symbol "${p.symbol}" is declared twice` });
      seen.add(p.symbol);
      if (p.max <= p.min) ctx.addIssue({ code: "custom", path: ["params", i, "max"], message: "max must be greater than min" });
      if (p.default < p.min || p.default > p.max) {
        ctx.addIssue({ code: "custom", path: ["params", i, "default"], message: "default must lie between min and max" });
      }
      if (p.step > p.max - p.min) ctx.addIssue({ code: "custom", path: ["params", i, "step"], message: "step is larger than the range" });
    });
    c.curves.forEach((cv, i) => {
      const r = compileExpr(cv.expr, seen);
      if (!r.ok) ctx.addIssue({ code: "custom", path: ["curves", i, "expr"], message: r.error });
    });
    c.markers.forEach((m, i) => {
      if (m.x < c.x.min || m.x > c.x.max) ctx.addIssue({ code: "custom", path: ["markers", i, "x"], message: "marker lies outside the x range" });
    });
  });
export type FunctionPlotConfig = z.output<typeof functionPlotConfig>;

// ── pourbaix ─────────────────────────────────────────────────────────────────

const range = (lo: number, hi: number) => z.tuple([z.number().min(lo).max(hi), z.number().min(lo).max(hi)]);

export const pourbaixConfig = z
  .strictObject({
    element: z.string().regex(/^[A-Z][a-z]?$/, "an element symbol, e.g. Fe"),
    species: z
      .array(
        z.strictObject({
          formula: z.string().regex(/^[A-Za-z0-9()]{1,24}$/, "ASCII composition without the charge, e.g. Fe2O3 or HFeO2"),
          charge: z.number().int().min(-4).max(6).default(0),
          label: label(24),
          phase: z.enum(["s", "aq"]),
          dGf_kJ_mol: z.number().min(-20000).max(5000),
        }),
      )
      .min(2)
      .max(16),
    logActivity: z
      .strictObject({ min: z.number().min(-12).max(0), max: z.number().min(-12).max(0), default: z.number().min(-12).max(0) })
      .default({ min: -8, max: 0, default: -6 }),
    pHRange: range(-4, 18).default([-2, 16]),
    ERange_V: range(-4, 4).default([-1.8, 2.2]),
    showWaterLines: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    const { min, max, default: d } = c.logActivity;
    if (max <= min) ctx.addIssue({ code: "custom", path: ["logActivity", "max"], message: "max must be greater than min" });
    if (d < min || d > max) ctx.addIssue({ code: "custom", path: ["logActivity", "default"], message: "default must lie between min and max" });
    if (c.pHRange[1] <= c.pHRange[0]) ctx.addIssue({ code: "custom", path: ["pHRange"], message: "the range must run from low to high" });
    if (c.ERange_V[1] <= c.ERange_V[0]) ctx.addIssue({ code: "custom", path: ["ERange_V"], message: "the range must run from low to high" });
    const labels = new Set<string>();
    const keys = new Set<string>();
    let metals = 0;
    c.species.forEach((sp, i) => {
      const comp = parseFormula(sp.formula, c.element);
      if (typeof comp === "string") ctx.addIssue({ code: "custom", path: ["species", i, "formula"], message: comp });
      if (sp.phase === "s" && sp.charge !== 0) {
        ctx.addIssue({ code: "custom", path: ["species", i, "charge"], message: "a solid phase is neutral" });
      }
      if (labels.has(sp.label)) ctx.addIssue({ code: "custom", path: ["species", i, "label"], message: `duplicate label "${sp.label}"` });
      labels.add(sp.label);
      const key = `${sp.formula}|${sp.charge}|${sp.phase}`;
      if (keys.has(key)) ctx.addIssue({ code: "custom", path: ["species", i, "formula"], message: `${sp.formula} (charge ${sp.charge}) is listed twice` });
      keys.add(key);
      if (sp.formula === c.element && sp.charge === 0 && sp.phase === "s") {
        metals++;
        if (sp.dGf_kJ_mol !== 0) ctx.addIssue({ code: "custom", path: ["species", i, "dGf_kJ_mol"], message: "the metal is the reference state: 0 kJ/mol" });
      }
    });
    if (metals !== 1) {
      ctx.addIssue({ code: "custom", path: ["species"], message: `list the metal itself once: { formula: "${c.element}", phase: "s", dGf_kJ_mol: 0 }` });
    }
  });
export type PourbaixConfig = z.output<typeof pourbaixConfig>;

// ── registry ─────────────────────────────────────────────────────────────────

const SCHEMAS = {
  ellingham: ellinghamConfig,
  "cyclic-voltammetry": cvConfig,
  "function-plot": functionPlotConfig,
  pourbaix: pourbaixConfig,
} as const satisfies Record<WidgetId, z.ZodType>;

export type WidgetConfigs = { [K in WidgetId]: z.output<(typeof SCHEMAS)[K]> };
export type ValidWidget = { [K in WidgetId]: { widget: K; config: WidgetConfigs[K] } }[WidgetId];

export type WidgetParse = { ok: true; value: ValidWidget } | { ok: false; issues: string[] };

const isWidgetId = (w: unknown): w is WidgetId => typeof w === "string" && (WIDGET_IDS as readonly string[]).includes(w);

/**
 * Validates one interactive block from the CMS. `config` may arrive as an
 * object (Payload's JSON field) or as a JSON string (a hand-edited import).
 */
export function parseWidget(widget: unknown, config: unknown): WidgetParse {
  if (!isWidgetId(widget)) {
    return { ok: false, issues: [`unknown widget "${String(widget ?? "")}" (known: ${WIDGET_IDS.join(", ")})`] };
  }
  let raw = config;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, issues: ["config is not valid JSON"] };
    }
  }
  const r = SCHEMAS[widget].safeParse(raw);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.slice(0, 8).map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)),
    };
  }
  return { ok: true, value: { widget, config: r.data } as ValidWidget };
}
