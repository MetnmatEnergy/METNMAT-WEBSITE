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
  /**
   * Products filed here by an edit nobody has published yet. Counted apart
   * because "1 product" would send staff to a shop listing that does not show
   * it — the move is real, it just is not live.
   */
  draftProducts?: number;
  name?: string | null;
}): string | null {
  const { products, children } = counts;
  // Optional and coerced: a caller that omits it must read as "none", never as
  // "unknown, so block". An omitted count previously produced a refusal naming
  // "undefined products", which the existing empty-category test caught.
  const draftProducts = Number(counts.draftProducts) || 0;
  if (products <= 0 && children <= 0 && draftProducts <= 0) return null;

  const label = counts.name ? `"${counts.name}"` : "This category";
  const parts: string[] = [];
  if (products > 0) parts.push(`${products} product${products === 1 ? "" : "s"}`);
  if (draftProducts > 0) {
    parts.push(
      `${draftProducts} product${draftProducts === 1 ? "" : "s"} with unpublished changes filing ${draftProducts === 1 ? "it" : "them"} here`,
    );
  }
  if (children > 0) parts.push(`${children} sub-categor${children === 1 ? "y" : "ies"}`);

  const what =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  const anyProducts = products > 0 || draftProducts > 0;
  const fix =
    anyProducts && children > 0
      ? "Move the products to another category and re-parent or remove the sub-categories first."
      : anyProducts
        ? "Move those products to another category first — publishing or discarding the draft changes counts — or hide this one instead of deleting it."
        : "Re-parent or remove the sub-categories first.";

  return `${label} still has ${what}. ${fix}`;
}

export const categoryBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req;

  // Two counts, not two document fetches — `count` is an aggregation and does
  // not pull the matching rows across.
  /*
   * Three counts, because the published filing is not the whole filing.
   *
   * Products has drafts, so a draft REVISION moving a product INTO this
   * category is written only to _products_versions (utilities/update.js guards
   * the main write with `if (!isSavingDraft)`). Counting the main collection
   * alone let the category be deleted, and publishing afterwards left
   * Products.category — a REQUIRED relationship — pointing at nothing.
   *
   * The reverse needs nothing: a draft moving a product OUT still counts here,
   * because the published document is still filed in this category. Refusing
   * then is conservative rather than wrong.
   *
   * Sub-categories need no version search — Categories has no versions key, so
   * its main collection IS its whole state.
   */
  const [products, draftProducts, children, category] = await Promise.all([
    payload.count({
      collection: "products",
      where: { category: { equals: id } },
      overrideAccess: true,
    }),
    payload.countVersions({
      collection: "products",
      where: {
        and: [
          { latest: { equals: true } },
          { "version._status": { equals: "draft" } },
          { "version.category": { equals: id } },
        ],
      },
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
    draftProducts: draftProducts.totalDocs,
    children: children.totalDocs,
    name: (category as { name?: string } | null)?.name ?? null,
  });

  if (blocker) throw staffError(blocker);
};
