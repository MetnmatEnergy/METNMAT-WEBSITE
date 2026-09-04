import type { DefaultValue, PayloadRequest } from "payload";

/**
 * Where a NEW category lands in the shop menu.
 *
 * THE BUG THIS FIXES. `Categories.order` defaulted to 0 while the seeded
 * departments run 1-11 (SHOP_DEPARTMENTS in seed.ts). The storefront asks the
 * CMS for `/api/categories?sort=order` and renders that list verbatim — the
 * website's `mapCategory` does not even keep the number, so there is no second
 * sort anywhere that could correct it. The result: creating a category, with no
 * thought about ordering at all, silently pushed it ahead of Electrodes at the
 * top of the shop grid and the header dropdown. Nothing in the admin said so,
 * and the person who noticed was rarely the person who created it. Two new
 * categories both landed on 0 and tied.
 *
 * A new row now defaults to (highest existing order) + 1, so it lands at the
 * END and the menu does not move until someone deliberately moves it.
 */

/** The number a new category gets when there is nothing to follow. */
export const FIRST_ORDER = 1;

/**
 * Where a new category lands when the highest existing order cannot be read.
 *
 * Falling back to 0 — or to leaving the field empty — would reinstate the bug:
 * MongoDB sorts both 0 and a missing value ahead of the seeded 1-11. A high
 * number keeps the degraded case pointing the same way as the healthy one, at
 * the cost of a gap in the numbering, which nothing depends on.
 */
export const FALLBACK_ORDER = 999;

/** (highest existing order) + 1, or FIRST_ORDER when there is no usable maximum. */
export function nextOrderAfter(highest: unknown): number {
  return typeof highest === "number" && Number.isFinite(highest)
    ? Math.floor(highest) + 1
    : FIRST_ORDER;
}

/**
 * Read the single highest `order` in the collection and return the next one.
 *
 * `sort: "-order", limit: 1` fetches one document, not the collection. MongoDB
 * orders null/missing below every number, so descending puts the true maximum
 * first — which is why a null there means every row is null, and the answer is
 * FIRST_ORDER rather than NaN. `pagination: false` is deliberately NOT passed:
 * it makes Payload ignore `limit` and return everything.
 *
 * `overrideAccess` for the same reason category-guards uses it — this is a
 * position calculation, not a read of anyone's data, and the answer must not
 * depend on who is looking.
 *
 * NEVER THROWS. `getFallbackValue` (payload/dist/fields/hooks/beforeValidate)
 * does not wrap `defaultValue` in a try/catch, so an error escaping here would
 * fail the staff member's save outright.
 */
export async function nextCategoryOrder(req: PayloadRequest | undefined): Promise<number> {
  try {
    const payload = req?.payload;
    if (!payload) return FALLBACK_ORDER;

    const res = await payload.find({
      collection: "categories",
      sort: "-order",
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const top = res.docs[0] as { order?: unknown } | undefined;
    if (!top) return FIRST_ORDER;
    return nextOrderAfter(top.order);
  } catch {
    return FALLBACK_ORDER;
  }
}

/**
 * The field-level `defaultValue`. Payload resolves it in two places, both
 * server-side and both awaited (verified in the installed payload@3.85.1):
 *
 *   payload/dist/fields/getDefaultValue.js
 *     — the save path, via beforeValidate, only when the value is undefined,
 *       so an update never re-runs it against an existing row.
 *   @payloadcms/ui/.../calculateDefaultValues/promise.js
 *     — the admin form state, so the create form is PRE-FILLED with the number
 *       instead of showing a blank box.
 *
 * The args carry `req`/`user`/`locale` only — no `data` — so the default cannot
 * be scoped to the new row's parent. It does not need to be: a global max + 1
 * is at least as large as every sibling, so a new sub-category also lands last
 * within its own parent.
 */
export const categoryOrderDefault: DefaultValue = ({ req }) => nextCategoryOrder(req);
