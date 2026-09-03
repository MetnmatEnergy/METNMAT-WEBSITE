import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural guardrails against the two observer patterns that froze the
 * homepage. Both were written in good faith, both looked reasonable in review,
 * and both saturated the main thread in production. A rule that reads the
 * source is the only thing that catches the NEXT one before it ships.
 *
 * Pattern 1 — the self-feeding MutationObserver (03c1d5f, the incident).
 *   Observing a document-level root with `attributes: true` and no
 *   `attributeFilter` means EVERY attribute write on the page wakes the
 *   callback — including the callback's own. setAttribute fires even when the
 *   value is unchanged, MutationObserver callbacks are microtasks, and a
 *   microtask loop never yields. That is a hard freeze.
 *
 * Pattern 2 — the fresh-object state write from an observer (01bc7eb).
 *   `setState({ ... })` from a ResizeObserver callback re-renders every time by
 *   reference, and if that state feeds an effect which resizes the observed
 *   element, the cycle is closed. Guarded by identity-preserving updaters in
 *   lib/stable-updates.ts.
 *
 * These scan the website source. They are deliberately narrow: they encode the
 * exact mistake, not a general style preference, so they will not nag about
 * legitimate observers.
 */

const ROOT = join(__dirname, "..", "apps", "website", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT).map((p) => ({ path: p.replace(ROOT, "src"), src: readFileSync(p, "utf8") }));

/** Every `.observe(<root>, { ...opts })` call in a file, with its options text. */
function observeCalls(src: string): { root: string; opts: string }[] {
  const out: { root: string; opts: string }[] = [];
  const re = /\.observe\(\s*([^,()]+?)\s*,\s*(\{[\s\S]*?\})\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ root: m[1]!.trim(), opts: m[2]! });
  return out;
}

const DOCUMENT_ROOTS = /^document(\.body|\.documentElement)?$/;

describe("MutationObserver guardrails", () => {
  const withMutationObservers = files.filter((f) => /new MutationObserver/.test(f.src));

  it("finds the observers it is meant to police", () => {
    // If this ever hits zero the scan has broken, not the codebase.
    expect(withMutationObservers.length).toBeGreaterThan(0);
  });

  it("never watches a document-level root for attributes without an attributeFilter", () => {
    const offenders: string[] = [];
    for (const f of withMutationObservers) {
      for (const call of observeCalls(f.src)) {
        const isDocumentRoot = DOCUMENT_ROOTS.test(call.root);
        const watchesAttributes = /attributes\s*:\s*true/.test(call.opts);
        const hasFilter = /attributeFilter\s*:/.test(call.opts);
        if (isDocumentRoot && watchesAttributes && !hasFilter) {
          offenders.push(`${f.path}: observe(${call.root}, ${call.opts.replace(/\s+/g, " ")})`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the theme observer in hero-stats passes because it names its attribute", () => {
    // A positive control: this is the legitimate shape. It watches <html> for
    // `class` only, and its callback writes no attributes.
    const hero = files.find((f) => f.path.endsWith("hero-stats.tsx"));
    expect(hero).toBeDefined();
    const call = observeCalls(hero!.src).find((c) => c.root === "document.documentElement");
    expect(call).toBeDefined();
    expect(call!.opts).toMatch(/attributeFilter\s*:\s*\["class"\]/);
  });

  it("the chat widget observer no longer watches attributes on body at all", () => {
    // The regression itself, pinned. Phase A watches body for childList only.
    const chat = files.find((f) => f.path.endsWith("chat-widget.tsx"));
    expect(chat).toBeDefined();
    const bodyCalls = observeCalls(chat!.src).filter((c) => c.root === "document.body");
    expect(bodyCalls.length).toBeGreaterThan(0);
    for (const c of bodyCalls) {
      expect(c.opts, c.opts).not.toMatch(/attributes\s*:\s*true/);
    }
  });
});

describe("ResizeObserver guardrails", () => {
  it("the vaporize wrapper size and the hero display style go through identity-preserving updaters", () => {
    // Pinning the second fix. If someone reverts to `setWrapperSize({ width, height })`
    // the feedback loop returns; the updater form is the only safe one here.
    const vapour = files.find((f) => f.path.endsWith("vapour-text-effect.tsx"))!;
    const hero = files.find((f) => f.path.endsWith("hero-stats.tsx"))!;
    expect(vapour.src).not.toMatch(/setWrapperSize\(\s*\{/);
    expect(vapour.src).toMatch(/setWrapperSize\(\(prev\) => nextSize\(/);
    expect(hero.src).not.toMatch(/setStyle\(\s*\{/);
    expect(hero.src).toMatch(/setStyle\(\(prev\) => nextDisplayStyle\(/);
  });

  it("the vaporize ResizeObserver callback never re-samples the canvas itself", () => {
    // The callback once called renderCanvas directly, with the closure from the
    // first render: every notification re-sampled synchronously and painted
    // texts[0] over the current stat, and a real size change rebuilt twice. The
    // identity-gated size state feeds the rebuild effect; that is the one path.
    const vapour = files.find((f) => f.path.endsWith("vapour-text-effect.tsx"))!;
    const m = /new ResizeObserver\(([\s\S]*?)\);\s*resizeObserver\.observe/.exec(vapour.src);
    expect(m, "could not locate the vaporize ResizeObserver body").not.toBeNull();
    expect(m![1]).not.toMatch(/renderCanvas\(/);
  });
});

describe("vaporize cost guardrails", () => {
  const vapour = files.find((f) => f.path.endsWith("vapour-text-effect.tsx"))!;

  it("the backing scale is capped, not devicePixelRatio × 1.5", () => {
    expect(vapour.src).not.toMatch(/devicePixelRatio\s*\*\s*1\.5/);
    expect(vapour.src).toMatch(/effectiveDpr\(/);
  });

  it("the frame loop is refused in the idle states before any frame is requested", () => {
    const guard = vapour.src.indexOf("if (!isAnimating(animationState))");
    const firstFrame = vapour.src.indexOf("requestAnimationFrame(");
    expect(guard).toBeGreaterThan(-1);
    expect(firstFrame).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(firstFrame);
  });

  it("the wait timer is held in a ref and cleared, not discarded", () => {
    expect(vapour.src).toMatch(/waitTimerRef\.current = window\.setTimeout\(/);
    expect(vapour.src).toMatch(/window\.clearTimeout\(waitTimerRef\.current\)/);
    expect(vapour.src).not.toMatch(/^\s*setTimeout\(\(\) => \{\s*$/m);
  });
});
