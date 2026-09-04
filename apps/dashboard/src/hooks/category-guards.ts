import type { CollectionBeforeDeleteHook } from "payload";
import { staffError } from "../lib/staff-error";

/**
 * A category may not be deleted out from under the things that point at it.
 *
 * `Categories` had no delete guard. `Products.category` is a REQUIRED
 * relationship, so deleting a category left products pointing at an id that no
 * longer resolves — the storefront then renders a product whose category is
 * null, the shop grid loses it from every category listing, and the next save of
 * that product fails validation on a required field the editor cannot see a way
 * to fix. Child categories orphan the same way.
 *
 * Refusing is the right answer rather than cascading: deleting a department
 * should never silently delete or silently re-file the stock inside it. The
 * message says exactly what is in the way and what to do about it, because the
 * person hitting this is a staff member in the admin UI, not a developer.
 */

/** What blocks a category delete, phrased for the person attempting it. */
export function categoryDeleteBlocker(counts: {
  products: number;
  children: number;
  name?: string | null;
}): string | null {
  const { products, children } = counts;
  if (products <= 0 && children <= 0) return null;

  const label = counts.name ? `"${counts.name}"` : "This category";
  const parts: string[] = [];
  if (products > 0) parts.push(`${products} product${products === 1 ? "" : "s"}`);
  if (children > 0) parts.push(`${children} sub-categor${children === 1 ? "y" : "ies"}`);

  const what = parts.join(" and ");
  const fix =
    products > 0 && children > 0
      ? "Move the products to another category and re-parent or remove the sub-categories first."
      : products > 0
        ? "Move those products to another category first, or hide this one instead of deleting it."
        : "Re-parent or remove the sub-categories first.";

  return `${label} still has ${what}. ${fix}`;
}

export const categoryBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req;

  // Two counts, not two document fetches — `count` is an aggregation and does
  // not pull the matching rows across.
  const [products, children, category] = await Promise.all([
    payload.count({
      collection: "products",
      where: { category: { equals: id } },
      overrideAccess: true,
    }),
    payload.count({
      collection: "categories",
      where: { parent: { equals: id } },
      overrideAccess: true,
    }),
    payload
      .findByID({ collection: "categories", id, depth: 0, overrideAccess: true })
      .catch(() => null),
  ]);

  const blocker = categoryDeleteBlocker({
    products: products.totalDocs,
    children: children.totalDocs,
    name: (category as { name?: string } | null)?.name ?? null,
  });

  if (blocker) throw staffError(blocker);
};
