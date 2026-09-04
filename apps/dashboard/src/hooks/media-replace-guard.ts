import type { CollectionBeforeChangeHook } from "payload";
import { staffError } from "../lib/staff-error";
import { collectMediaUsages, type MediaRefLookup, type MediaUsage } from "./media-guards";

/**
 * Replacing a photograph changes it everywhere it is shown, at once.
 *
 * A product does not hold a copy of its image; it holds the media id. So
 * uploading a new file onto an existing media record repoints every product,
 * category, article and settings screen that uses that record. Twelve pages can
 * change because one person fixed one photo, and nothing said so.
 *
 * WHAT WAS ALREADY SAFE, established before adding anything here:
 *
 *   - the old file IS removed — `collections/operations/utilities/update.js:78`
 *     calls `deleteAssociatedFiles` when a new file arrives, so nothing orphans;
 *   - the resolution floor IS re-applied, because `enforceProductImageSpec` keys
 *     off `req.file` rather than the operation;
 *   - the replacement IS audit-logged, and the references stay valid — they
 *     point at the same id, which still resolves.
 *
 * So this is not a correctness hole. It is a blast radius nobody is shown.
 *
 * WHY A CONFIRMATION AND NOT A REFUSAL. No code can tell a corrected re-export
 * of the same photograph from the wrong photograph pasted onto a shared record.
 * Refusing would break the intended workflow — upload, classify, correct, use —
 * and force someone to re-point twelve products by hand to fix one bad export.
 * Refusing ONCE, with the count and some names, puts the decision in front of
 * the person who knows which of the two they are doing.
 *
 * The tick is cleared on the way through, so it authorises one replacement
 * rather than leaving the guard permanently off while still looking on.
 */

/** What a replacement is about to change, phrased for the person doing it. */
export function mediaReplaceBlocker(args: {
  usages: MediaUsage[];
  settings: string[];
  confirmed: boolean;
}): string | null {
  if (args.confirmed) return null;

  const usages = args.usages.filter((u) => u.count > 0);
  if (usages.length === 0 && args.settings.length === 0) return null;

  const parts = usages.map((u) => {
    const noun = u.count === 1 ? u.singular : u.plural;
    const names = (u.examples ?? []).filter((n) => typeof n === "string" && n.length > 0);
    return names.length ? `${u.count} ${noun} (${names.join(", ")})` : `${u.count} ${noun}`;
  });
  for (const name of args.settings) parts.push(`the ${name} settings`);

  const what =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return (
    `This image is currently shown on ${what}. Uploading a different file here changes it ` +
    `in all of those places at once. If you are correcting this same photograph, tick ` +
    `"Replace it everywhere" and save again. If this is a different photograph, upload it ` +
    `as a new image instead and point the product at that.`
  );
}

/**
 * Ask before a replacement changes pages the uploader may not know about.
 *
 * Scoped tightly, because everything outside that scope is ordinary work:
 * only an UPDATE, only when a new binary actually arrived, and only when
 * something still points at the record. Editing alt text or fixing a wrong
 * `category` never reaches the lookup — that is the workflow `Media.update` was
 * deliberately widened to permit, and it must stay frictionless.
 *
 * Reuses `collectMediaUsages`, so replacing and deleting answer to one reference
 * table and one set of rules — including the unpublished-draft references that
 * guard learned to see.
 */
export const mediaReplaceGuard: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== "update") return data;

  // No new binary → nothing is being replaced. Metadata edits pass through.
  if (!req?.file?.data) return data;

  const id = originalDoc?.id;
  if (!id || !req.payload) return data;

  const { usages, settings } = await collectMediaUsages(
    req.payload as unknown as MediaRefLookup,
    id as string | number,
  );

  const blocker = mediaReplaceBlocker({
    usages,
    settings,
    confirmed: Boolean((data as { confirmReplace?: unknown } | undefined)?.confirmReplace),
  });

  // APIError, not a bare Error: without a status, isErrorPublic() rejects it and
  // routeError replaces the body with "Something went wrong."
  if (blocker) throw staffError(blocker);

  // One tick, one replacement. Left set it would authorise every future
  // replacement of this record silently.
  if (data && typeof data === "object") {
    (data as { confirmReplace?: unknown }).confirmReplace = false;
  }

  return data;
};
