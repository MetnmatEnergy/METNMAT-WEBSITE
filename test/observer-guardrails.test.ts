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
