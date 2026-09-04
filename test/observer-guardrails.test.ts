import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  WRITTEN_ATTRIBUTES,
  BODY_OBSERVER_INIT,
  PANEL_OBSERVER_INIT,
  CONTAINER_OBSERVER_INIT,
  observerWatchesWrittenAttributes,
  planA11yWrites,
  PANEL_ID,
  IFRAME_TITLE,
  type WidgetSnapshot,
} from "../apps/website/src/frontend/lib/chat-widget-a11y";

/**
 * Structural guardrails against the loop shapes that froze the homepage.
 *
 * WHY THIS FILE WAS REWRITTEN. Its first version only inspected observers whose
 * root matched /^document(\.body|\.documentElement)?$/. An audit re-introduced
 * the incident byte for byte, merely relocated onto an ELEMENT root — watch the
 * panel with `{ attributes: true, subtree: true }` and write `aria-expanded`
 * back unconditionally — and every rule here passed it. The guardrail failed
 * open on the exact bug it was written for, because it encoded a source-text
 * shape ("is the root document.body?") rather than the property that matters.
 *
 * The property is: AN OBSERVER MUST NEVER WATCH THE ATTRIBUTES IT WRITES.
 * `setAttribute` queues a mutation record even when the value is unchanged, and
 * MutationObserver callbacks are microtasks, so any overlap between the watched
 * set and the written set is a loop that never yields to paint or input.
 *
 * It is now checked twice: as a unit test on the real exported values (strong,
 * and independent of how the source is written), and as a root-agnostic source
 * scan (the net for observers written anywhere else in the app).
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

const files = walk(ROOT).map((p) => ({
  path: p.replace(ROOT, "src").split("\\").join("/"),
  src: readFileSync(p, "utf8"),
}));
const filesRaw = files;

/**
 * Source with comments removed.
 *
 * Every rule below matches source text, and prose kept defeating them in both
 * directions: a comment naming the old API failed an assertion that the API was
 * gone, and a comment containing the word "cycling" SATISFIED an assertion that
 * a guard was present — so deleting the guard went unnoticed. A rule about code
 * should read code.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Every observer init object declared anywhere in the app, by name.
 *
 * Needed because the scan below used to require a brace literal at the call
 * site. Hoisting the chat widget's inits into named constants — which this pass
 * did, so a unit test could check them — made those very calls invisible to the
 * scan. A rule that stops seeing code the moment it is tidied is not a rule.
 */
const INIT_CONSTANTS = new Map<string, string>();
for (const f of filesRaw) {
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(\{[^{}]*\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f.src))) INIT_CONSTANTS.set(m[1]!, m[2]!);
}

/**
 * Every `.observe(<root>, <init>)` call in a file. `init` may be a brace literal
 * or an identifier; identifiers are resolved against INIT_CONSTANTS so a hoisted
 * config is inspected exactly like an inline one. `resolved` is false when an
 * identifier could not be resolved, which the scan reports rather than ignores.
 */
function observeCalls(src: string): { root: string; opts: string; literal: boolean; resolved: boolean }[] {
  const out: { root: string; opts: string; literal: boolean; resolved: boolean }[] = [];
  const re = /\.observe\(\s*([^,()]+?)\s*,\s*([A-Za-z_$][\w$.]*|\{[\s\S]*?\})\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const root = m[1]!.trim();
    const arg = m[2]!.trim();
    if (arg.startsWith("{")) {
      out.push({ root, opts: arg, literal: true, resolved: true });
    } else {
      const looked = INIT_CONSTANTS.get(arg.split(".").pop()!);
      out.push({ root, opts: looked ?? "", literal: false, resolved: looked !== undefined });
    }
  }
  return out;
}

// ── The invariant, checked on the real values ────────────────────────────────

describe("the chat widget never watches what it writes", () => {
  it("writes only the three attributes it declares", () => {
    // Exhaustive over the snapshot shape: whatever the DOM says, the plan may
    // only ever name an attribute from WRITTEN_ATTRIBUTES.
    const bools = [true, false];
    const titles: (string | null | undefined)[] = [null, IFRAME_TITLE, "someone else's title", undefined];
    const expanded = [null, "true", "false", "garbage"];
    const controls = [null, PANEL_ID, "elsewhere"];
    const panels: (boolean | null)[] = [null, true, false];

    const names = new Set<string>();
    for (const hasContainer of bools)
      for (const iframeTitle of titles)
        for (const hasLauncher of bools)
          for (const launcherExpanded of expanded)
            for (const launcherControls of controls)
              for (const panelOpen of panels) {
                const s: WidgetSnapshot = {
                  hasContainer,
                  iframeTitle,
                  hasLauncher,
                  launcherExpanded,
                  launcherControls,
                  panelOpen,
                };
                for (const w of planA11yWrites(s)) names.add(w.name);
              }

    expect([...names].sort()).toEqual([...WRITTEN_ATTRIBUTES].sort());
  });

  it("none of the three observer configurations can be woken by our own writes", () => {
    // The whole invariant. If any of these flips to true the freeze is
    // reachable again, whatever element the observer is pointed at.
    expect(observerWatchesWrittenAttributes(BODY_OBSERVER_INIT)).toBe(false);
    expect(observerWatchesWrittenAttributes(PANEL_OBSERVER_INIT)).toBe(false);
    expect(observerWatchesWrittenAttributes(CONTAINER_OBSERVER_INIT)).toBe(false);
  });

  it("the invariant check itself catches the shapes that froze the page", () => {
    // Positive controls, so a helper that always returned false would fail here.
    // (a) the original: attributes with no filter watches everything, ours too.
    expect(observerWatchesWrittenAttributes({ attributes: true })).toBe(true);
    // (b) the relocated regression: a filter naming an attribute we write.
    expect(
      observerWatchesWrittenAttributes({ attributes: true, attributeFilter: ["aria-expanded"] })
    ).toBe(true);
    expect(
      observerWatchesWrittenAttributes({ attributes: true, attributeFilter: ["style", "title"] })
    ).toBe(true);
    // (c) safe shapes stay safe.
    expect(observerWatchesWrittenAttributes({ attributes: true, attributeFilter: ["style"] })).toBe(false);
    expect(observerWatchesWrittenAttributes({})).toBe(false);
  });

  it("the component uses those shared configurations rather than inline literals", () => {
    // Keeps the unit test above meaningful: if the component inlines its own
    // object again, the values under test stop being the values in use.
    const chat = files.find((f) => f.path.endsWith("chat-widget.tsx"))!;
    expect(chat.src).toMatch(/observe\(panel, PANEL_OBSERVER_INIT\)/);
    expect(chat.src).toMatch(/observe\(container, CONTAINER_OBSERVER_INIT\)/);
    expect(chat.src).toMatch(/observe\(document\.body, BODY_OBSERVER_INIT\)/);
    const inline = observeCalls(chat.src).filter((c) => c.literal);
    expect(inline.map((c) => c.opts), "chat-widget must not inline an observer literal").toEqual([]);
  });
});

// ── Root-agnostic source scan ────────────────────────────────────────────────

describe("MutationObserver guardrails", () => {
  const withMutationObservers = files.filter((f) => /new MutationObserver/.test(f.src));

  it("finds the observers it is meant to police", () => {
    expect(withMutationObservers.length).toBeGreaterThan(0);
  });

  it("no observer anywhere watches attributes without naming them", () => {
    // ROOT-AGNOSTIC, deliberately. The previous version only looked at
    // document-level roots and an element-rooted copy of the incident walked
    // straight through it. An unfiltered attribute observer watches every
    // attribute, including the ones its own callback writes, wherever it points.
    const offenders: string[] = [];
    for (const f of files) {
      for (const call of observeCalls(f.src)) {
        if (!call.resolved) {
          // Never silently skip: an init this scan cannot read is an init it
          // cannot police, and that is how the previous version failed open.
          offenders.push(`${f.path}: observe(${call.root}, …) — init could not be resolved for inspection`);
          continue;
        }
        const watchesAttributes = /attributes\s*:\s*true/.test(call.opts);
        const hasFilter = /attributeFilter\s*:/.test(call.opts);
        if (watchesAttributes && !hasFilter) {
          offenders.push(`${f.path}: observe(${call.root}, ${call.opts.replace(/\s+/g, " ")})`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("no observer filter names an attribute the chat widget writes", () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const call of observeCalls(f.src)) {
        if (!/attributes\s*:\s*true/.test(call.opts)) continue;
        for (const name of WRITTEN_ATTRIBUTES) {
          if (new RegExp(`["']${name}["']`).test(call.opts)) {
            offenders.push(`${f.path}: watches "${name}", which the a11y plan writes`);
          }
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the theme observer in hero-stats passes because it names its attribute", () => {
    const hero = files.find((f) => f.path.endsWith("hero-stats.tsx"));
    expect(hero).toBeDefined();
    const call = observeCalls(hero!.src).find((c) => c.root === "document.documentElement");
    expect(call).toBeDefined();
    expect(call!.opts).toMatch(/attributeFilter\s*:\s*\["class"\]/);
  });
});

describe("ResizeObserver guardrails", () => {
  it("the vaporize wrapper size and the hero display style go through identity-preserving updaters", () => {
    const vapour = files.find((f) => f.path.endsWith("vapour-text-effect.tsx"))!;
    const hero = files.find((f) => f.path.endsWith("hero-stats.tsx"))!;
    expect(vapour.src).not.toMatch(/setWrapperSize\(\s*\{/);
    expect(vapour.src).toMatch(/setWrapperSize\(\(prev\) => nextSize\(/);
    expect(hero.src).not.toMatch(/setStyle\(\s*\{/);
    expect(hero.src).toMatch(/setStyle\(\(prev\) => nextDisplayStyle\(/);
  });

  it("the vaporize ResizeObserver callback never re-samples the canvas itself", () => {
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
  });

  it("the text advance is guarded against a duplicate frame", () => {
    // The loop reschedules before React commits, so the completed branch can be
    // re-entered with the same closure. The functional updater then applies
    // BOTH increments and a stat is skipped — and because a slot runs one
    // instance for the number and another for the label, the two can diverge
    // permanently. The sibling wait-timer branch was already guarded; this is
    // the same guard for the advance beside it.
    expect(vapour.src).toMatch(/shouldAdvance\(vaporizeProgressRef\.current, allVaporized, advanced\)/);
    expect(vapour.src).toMatch(/let advanced = false;/);
    // The unguarded condition must not come back.
    expect(vapour.src).not.toMatch(/if \(vaporizeProgressRef\.current >= 100 && allVaporized\)/);
  });

  it("the frame chain stops instead of respinning when there is nothing to draw", () => {
    // It used to reschedule on the empty-particle path, which is unbounded:
    // nothing on that path can ever satisfy its own exit condition.
    const m = /if \(!canvas \|\| !ctx \|\| !particlesRef\.current\.length\)([\s\S]{0,140})/.exec(vapour.src);
    expect(m, "empty-particle guard not found").not.toBeNull();
    expect(m![1]).not.toMatch(/requestAnimationFrame/);
  });
});

// ── Phase 10: repository-wide structural scan ────────────────────────────────

describe("structural scan", () => {
  it("every setInterval is paired with a clearInterval in the same file", () => {
    const offenders = files
      .filter((f) => /setInterval\s*\(/.test(f.src) && !/clearInterval\s*\(/.test(f.src))
      .map((f) => f.path);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("a self-rescheduling animation loop always has a way to be cancelled", () => {
    // One rAF call is a one-shot (the analytics scroll sampler); two or more in
    // a file is a chain, and a chain with no cancel outlives its component.
    const offenders = files
      .filter((f) => (f.src.match(/requestAnimationFrame\s*\(/g) ?? []).length >= 2)
      .filter((f) => !/cancelAnimationFrame\s*\(/.test(f.src))
      .map((f) => f.path);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("no timer is scheduled from inside a setState updater", () => {
    // A state updater must be a pure function of its argument — React may throw
    // a render away and run it again. The attachment uploader scheduled its
    // upload from inside one, so a re-invocation uploaded the same file twice.
    const offenders: string[] = [];
    for (const f of files) {
      const re = /set[A-Z]\w*\(\s*\(?\s*\w+\s*\)?\s*=>\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.src))) {
        let i = re.lastIndex - 1;
        let depth = 0;
        for (; i < f.src.length; i++) {
          if (f.src[i] === "{") depth++;
          else if (f.src[i] === "}") {
            depth--;
            if (depth === 0) break;
          }
        }
        if (/set(Timeout|Interval)\s*\(/.test(f.src.slice(re.lastIndex, i))) {
          offenders.push(`${f.path}: ${m[0].trim().replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("no setState is called from inside another setState's updater", () => {
    // An updater must be a pure function of the state it is handed. React may
    // call it more than once for a single update — StrictMode does so on
    // purpose in development, and a discarded-and-retried render does so in
    // production — so every nested write fires again each time.
    //
    // The orbital timeline set four other pieces of state (five, counting
    // centerViewOnNode's setRotationAngle) from inside its setExpandedItems
    // updater. Nothing visibly broke only because each write happened to be
    // idempotent, which is exactly what makes the pattern worth removing before
    // somebody adds one that is not.
    const offenders: string[] = [];
    for (const f of files) {
      const src = stripComments(f.src);
      const re = /\bset[A-Z]\w*\(\s*\(?\s*\w+\s*\)?\s*=>\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        let i = re.lastIndex - 1;
        let depth = 0;
        for (; i < src.length; i++) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}") {
            depth--;
            if (depth === 0) break;
          }
        }
        const nested = [...src.slice(re.lastIndex, i).matchAll(/\bset[A-Z]\w*\(/g)].map((x) => x[0]);
        if (nested.length) {
          offenders.push(`${f.path}: ${m[0].trim()} … ${nested.join(" ")}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("only the reference-counted module writes the body scroll lock", () => {
    // Five overlays each saved and restored `overflow` independently, so an
    // interleaved close restored "hidden" and stranded the page unscrollable.
    const offenders = files
      .filter((f) => /body\.style\.(overflow|paddingRight)\s*=/.test(f.src))
      .filter((f) => !f.path.endsWith("lib/scroll-lock.ts"))
      .map((f) => f.path);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the spotlight cards share one pointer listener rather than one per card", () => {
    const card = files.find((f) => f.path.endsWith("spotlight-card.tsx"))!;
    expect(card.src).toMatch(/pointerGlow\.subscribe\(\)/);
    expect(card.src).not.toMatch(/useEffect\([\s\S]{0,400}document\.addEventListener\("pointermove"/);
  });

  it("the analytics collector binds its delegated listeners once", () => {
    const collector = files.find((f) => f.path.endsWith("analytics/collector.ts"))!;
    expect(collector.src).toMatch(/let listenersBound = false;/);
    expect(collector.src).toMatch(/if \(listenersBound \|\| typeof window === "undefined"\) return;/);
    // getTracker must delegate to it, not register listeners inline.
    const getTracker = collector.src.slice(collector.src.indexOf("export function getTracker"));
    expect(getTracker).toMatch(/bindListeners\(\);/);
    expect(getTracker).not.toMatch(/addEventListener\(/);
  });
});

describe("decorative animation loops are gated and release their resources", () => {
  const shader = files.find((f) => f.path.endsWith("animated-shader-background.tsx"))!;
  const highlighter = files.find((f) => f.path.endsWith("highlighter.tsx"))!;

  it("both loops start through the shared gate, not an ad-hoc condition", () => {
    // The rule (viewport AND tab-visibility AND reduced-motion AND not-already-
    // running) is unit-tested once in loop-gate.test.ts. A component that
    // hand-rolls it again is a component that can forget a condition.
    for (const f of [shader, highlighter]) {
      expect(f.src, `${f.path} must use shouldStartLoop`).toMatch(/shouldStartLoop\(\{/);
    }
  });

  it("the shader releases its WebGL context, not just three's objects", () => {
    // dispose() frees three.js's GPU objects but leaves the context alive.
    // Browsers cap live contexts and silently evict the oldest.
    expect(shader.src).toMatch(/renderer\.forceContextLoss\(\)/);
    const loss = shader.src.indexOf("renderer.forceContextLoss()");
    const dispose = shader.src.indexOf("renderer.dispose()");
    expect(loss).toBeGreaterThan(-1);
    expect(dispose).toBeGreaterThan(-1);
    expect(loss, "forceContextLoss must come before dispose").toBeLessThan(dispose);
  });

  it("the shader advances on wall clock, not a fixed step per frame", () => {
    // `iTime += 0.016` ran at double speed on a 120 Hz display.
    expect(shader.src).not.toMatch(/iTime\.value \+= 0\.016/);
    expect(shader.src).toMatch(/iTime\.value \+= delta/);
  });

  it("both loops observe intersection and tab visibility", () => {
    for (const f of [shader, highlighter]) {
      expect(f.src, `${f.path} IntersectionObserver`).toMatch(/new IntersectionObserver\(/);
      expect(f.src, `${f.path} visibilitychange`).toMatch(/addEventListener\("visibilitychange"/);
      expect(f.src, `${f.path} cleanup`).toMatch(/removeEventListener\("visibilitychange"/);
    }
  });

  it("the highlighter no longer pushes the cursor through React state", () => {
    // A mouse reports well above 60 Hz and /contact mounts three consumers, so
    // this re-rendered the particle canvas and both groups per pointer sample.
    expect(highlighter.src).not.toMatch(/useMousePosition/);
    expect(highlighter.src).toMatch(/function useMouseMove\(/);
    expect(highlighter.src).toMatch(/requestAnimationFrame\(\(\) => \{/);
    expect(highlighter.src).toMatch(/"mousemove", handleMouseMove, \{ passive: true \}/);
  });

  it("the highlighter batches its layout reads ahead of its writes", () => {
    // Reading a rect after writing a style forces a synchronous layout; the
    // original interleaved them once per box, twice per box in fact.
    const fn = /const onMouseMove = \(position: MousePosition\) => \{[\s\S]*?\n  \};/.exec(highlighter.src);
    expect(fn, "HighlightGroup onMouseMove not found").not.toBeNull();
    const body = fn![0];
    const lastRead = body.lastIndexOf("getBoundingClientRect");
    const firstWrite = body.indexOf("setProperty");
    expect(lastRead).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(-1);
    expect(lastRead, "every rect must be read before the first style write").toBeLessThan(firstWrite);
  });

  it("the particle colour string is built once per colour, not per particle per frame", () => {
    expect(highlighter.src).not.toMatch(/rgb\.join\(/);
    expect(highlighter.src).toMatch(/const rgbPrefix = React\.useMemo\(/);
  });
});

describe("timed carousels and reveals", () => {
  const byName = (n: string) => files.find((f) => f.path.endsWith(n))!;

  it("Reveal owns its observer instead of using framer-motion's leaky whileInView", () => {
    // framer-motion 11.18.2's InViewFeature.startObserver() returns the
    // unsubscribe from observeIntersection, mount() discards it, and unmount()
    // is empty — so targets are never unobserved. The observer is cached
    // forever in a module-level WeakMap keyed on `document`, and an
    // IntersectionObserver holds a STRONG reference to its targets, so every
    // visit to /about left fifteen detached elements permanently alive.
    const reveal = byName("reveal.tsx");
    const code = stripComments(reveal.src);
    expect(code).not.toMatch(/whileInView/);
    expect(code).not.toMatch(/viewport=\{\{/);
    expect(code).toMatch(/new IntersectionObserver\(/);
    // One-shot: it must stop observing once the element has been seen. The
    // disconnect has to sit inside the callback, not only in the cleanup.
    const callback = /new IntersectionObserver\(([\s\S]*?)\{ rootMargin/.exec(code);
    expect(callback, "could not isolate the observer callback").not.toBeNull();
    expect(callback![1], "must disconnect on entry, not just on unmount").toMatch(/io\.disconnect\(\)/);
    expect(code).toMatch(/animate=\{entered \? "visible" : "hidden"\}/);
  });

  /** The `useEffect` block that owns a file's setInterval, deps array included. */
  function intervalEffect(src: string): string {
    const at = src.indexOf("setInterval(");
    expect(at, "no setInterval in this file").toBeGreaterThan(-1);
    const start = src.lastIndexOf("useEffect(", at);
    const end = src.indexOf("]);", at);
    expect(start, "no enclosing useEffect").toBeGreaterThan(-1);
    expect(end, "no deps array after the interval").toBeGreaterThan(at);
    return src.slice(start, end + 3);
  }

  it("every wall-clock cycler is gated on viewport AND tab visibility", () => {
    // These ran for the life of the page: a product tab left open in the
    // background kept advancing its gallery and decoding the next image.
    //
    // Checking that the file merely CALLS the hook is not enough — the call can
    // stay while the guard that uses it is deleted. The guard has to be inside
    // the effect that owns the timer, and `visible` has to be in its deps or
    // the effect never re-runs when visibility changes.
    for (const name of [
      "commerce/product-gallery.tsx",
      "commerce/shop-showcase.tsx",
      "ui/animated-text-cycle.tsx",
    ]) {
      const f = byName(name);
      expect(f.src, `${name} must use the shared gate`).toMatch(/useVisibleInViewport\(/);
      const effect = intervalEffect(stripComments(f.src));
      const split = effect.lastIndexOf("}, [");
      expect(split, `${name}: could not find the deps array`).toBeGreaterThan(-1);
      // Body and deps are checked separately, or the deps array alone satisfies
      // the body's assertion and deleting the guard goes unnoticed.
      const body = effect.slice(0, split);
      const deps = effect.slice(split);
      expect(body, `${name}: the interval effect body must consult the gate`).toMatch(
        /\bvisible\b|\bcycling\b/
      );
      expect(deps, `${name}: the gate must be a dependency of the interval effect`).toMatch(
        /\bvisible\b|\bcycling\b/
      );
    }
  });

  it("the gate is one implementation, not a copy per component", () => {
    // Hand-rolling this is what let the /about shader check the viewport in one
    // caller and forget it in the other.
    const hook = byName("lib/use-visible-in-viewport.ts");
    expect(hook.src).toMatch(/new IntersectionObserver\(/);
    expect(hook.src).toMatch(/io\.disconnect\(\)/);
    expect(hook.src).toMatch(/addEventListener\("visibilitychange"/);
    expect(hook.src).toMatch(/removeEventListener\("visibilitychange"/);
    expect(hook.src).toMatch(/return inView && pageVisible;/);

    // No consumer may re-derive it with its own observer plus listener pair.
    const consumers = [
      "commerce/product-gallery.tsx",
      "commerce/shop-showcase.tsx",
      "ui/animated-text-cycle.tsx",
    ].map(byName);
    for (const f of consumers) {
      expect(stripComments(f.src), `${f.path} must not hand-roll the gate`).not.toMatch(
        /addEventListener\("visibilitychange"/
      );
    }
  });
});
