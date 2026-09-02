/**
 * Focus-trap arithmetic, kept free of the DOM so it can be tested.
 *
 * The hook in `components/ui/use-dialog.ts` does the querying and focusing; this
 * decides only WHERE focus should land, which is the part that is easy to get
 * subtly wrong and impossible to eyeball.
 */

/**
 * Everything the browser will tab to. `[tabindex="-1"]` is excluded on purpose:
 * a dialog container is given tabIndex -1 so it can receive focus
 * programmatically, but it must not become a tab stop of its own.
 */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Where Tab should move focus inside a dialog, or null to let the browser do
 * what it was going to do anyway.
 *
 * Returning null for the ordinary case matters: intercepting every Tab would
 * override the browser's own ordering, which already handles reading order,
 * disabled controls appearing mid-list, and anything the DOM query got wrong.
 * We only take over at the two edges, where the browser would otherwise walk
 * out of the dialog and into the page behind it.
 */
export function wrapTabTarget<T>(items: T[], active: T | null, shiftKey: boolean): T | null {
  if (items.length === 0) return null;

  const first = items[0];
  const last = items[items.length - 1];

  const index = active === null ? -1 : items.indexOf(active);

  // Focus is on the container itself, or somewhere outside the list (a
  // programmatic focus, or a control that has since been disabled). Pull it back
  // to the appropriate end rather than letting Tab escape.
  if (index === -1) return shiftKey ? last : first;

  if (shiftKey) return index === 0 ? last : null;
  return index === items.length - 1 ? first : null;
}
