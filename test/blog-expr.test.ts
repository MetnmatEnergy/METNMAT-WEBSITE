import { describe, it, expect } from "vitest";
import { compileExpr } from "../apps/website/src/frontend/lib/widgets/expr";

/**
 * The function-plot widget's expression language. Configs are written by a
 * language model, so the parser is a whitelist: these tests pin both what it
 * computes and what it refuses.
 */
const run = (src: string, vars: Record<string, number> = {}, symbols = Object.keys(vars)) => {
  const r = compileExpr(src, symbols);
  if (!r.ok) throw new Error(r.error);
  return r.fn(vars);
};
const refuses = (src: string, symbols: string[] = ["x"]) => {
  const r = compileExpr(src, symbols);
  expect(r.ok, src).toBe(false);
  return r.ok ? "" : r.error;
};

describe("function-plot expressions", () => {
  it("follows ordinary precedence", () => {
    expect(run("2*x + 1", { x: 3 })).toBe(7);
    expect(run("(2 + x) * 3", { x: 1 })).toBe(9);
    expect(run("1 - 2 - 3")).toBe(-4);
    expect(run("8 / 4 / 2")).toBe(1);
    expect(run("-x^2", { x: 3 })).toBe(-9); // as in mathematics, not (-x)^2
    expect(run("2^3^2")).toBe(512); // right-associative
    expect(run("2^-1")).toBe(0.5);
    expect(run("1.5e-3 * 2")).toBeCloseTo(0.003, 12);
  });

  it("knows the listed functions and constants", () => {
    expect(run("exp(ln(5))")).toBeCloseTo(5, 12);
    expect(run("log10(1000) + sqrt(16) + abs(-2)")).toBe(9);
    expect(run("min(3, 1, 2) + max(3, 1, 2)")).toBe(4);
    expect(run("sin(pi/2) + cos(0) + tanh(0)")).toBeCloseTo(2, 12);
    expect(run("erf(1)")).toBeCloseTo(0.8427008, 6);
    expect(run("erf(-1)")).toBeCloseTo(-0.8427008, 6);
    expect(run("F/(R*298.15)")).toBeCloseTo(38.92, 2);
    expect(run("kB*NA/R")).toBeCloseTo(1, 9);
    expect(run("h")).toBe(6.62607015e-34);
  });

  it("accepts declared symbols, including Greek and subscripted names", () => {
    expect(run("η * 2 + T_K", { η: 0.1, T_K: 300 })).toBeCloseTo(300.2, 12);
    expect(run("i0*(exp(0.5*F*η/(R*T)) - exp(-0.5*F*η/(R*T)))", { i0: 1e-3, η: 0, T: 298.15 })).toBe(0);
  });

  it("refuses anything outside the grammar", () => {
    expect(refuses("2x")).toMatch(/missing operator/);
    expect(refuses("alert(1)")).toMatch(/unknown function/);
    expect(refuses("y")).toMatch(/unknown name/);
    expect(refuses("constructor")).toMatch(/unknown name/);
    expect(refuses("toString")).toMatch(/unknown name/);
    expect(refuses("__proto__")).toMatch(/unexpected character/);
    expect(refuses("constructor(1)")).toMatch(/unknown function/);
    expect(refuses("x.constructor")).toMatch(/unexpected character/);
    expect(refuses("x; 1")).toMatch(/unexpected character/);
    expect(refuses("x = 1")).toMatch(/unexpected character/);
    expect(refuses("[1]")).toMatch(/unexpected character/);
    expect(refuses("`x`")).toMatch(/unexpected character/);
    expect(refuses("exp")).toMatch(/is a function/);
    expect(refuses("min(x)")).toMatch(/two or more/);
    expect(refuses("sqrt(1, 2)")).toMatch(/1 argument/);
    expect(refuses("(x + 1")).toMatch(/expected "\)"/);
    expect(refuses("x +")).toMatch(/end of expression/);
    expect(refuses("")).toMatch(/end of expression/);
  });

  it("bounds length and nesting", () => {
    expect(refuses("x+".repeat(300) + "x")).toMatch(/longer than/);
    expect(refuses("(".repeat(60) + "x" + ")".repeat(60))).toMatch(/nested too deeply/);
    expect(refuses("-".repeat(60) + "x")).toMatch(/nested too deeply/);
  });

  it("returns NaN or Infinity rather than throwing for out-of-domain values", () => {
    expect(run("ln(x)", { x: -1 })).toBeNaN();
    expect(run("1/x", { x: 0 })).toBe(Infinity);
  });
});
