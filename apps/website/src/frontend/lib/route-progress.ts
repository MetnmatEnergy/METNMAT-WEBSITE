/**
 * Which clicks mean "a page navigation is starting".
 *
 * Kept out of the component for the same reason as pay-flow.ts and
 * focus-trap.ts: this is the part with all the edge cases, and the root test
 * runner cannot transform JSX, so logic that needs testing lives in a .ts file.
 *
 * The list of clicks that must NOT start the bar is far longer than the list
 * that must, and every one of them is a way to flash a progress bar at someone
 * who is not going anywhere — which is worse than no bar, because it teaches
 * people to ignore it.
 */

/** Below this, a navigation is imperceptible and a flashed bar is worse than none. */
export const SHOW_AFTER_MS = 120;

/**
 * Hard stop. A committed route is the normal end signal, but a navigation that
 * is cancelled — a second click, a redirect back to the same path, a route that
 * throws — would otherwise leave the bar running forever.
 */
export const SAFETY_MS = 12_000;

/** The minimum shape of a click this needs to read. */
export type NavClick = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
};

/**
 * The pathname this click will navigate to, or null if it will not navigate
 * anywhere new.
 *
 * `currentPathname` and `origin` are passed in rather than read from `window`
 * so the decision is a pure function of its inputs.
 */
export function targetPathname(
  e: NavClick,
  currentPathname: string,
  origin: string
): string | null {
  if (e.defaultPrevented) return null;
  // Anything but a plain left click is the browser's business: new tab, new
  // window, download, context menu.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;

  const el =
    e.target && typeof (e.target as Element).closest === "function"
      ? (e.target as Element).closest("a")
      : null;
  if (!el) return null;

  const linkTarget = el.getAttribute("target");
  if (linkTarget && linkTarget !== "_self") return null;
  if (el.hasAttribute("download")) return null;

  const href = el.getAttribute("href");
  if (!href) return null;
  // A bare hash, or a scheme that hands off to another application entirely.
  if (/^(#|mailto:|tel:|sms:|javascript:)/i.test(href)) return null;

  let url: URL;
  try {
    url = new URL(href, `${origin}${currentPathname}`);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;

  // Same page. Covers the commonest false positives: the logo on the homepage,
  // the active nav item, a breadcrumb pointing at where you already are — and
  // query-only or hash-only changes, which the shop's own transition handles
  // better than a top bar could.
  return url.pathname === currentPathname ? null : url.pathname;
}
