import type { CollectionAfterChangeHook } from "payload";

/**
 * Catalog slug redirects — the shop's half of what BlogSlugRedirects already
 * does for /blog.
 *
 * THE BUG THIS FIXES. Renaming a product or a category hard-404'd every URL
 * that had ever been indexed, linked or bookmarked. The slug field's own help
 * text advertises the change ("Changing it changes the product's public URL"),
 * and the field's beforeValidate hook REGENERATES the slug from the name
 * whenever the box is left empty — so fixing a typo in a product NAME silently
 * moved its URL without the staff member ever touching the slug box.
 *
 * WHY THE ROW HOLDS A RELATIONSHIP AND NOT A DESTINATION SLUG. This is the
 * whole design. A -> B -> C leaves two rows, {A -> doc} and {B -> doc}, and the
 * website reads the CURRENT slug off the live document. Both old URLs 301 to
 * /shop/p/C in ONE hop. Chains cannot form, because no row ever points at
 * another row.
 *
 * THE ONE PLACE THIS IMPROVES ON THE BLOG. Posts.ts clears a shadowing redirect
 * only on a slug CHANGE, and payload@3.85.1 passes `previousDoc: {}` on create
 * (collections/operations/create.js:285), so the clear never runs when a new
 * document takes a slug some older document redirects from. The row then sits
 * dormant — the live document wins, because the route looks the document up
 * before it looks the redirect up — until that document is unpublished, at
 * which point its own URL 301s to a different product. The invariant is "no
 * redirect may exist whose oldSlug is the slug of a live document", and it is
 * enforced here on every transition that can create a shadow: a rename, AND the
 * moment a document becomes public.
 */

export type SlugRedirectPlan = {
  /** Delete any redirect parked on this slug — a live document owns it now. */
  clearShadowFor: string | null;
  /** Record this slug as a former public URL of the document being saved. */
  mintFor: string | null;
};

/**
 * The whole decision, as a pure function, so every case below is testable
 * without a Payload runtime or a database.
 *
 * `wasPublic`/`isPublic` are supplied by the caller because the two collections
 * mean different things by "public": a product is public when its version is
 * published (it has drafts), a category when it is not hidden (it does not).
 */
export function slugRedirectPlan(args: {
  previousSlug?: string | null;
  wasPublic: boolean;
  nextSlug?: string | null;
  isPublic: boolean;
}): SlugRedirectPlan {
  const { previousSlug, nextSlug, wasPublic, isPublic } = args;
  const renamed = Boolean(previousSlug && nextSlug && previousSlug !== nextSlug);
  // Did the version we are replacing actually occupy a public URL? On a create
  // there is no previous slug at all, which is exactly the case the blog misses.
  const hadPublicUrl = Boolean(previousSlug) && wasPublic;
  return {
    mintFor: renamed && hadPublicUrl ? previousSlug! : null,
    clearShadowFor: isPublic && nextSlug && (renamed || !hadPublicUrl) ? nextSlug : null,
  };
}

type RedirectConfig = {
  /** The system-managed collection holding this document's former URLs. */
  redirects: "product-slug-redirects" | "category-slug-redirects";
  /** The relationship field on that collection pointing back at the document. */
  targetField: "product" | "category";
  /** Is this version of the document the one the public is served? */
  isPublic: (doc: Record<string, unknown> | undefined) => boolean;
  /** Prefix for the log line when upkeep fails. */
  label: string;
};

function catalogSlugRedirect(cfg: RedirectConfig): CollectionAfterChangeHook {
  return async ({ req, doc, previousDoc }) => {
    const prev = previousDoc as Record<string, unknown> | undefined;
    const next = doc as Record<string, unknown>;
    const plan = slugRedirectPlan({
      previousSlug: prev?.slug as string | undefined,
      wasPublic: cfg.isPublic(prev),
      nextSlug: next.slug as string | undefined,
      isPublic: cfg.isPublic(next),
    });
    // The common save — a price edit, a photo swap, a stock correction — plans
    // nothing and touches no collection. This early return is what keeps the
    // hook off the hot path.
    if (!plan.clearShadowFor && !plan.mintFor) return doc;
    try {
      if (plan.clearShadowFor) {
        await req.payload.db.deleteMany?.({
          collection: cfg.redirects,
          where: { oldSlug: { equals: plan.clearShadowFor } },
          req,
        });
      }
      if (plan.mintFor) {
        // Upsert rather than create: `oldSlug` is unique, and the same slug can
        // legitimately be minted again later by a different document.
        const existing = await req.payload.find({
          collection: cfg.redirects,
          where: { oldSlug: { equals: plan.mintFor } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });
        if (existing.docs.length) {
          await req.payload.update({
            collection: cfg.redirects,
            id: existing.docs[0]!.id,
            data: { [cfg.targetField]: doc.id },
            overrideAccess: true,
          });
        } else {
          await req.payload.create({
            collection: cfg.redirects,
            data: { oldSlug: plan.mintFor, [cfg.targetField]: doc.id },
            overrideAccess: true,
          });
        }
      }
    } catch (e) {
      // Never fail the save. A lost redirect is a 404 on one old URL; a thrown
      // hook is a staff member unable to rename anything. Same call as Posts.ts.
      req.payload.logger.error(
        `[${cfg.label}] slug redirect upkeep failed: ${(e as Error).message}`,
      );
    }
    return doc;
  };
}

/**
 * Products carry drafts, so only a PUBLISHED version occupies a public URL.
 *
 * Note that `previousDoc` is the LATEST version, not the published one
 * (updateByID.js:78 -> getLatestCollectionVersion, `latest: true`). That is why
 * changing a published product's slug and pressing Save Draft mints the
 * redirect at that moment: at the later Publish the slugs are already equal and
 * the rename is no longer observable. The row is dormant until the change goes
 * live, because the old slug still resolves the published document.
 */
export const productSlugRedirectAfterChange = catalogSlugRedirect({
  redirects: "product-slug-redirects",
  targetField: "product",
  isPublic: (d) => d?._status === "published",
  label: "products",
});

/**
 * Categories have no drafts. "Hide from the storefront" is their off switch, and
 * a hidden department's own URL already 404s (cms.ts getCategoryBySlug returns
 * null for it), so a hidden category does not occupy a public URL either.
 */
export const categorySlugRedirectAfterChange = catalogSlugRedirect({
  redirects: "category-slug-redirects",
  targetField: "category",
  isPublic: (d) => Boolean(d) && d?.hidden !== true,
  label: "categories",
});
