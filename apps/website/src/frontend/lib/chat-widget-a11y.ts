/**
 * The accessibility attributes the host applies to the third-party chat widget,
 * expressed as a pure plan: "given what the DOM says now, which attributes need
 * writing?" The component performs the writes; this decides them.
 *
 * THE BUG THIS EXISTS FOR — the homepage "Page Unresponsive" freeze.
 *
 * The first version lived inside a MutationObserver on `document.body` with
 * `subtree: true, attributes: true`, and on every callback it did
 *
 *     launcher.setAttribute("aria-expanded", String(open));
 *
 * unconditionally. Two facts make that a hard freeze:
 *
 *   1. `setAttribute` queues a mutation record EVEN WHEN THE VALUE IS UNCHANGED.
 *      That is the DOM specification, not a quirk. The launcher sits inside the
 *      observed subtree, so the callback's own write re-fired the callback.
 *
 *   2. MutationObserver callbacks are microtasks. The ResizeObserver loop fixed
 *      earlier at least ran inside the rendering steps and yielded a frame; a
 *      microtask loop never yields to paint, layout or input at all. The event
 *      loop simply never gets to the end of its queue, and Chrome offers to kill
 *      the page.
 *
 * It armed only after the visitor's first interaction (the widget is deferred
 * until then) and only once the widget had built its DOM — a few seconds later.
 * So the page rendered, responded briefly, and then froze. That is the incident.
 *
 * The fix is the property this module makes testable: when the DOM already says
 * what we want, the plan is EMPTY, so the callback performs no write and the
 * cycle has nothing to feed on. Identity of intent, not just of value.
 */

export type WidgetSnapshot = {
  /** Whether the widget's container exists in the document yet. */
  hasContainer: boolean;
  /** Current `title` on the widget's iframe, or null if absent / no iframe. */
  iframeTitle: string | null | undefined;
  /** Whether the launcher button exists. */
  hasLauncher: boolean;
  /** Current `aria-expanded` on the launcher, or null if absent. */
  launcherExpanded: string | null;
  /** Current `aria-controls` on the launcher, or null if absent. */
  launcherControls: string | null;
  /** Whether the panel exists and is currently displayed. Null if no panel. */
  panelOpen: boolean | null;
};

export type AttributeWrite = {
  target: "iframe" | "launcher";
  name: string;
  value: string;
};

export const IFRAME_TITLE = "Chat with a METNMAT specialist";
export const PANEL_ID = "chat-widget-frame-container";

/**
 * Every attribute name planA11yWrites is capable of writing.
 *
 * This is half of the invariant that keeps the freeze dead. The other half is
 * the observer init objects below: the set of attributes we WATCH and the set
 * we WRITE must not intersect, or a write can wake the callback that performed
 * it — and MutationObserver callbacks are microtasks, so that loop never yields.
 */
export const WRITTEN_ATTRIBUTES = ["title", "aria-expanded", "aria-controls"] as const;

/**
 * The three observer configurations the widget uses, as values rather than
 * literals buried in the component, so a test can check them against
 * WRITTEN_ATTRIBUTES instead of pattern-matching source text.
 *
 *  - body: wait for the widget's container to appear. childList only; a node
 *    being added is not something an attribute write can produce.
 *  - panel: follow the panel opening and closing, which the widget does through
 *    inline `display`. `style` only — never an attribute we write.
 *  - container: re-apply if the widget rebuilds its children.
 */
export const BODY_OBSERVER_INIT: MutationObserverInit = { childList: true, subtree: true };
export const PANEL_OBSERVER_INIT: MutationObserverInit = { attributes: true, attributeFilter: ["style"] };
export const CONTAINER_OBSERVER_INIT: MutationObserverInit = { childList: true };

export type ObserverInit = {
  readonly attributes?: boolean;
  readonly attributeFilter?: readonly string[];
};

/**
 * Would an observer configured like this be woken by our own writes?
 *
 * True is a defect: it is the shape that froze the homepage. Note that watching
 * attributes with NO filter counts as watching all of them — that is exactly
 * what the original `{ subtree: true, attributes: true }` on document.body did.
 */
export function observerWatchesWrittenAttributes(init: ObserverInit): boolean {
  if (!init.attributes) return false;
  if (!init.attributeFilter) return true;
  const written = WRITTEN_ATTRIBUTES as readonly string[];
  return init.attributeFilter.some((name) => written.includes(name));
}

/**
 * The writes required to bring the widget's markup up to standard.
 *
 * Every entry is guarded by the current value, so a DOM that already matches
 * yields an empty plan. That emptiness is what stops the observer feeding
 * itself — it must never be relaxed.
 */
export function planA11yWrites(s: WidgetSnapshot): AttributeWrite[] {
  if (!s.hasContainer) return [];
  const writes: AttributeWrite[] = [];

  // `undefined` means there is no iframe; `null` means it exists without a title.
  if (s.iframeTitle === null) {
    writes.push({ target: "iframe", name: "title", value: IFRAME_TITLE });
  }

  if (s.hasLauncher && s.panelOpen !== null) {
    const want = String(s.panelOpen);
    if (s.launcherExpanded !== want) {
      writes.push({ target: "launcher", name: "aria-expanded", value: want });
    }
    if (s.launcherControls !== PANEL_ID) {
      writes.push({ target: "launcher", name: "aria-controls", value: PANEL_ID });
    }
  }

  return writes;
}
