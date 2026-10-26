/**
 * Whitelist expression language for the `function-plot` widget.
 *
 * Article configs come from a language model and an editor, so an expression
 * is DATA: it is tokenised and parsed here into a tree, and evaluated by
 * walking that tree. Nothing reaches eval, new Function or the DOM. Anything
 * outside the grammar below is a parse error, which the widget shows instead
 * of a plot.
 *
 *   expr    := term (("+" | "-") term)*
 *   term    := unary (("*" | "/") unary)*
 *   unary   := ("-" | "+") unary | power
 *   power   := primary ("^" unary)?          right-associative; -x^2 = -(x^2)
 *   primary := number | name | name "(" expr ("," expr)* ")" | "(" expr ")"
 *
 * Names are the declared symbols plus the constants below; functions are the
 * fixed list in FUNCTIONS. Implicit multiplication ("2x") is an error.
 */

export const CONSTANTS: Readonly<Record<string, number>> = {
  pi: Math.PI,
  F: 96485.33212, // C mol⁻¹
  R: 8.314462618, // J mol⁻¹ K⁻¹
  kB: 1.380649e-23, // J K⁻¹
  h: 6.62607015e-34, // J s
  NA: 6.02214076e23, // mol⁻¹
};

/** Abramowitz & Stegun 7.1.26, |error| < 1.5e-7. */
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

type Fn = { arity: number | "2+"; fn: (...a: number[]) => number };
export const FUNCTIONS: Readonly<Record<string, Fn>> = {
  exp: { arity: 1, fn: Math.exp },
  ln: { arity: 1, fn: Math.log },
  log10: { arity: 1, fn: Math.log10 },
  sqrt: { arity: 1, fn: Math.sqrt },
  abs: { arity: 1, fn: Math.abs },
  min: { arity: "2+", fn: Math.min },
  max: { arity: "2+", fn: Math.max },
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tanh: { arity: 1, fn: Math.tanh },
  erf: { arity: 1, fn: erf },
};

/** Own-property lookup, so "toString" or "constructor" never resolve through the prototype. */
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Names reserved by the language; a declared symbol may not reuse one. */
export const RESERVED = new Set([...Object.keys(CONSTANTS), ...Object.keys(FUNCTIONS)]);

/** Latin or Greek letter first, then letters, digits or "_" (T, T_K, k0, η, ΔG). */
export const SYMBOL_PATTERN = /^[A-Za-zΑ-Ωα-ω][A-Za-zΑ-Ωα-ω0-9_]*$/;

type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { k: "call"; name: string; args: Node[] };

type Token = { t: "num"; v: number; at: number } | { t: "name"; v: string; at: number } | { t: "op"; v: string; at: number };

const MAX_LENGTH = 500;
const MAX_DEPTH = 40;

export class ExprError extends Error {}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: "num", v: Number(num[0]), at: i });
      i += num[0].length;
      continue;
    }
    const name = /^[A-Za-zΑ-Ωα-ω][A-Za-zΑ-Ωα-ω0-9_]*/.exec(src.slice(i));
    if (name) {
      out.push({ t: "name", v: name[0], at: i });
      i += name[0].length;
      continue;
    }
    if ("+-*/^(),".includes(ch)) {
      out.push({ t: "op", v: ch, at: i });
      i++;
      continue;
    }
    throw new ExprError(`unexpected character "${ch}" at position ${i + 1}`);
  }
  return out;
}

function parse(src: string, symbols: ReadonlySet<string>): Node {
  if (src.length > MAX_LENGTH) throw new ExprError(`expression longer than ${MAX_LENGTH} characters`);
  const toks = tokenize(src);
  let pos = 0;
  let depth = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => {
    const t = peek();
    return t?.t === "op" && t.v === v;
  };
  const expect = (v: string) => {
    if (!isOp(v)) {
      const t = peek();
      throw new ExprError(t ? `expected "${v}" at position ${t.at + 1}` : `expected "${v}" at the end`);
    }
    pos++;
  };
  const enter = () => {
    if (++depth > MAX_DEPTH) throw new ExprError("expression nested too deeply");
  };

  const expr = (): Node => {
    enter();
    let a = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[pos++] as { v: "+" | "-" }).v;
      a = { k: "bin", op, a, b: term() };
    }
    depth--;
    return a;
  };
  const term = (): Node => {
    let a = unary();
    while (isOp("*") || isOp("/")) {
      const op = (toks[pos++] as { v: "*" | "/" }).v;
      a = { k: "bin", op, a, b: unary() };
    }
    return a;
  };
  const unary = (): Node => {
    if (isOp("-")) {
      pos++;
      enter();
      const a = unary();
      depth--;
      return { k: "neg", a };
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  };
  const power = (): Node => {
    const base = primary();
    if (isOp("^")) {
      pos++;
      enter();
      const exp = unary();
      depth--;
      return { k: "bin", op: "^", a: base, b: exp };
    }
    return base;
  };
  const primary = (): Node => {
    const t = peek();
    if (!t) throw new ExprError("unexpected end of expression");
    if (t.t === "num") {
      pos++;
      return { k: "num", v: t.v };
    }
    if (t.t === "name") {
      pos++;
      if (isOp("(")) {
        const fn = own(FUNCTIONS, t.v) ? FUNCTIONS[t.v] : undefined;
        if (!fn) throw new ExprError(`unknown function "${t.v}"`);
        pos++;
        const args = [expr()];
        while (isOp(",")) {
          pos++;
          args.push(expr());
        }
        expect(")");
        if (fn.arity === "2+" ? args.length < 2 : args.length !== fn.arity) {
          throw new ExprError(`${t.v}() takes ${fn.arity === "2+" ? "two or more arguments" : `${fn.arity} argument`}`);
        }
        return { k: "call", name: t.v, args };
      }
      if (own(FUNCTIONS, t.v)) throw new ExprError(`${t.v} is a function: write ${t.v}(…)`);
      if (!symbols.has(t.v) && !own(CONSTANTS, t.v)) throw new ExprError(`unknown name "${t.v}"`);
      return { k: "var", name: t.v };
    }
    if (t.v === "(") {
      pos++;
      const inner = expr();
      expect(")");
      return inner;
    }
    throw new ExprError(`unexpected "${t.v}" at position ${t.at + 1}`);
  };

  const tree = expr();
  const rest = peek();
  if (rest) {
    throw new ExprError(
      rest.t === "name" || rest.t === "num" || rest.v === "("
        ? `missing operator before position ${rest.at + 1} (write 2*x, not 2x)`
        : `unexpected "${rest.v}" at position ${rest.at + 1}`,
    );
  }
  return tree;
}

function evaluate(n: Node, vars: Readonly<Record<string, number>>): number {
  switch (n.k) {
    case "num":
      return n.v;
    case "var":
      return own(vars, n.name) ? vars[n.name]! : CONSTANTS[n.name]!;
    case "neg":
      return -evaluate(n.a, vars);
    case "bin": {
      const a = evaluate(n.a, vars);
      const b = evaluate(n.b, vars);
      switch (n.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return a / b;
        case "^":
          return Math.pow(a, b);
      }
      break;
    }
    case "call":
      return FUNCTIONS[n.name]!.fn(...n.args.map((x) => evaluate(x, vars)));
  }
  return NaN;
}

export type Compiled = (vars: Readonly<Record<string, number>>) => number;

/**
 * Parses `src` against the declared symbols. Returns an evaluator, or the
 * reason it was refused. Declared symbols win over constants of the same name,
 * but the config schema refuses such collisions before it gets here.
 */
export function compileExpr(src: string, symbols: Iterable<string>): { ok: true; fn: Compiled } | { ok: false; error: string } {
  try {
    const tree = parse(src, new Set(symbols));
    return { ok: true, fn: (vars) => evaluate(tree, vars) };
  } catch (e) {
    if (e instanceof ExprError) return { ok: false, error: e.message };
    throw e;
  }
}
