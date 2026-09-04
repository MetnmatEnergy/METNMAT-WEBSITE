import type { FieldHook } from "payload";
import { slugify } from "./blog";

/**
 * Duplicating a catalog document twice failed.
 *
 * WHAT PAYLOAD DOES, read out of 3.85.1 rather than assumed. `duplicate` is
 * `create` carrying a `duplicateFromID`:
 *
 *   collections/operations/duplicate.js:4   createOperation({...args, duplicateFromID: id})
 *   duplicateDocument/index.js:34           source = await getLatestCollectionVersion(...)
 *   duplicateDocument/index.js:63           source = await beforeDuplicate({doc: source, req, ...})
 *   fields/setDefaultBeforeDuplicate.js:5   unique text fields become `${value} - Copy`
 *   fields/config/sanitize.js:168-174       ...but only if the field has no beforeDuplicate of its own
 *   beforeValidate/getFallbackValue.js:7    fields absent from `data` are cloned from that source
 *   beforeValidate/promise.js:208           the field's beforeValidate hook receives that cloned value
 *
 * WHAT THAT MEANT HERE, which is not what the audit reported. All eight
 * unique-slug collections already run the canonical `slugify` over the slug in
 * beforeValidate, so `"ferrous-sulphate - Copy"` was normalised to
 * `"ferrous-sulphate-copy"` before it could ever be stored. A slug with spaces
 * in a URL was never reachable.
 *
 * The reachable defect was the SECOND duplicate: both normalise to that same
 * `"ferrous-sulphate-copy"`, and the unique index rejects the second one.
 * `db-mongodb/handleError.js:44` turns that into "Value must be unique" against
 * the slug field — an error staff cannot clear, because the duplicate action
 * gives them nowhere to change the slug first.
 *
 * THE FIX. A field-level `beforeDuplicate`, which by `sanitize.js:168-174` also
 * takes the place of Payload's `" - Copy"` default rather than competing with
 * it. It reuses `slugify` from `lib/blog` — the one slug utility in this
 * repository — and picks the first free `-copy`, `-copy-2`, `-copy-3`.
 *
 * It does NOT touch the draft/publish lifecycle. The admin posts
 * `_status: 'draft'` for collections with drafts and the REST endpoint defaults
 * `draft = true`, so where a duplicate lands is already settled by the
 * framework.
 */

/** Payload caps a slug at 120 characters; a numbered copy has to fit inside it. */
const MAX_SLUG = 120;

/** How many sibling copies one query looks at. Far above any real catalogue. */
export const COPY_SEARCH_LIMIT = 500;

/** A trailing `-copy` or `-copy-7`, anchored so "photocopy" is left alone. */
const COPY_SUFFIX = /-copy(?:-\d+)?$/;

/**
 * The slug a copy should be numbered from.
 *
 * Normalising through `slugify` is what makes an odd stored value safe — a
 * legacy slug with spaces, or Payload's own `" - Copy"` if this hook is ever
 * bypassed. Stripping an existing copy suffix keeps duplicating a copy from
 * producing `ferrous-sulphate-copy-copy`; the numbering continues from the
 * original instead.
 */
export function copySlugBase(value: unknown): string {
  const slug = slugify(typeof value === "string" ? value : "");
  return slug.replace(COPY_SUFFIX, "");
}

/**
 * The first `-copy` slug not already in use.
 *
 * Gaps are filled rather than skipped, so deleting a copy does not push every
 * later number up. An empty base yields plain `copy`, never a leading dash.
 *
 * Terminates: `taken` is finite, so at most `taken.size + 1` candidates can be
 * occupied.
 */
export function firstFreeCopySlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);

  // Leave room for the longest suffix this loop can append, so a long slug is
  // shortened deliberately here rather than truncated later by slugify.
  const build = (n: number): string => {
    const suffix = n === 1 ? "-copy" : `-copy-${n}`;
    if (!base) return suffix.slice(1);
    const room = MAX_SLUG - suffix.length;
    const trimmed = base.slice(0, Math.max(1, room)).replace(/-+$/, "");
    return `${trimmed}${suffix}`;
  };

  for (let n = 1; n <= used.size + 1; n++) {
    const candidate = build(n);
    if (!used.has(candidate)) return candidate;
  }
  // Unreachable: the loop bound exceeds the number of occupied candidates.
  return build(used.size + 2);
}

type FindArgs = {
  collection: string;
  where: Record<string, unknown>;
  limit: number;
  depth: number;
  overrideAccess: boolean;
};
type MinimalPayload = {
  find: (args: FindArgs) => Promise<{ docs?: Array<{ slug?: unknown }> }>;
  logger?: { warn: (o: unknown, m?: string) => void };
};

/**
 * Every slug already in this collection that could collide with a copy of
 * `base`, in ONE query.
 *
 * `like` is a contains match, so it also returns unrelated slugs that happen to
 * embed the same text. That is harmless — the caller only asks whether specific
 * candidates are present — and it costs one round trip instead of one per
 * candidate.
 *
 * A failure is not fatal. Returning nothing yields `${base}-copy`, which is
 * what Payload would have produced anyway, and the unique index still decides.
 */
async function takenCopySlugs(
  payload: MinimalPayload,
  collection: string,
  base: string,
): Promise<string[]> {
  try {
    const res = await payload.find({
      collection,
      where: { slug: { like: `${base}-copy` } },
      limit: COPY_SEARCH_LIMIT,
      depth: 0,
      overrideAccess: true,
    });
    const docs = res?.docs ?? [];
    if (docs.length >= COPY_SEARCH_LIMIT) {
      payload.logger?.warn(
        { collection, base, limit: COPY_SEARCH_LIMIT },
        "[duplicate] more copies exist than one search returns — the numbering may collide",
      );
    }
    return docs.map((d) => String(d?.slug ?? "")).filter(Boolean);
  } catch (err) {
    payload.logger?.warn(
      { err, collection, base },
      "[duplicate] could not check existing slugs — falling back to the first copy name",
    );
    return [];
  }
}

/**
 * Give a duplicated document a slug of its own.
 *
 * Returning a value is how the new slug is set; the source document is handed
 * in as an argument and is deliberately never written through, so duplicating
 * cannot edit the original.
 *
 * The search and the write are not atomic. Two duplicates started at the same
 * instant can agree on `-copy-2`, and the unique index rejects the loser with
 * "Value must be unique" — visible and recoverable, rather than two documents
 * silently sharing a public URL. A reservation strong enough to close that
 * window would need a counter collection, which is a great deal of machinery
 * for a button one person presses at a time.
 */
export function slugBeforeDuplicate(): FieldHook {
  return async ({ value, req, collection }) => {
    const base = copySlugBase(value);
    const payload = (req as { payload?: MinimalPayload } | undefined)?.payload;
    const slug = (collection as { slug?: string } | undefined)?.slug;

    if (!payload || !slug) return firstFreeCopySlug(base, []);

    return firstFreeCopySlug(base, await takenCopySlugs(payload, slug, base));
  };
}
