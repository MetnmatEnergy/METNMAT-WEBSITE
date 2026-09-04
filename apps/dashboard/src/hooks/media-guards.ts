import type { CollectionBeforeDeleteHook, Where } from "payload";
import { staffError } from "../lib/staff-error";

/**
 * A media file may not be deleted out from under the pages that display it.
 *
 * `Media` had no delete guard while `Categories` did. Deleting a file removes
 * the document AND the S3 object, so every product, project, article, service
 * or settings entry pointing at it keeps an id that no longer resolves — the
 * storefront renders a blank frame where the photograph was, and nothing in the
 * admin says which pages were hit. Because `deleteAssociatedFiles` runs AFTER
 * `beforeDelete` (payload/dist/collections/operations/deleteByID.js), refusing
 * here keeps the file in the bucket as well as the row in the database, so the
 * mistake is not one-way.
 *
 * Refusing rather than cascading, for the same reason Categories refuses:
 * tidying the media library must never edit the catalogue. The message names
 * the counts, a few of the documents by title and the settings screens, because
 * the person hitting this is a staff member in the admin UI, not a developer —
 * and "which products did I just break?" is exactly the question this replaces.
 */

/** One collection that can point at a media file, and how to say so. */
export type MediaRef = {
  collection: string;
  /** Field paths whose value is a media id. Dotted paths cross ONE array hop. */
  paths: string[];
  /** Field to read a human label from — the collection's own useAsTitle. */
  titleField: string;
  singular: string;
  plural: string;
  /**
   * This collection has drafts, so its published state is not its whole state.
   *
   * A draft REVISION of an already-published document is written only to the
   * versions collection — `utilities/update.js` guards the main write with
   * `if (!isSavingDraft)`. So an image added by an unpublished edit is invisible
   * to a query against the main collection, and the guard counted zero.
   *
   * A newly CREATED draft is different: `create.js` writes the main collection
   * unconditionally, so those were always visible and must not be counted twice.
   */
  drafts?: true;
};

/**
 * Every collection with an `upload` field pointing at `media`. Kept in step with
 * the collections by a guardrail test, which fails if a new media field is added
 * anywhere and not listed here.
 */
export const MEDIA_REFS: MediaRef[] = [
  { collection: "products", paths: ["images.image", "ogImage"], titleField: "name", singular: "product", plural: "products", drafts: true },
  { collection: "categories", paths: ["image"], titleField: "name", singular: "category", plural: "categories" },
  { collection: "projects", paths: ["coverImage", "gallery.image"], titleField: "title", singular: "project", plural: "projects", drafts: true },
  { collection: "posts", paths: ["coverImage", "ogImage"], titleField: "title", singular: "blog article", plural: "blog articles", drafts: true },
  { collection: "services", paths: ["image"], titleField: "title", singular: "service", plural: "services" },
  { collection: "team", paths: ["photo"], titleField: "name", singular: "team member", plural: "team members" },
  { collection: "clients", paths: ["logo"], titleField: "name", singular: "client logo", plural: "client logos" },
  { collection: "blog-authors", paths: ["profileImage"], titleField: "name", singular: "blog author", plural: "blog authors" },
];

/**
 * Globals that point at media. Only these two do — and they hold the logo and
 * the favicon, the files most likely to look like strays in the library and the
 * most damaging to remove.
 */
/*
 * KNOWN GAP, stated rather than hidden — and WIDER than it used to say here.
 *
 * Media embedded as a Lexical upload node inside a rich-text field is not
 * counted. That is FIVE fields, not just the blog:
 *
 *   Posts.body, Products.description, Projects.body, Services.description,
 *   and the `about` field on the company global.
 *
 * seed.ts builds such nodes, and three live articles carry authored inline
 * diagrams. Deleting one of those files is still permitted and still leaves a
 * broken image — and unlike the draft-revision gap, this one needs no drafts at
 * all: a reference inside a PUBLISHED rich-text body is missed just the same,
 * because the value is buried in a JSON tree rather than at a queryable field
 * path.
 *
 * Walking Lexical trees across five collections is a different and much larger
 * change than a table of field paths, so it stays filed separately rather than
 * bolted on here. The count above is the honest scope of what is not covered.
 */
export const MEDIA_SETTINGS: { slug: string; label: string; paths: string[] }[] = [
  {
    slug: "branding",
    label: "Branding",
    paths: ["logo", "logoDark", "favicon", "heroBanners.image", "marketingBanners.image"],
  },
  { slug: "seo", label: "SEO", paths: ["ogImage"] },
];

/** A collection's usage of one media file, ready to be phrased. */
export type MediaUsage = {
  count: number;
  singular: string;
  plural: string;
  /** Up to three document titles, so staff can go straight to them. */
  examples?: string[];
};

/**
 * The media ids a settings document points at.
 *
 * Deliberately shallow: one optional array hop ("heroBanners.image"), which is
 * all any global uses. A generic deep walk would match unrelated string fields.
 * Values arrive as bare ids at depth 0; the object form is tolerated so a future
 * caller passing depth > 0 does not silently find nothing.
 */
export function mediaIdsInSettings(doc: unknown, paths: string[]): string[] {
  const out: string[] = [];
  const push = (v: unknown): void => {
    if (typeof v === "string" || typeof v === "number") out.push(String(v));
    else if (v && typeof v === "object" && "id" in (v as Record<string, unknown>)) {
      const id = (v as { id: unknown }).id;
      if (typeof id === "string" || typeof id === "number") out.push(String(id));
    }
  };

  const root = (doc ?? {}) as Record<string, unknown>;
  for (const path of paths) {
    const [head, leaf] = path.split(".");
    if (!head) continue;
    const node = root[head];
    if (!leaf) push(node);
    else if (Array.isArray(node)) {
      for (const row of node) push((row as Record<string, unknown> | null)?.[leaf]);
    }
  }
  return out;
}

/** What blocks a media delete, phrased for the person attempting it. */
export function mediaDeleteBlocker(args: {
  filename?: string | null;
  usages: MediaUsage[];
  settings?: string[];
}): string | null {
  const usages = args.usages.filter((u) => u.count > 0);
  const settings = args.settings ?? [];
  if (usages.length === 0 && settings.length === 0) return null;

  const label = args.filename ? `"${args.filename}"` : "This image";

  const parts = usages.map((u) => {
    const noun = u.count === 1 ? u.singular : u.plural;
    const names = (u.examples ?? []).filter((n) => typeof n === "string" && n.length > 0);
    if (names.length === 0) return `${u.count} ${noun}`;
    const shown = names.join(", ");
    return u.count > names.length
      ? `${u.count} ${noun} (e.g. ${shown})`
      : `${u.count} ${noun} (${shown})`;
  });
  for (const name of settings) parts.push(`the ${name} settings`);

  const what =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return `${label} is still used by ${what}. Change or clear the image there first — this file is what those pages load, so deleting it here would leave them with a blank frame.`;
}

/**
 * The narrow slice of `payload` the counting needs.
 *
 * Structural rather than `Payload` for two reasons: the local API's per-slug
 * generics make `docs[titleField]` untypeable when the slug is a variable, and
 * this shape can be faked in a unit test, so the query form below is pinned
 * without a database.
 */
export type MediaRefLookup = {
  find(args: {
    collection: string;
    where: Where;
    limit: number;
    depth: number;
    overrideAccess: boolean;
  }): Promise<{ totalDocs: number; docs: Record<string, unknown>[] }>;
  findGlobal(args: {
    slug: string;
    depth: number;
    overrideAccess: boolean;
  }): Promise<Record<string, unknown> | null>;
  findVersions(args: {
    collection: string;
    where: Where;
    limit: number;
    depth: number;
    overrideAccess: boolean;
  }): Promise<{ totalDocs: number; docs: Record<string, unknown>[] }>;
};

/** `images.image` crosses an array — a supported single-query path, not a join. */
const whereForRef = (ref: MediaRef, id: string | number): Where =>
  ref.paths.length === 1
    ? { [ref.paths[0] as string]: { equals: id } }
    : { or: ref.paths.map((path) => ({ [path]: { equals: id } })) };

/**
 * The same question, asked of the unpublished head instead of the live document.
 *
 * A version row stores the whole document under `version`, so every field path
 * gains that prefix. Two filters narrow it to the state that matters:
 *
 *   `latest`            — only the current head. Every superseded version also
 *                         names the images it used, and honouring those would
 *                         make a file undeletable forever once it had ever been
 *                         referenced by anything.
 *   `version._status`   — only a DRAFT head. A published head is already the
 *                         main document, which `whereForRef` covers, so
 *                         including it would count the same document twice.
 */
const whereForDraftRef = (ref: MediaRef, id: string | number): Where => ({
  and: [
    { latest: { equals: true } },
    { "version._status": { equals: "draft" } },
    ref.paths.length === 1
      ? { [`version.${ref.paths[0] as string}`]: { equals: id } }
      : { or: ref.paths.map((path) => ({ [`version.${path}`]: { equals: id } })) },
  ],
});

/** Who still points at this media file. */
export async function collectMediaUsages(
  db: MediaRefLookup,
  id: string | number
): Promise<{ usages: MediaUsage[]; settings: string[] }> {
  const target = String(id);

  // One `find` per collection rather than a `count` plus a second lookup: the
  // paginated result carries totalDocs AND the first rows, so the example names
  // cost nothing extra.
  const usages = await Promise.all(
    MEDIA_REFS.map(async (ref): Promise<MediaUsage> => {
      const res = await db.find({
        collection: ref.collection,
        where: whereForRef(ref, id),
        limit: 3,
        depth: 0,
        overrideAccess: true,
      });
      return {
        count: res?.totalDocs ?? 0,
        singular: ref.singular,
        plural: ref.plural,
        examples: (res?.docs ?? [])
          .map((doc) => doc?.[ref.titleField])
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      };
    })
  );

  /*
   * The unpublished half, for the three collections that have drafts.
   *
   * Reported as its own line rather than folded into the count above, because
   * "1 product" would send a staff member to a published page that does not
   * show the image — the reference is in an edit nobody has published yet, and
   * the message has to say so for them to find it.
   *
   * A failure here is NOT swallowed. Deleting media also deletes the S3 object
   * (`deleteAssociatedFiles` runs after `beforeDelete`), so "we could not check"
   * must never read as "nothing uses it". Refusing is recoverable; orphaning is
   * not.
   */
  const draftUsages = await Promise.all(
    MEDIA_REFS.filter((ref) => ref.drafts).map(async (ref): Promise<MediaUsage> => {
      const res = await db.findVersions({
        collection: ref.collection,
        where: whereForDraftRef(ref, id),
        limit: 3,
        depth: 0,
        overrideAccess: true,
      });
      return {
        count: res?.totalDocs ?? 0,
        singular: `${ref.singular} with unpublished changes`,
        plural: `${ref.plural} with unpublished changes`,
        examples: (res?.docs ?? [])
          .map((doc) => (doc?.version as Record<string, unknown> | undefined)?.[ref.titleField])
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      };
    })
  );

  const settings: string[] = [];
  for (const global of MEDIA_SETTINGS) {
    const doc = await db
      .findGlobal({ slug: global.slug, depth: 0, overrideAccess: true })
      .catch(() => null);
    if (mediaIdsInSettings(doc, global.paths).includes(target)) settings.push(global.label);
  }

  return { usages: [...usages, ...draftUsages].filter((u) => u.count > 0), settings };
}

export const mediaBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req;

  const [{ usages, settings }, media] = await Promise.all([
    collectMediaUsages(payload as unknown as MediaRefLookup, id),
    payload
      .findByID({ collection: "media", id, depth: 0, overrideAccess: true })
      .catch(() => null),
  ]);

  const blocker = mediaDeleteBlocker({
    filename: (media as { filename?: string } | null)?.filename ?? null,
    usages,
    settings,
  });

  // APIError, not Error: a bare Error carries no status, so isErrorPublic()
  // rejects it and routeError replaces the body with "Something went wrong." —
  // the staff member would be refused with no idea why. 400 makes it public.
  if (blocker) throw staffError(blocker);
};
