/**
 * Who owns a value once it exists: the deploy, or the person in the admin.
 *
 * The rule this codebase already follows for products ("continue; // staff-owned")
 * and for globals (seedGlobalIfUnset) is create-if-missing — the seed provides a
 * starting value and never revises one. Categories were the exception, and the
 * exception cost staff their edits on every restart. These predicates state the
 * rule in one place so it can be tested without a database.
 */

/** An image relationship as Payload returns it: populated doc, bare id, or absent. */
export type AttachedImage = { filename?: string } | string | null | undefined;

/**
 * Does this document already have an image attached?
 *
 * Used by all three seed image fillers — category banners, project covers and
 * blog covers — because all three had the same defect for the same reason.
 *
 * WHY NOT COMPARE FILENAMES. The previous test was `attachedFilename === theFileWeShip`,
 * which answers "is this OUR default?" rather than "is anything here?". A banner a
 * staff member uploaded is by construction not the file we ship, so it was replaced
 * on the next boot. Ownership cannot be inferred from a filename: two people can
 * upload the same name, and a staff member may deliberately keep the default.
 *
 * A dangling relationship counts as NO image on purpose. Payload returns null at
 * depth 1 when the related row has been deleted, so a category pointing at a media
 * document that no longer exists is repairable without touching anyone's choice.
 *
 * A bare id string is treated as attached: a depth-0 read cannot see the filename,
 * and guessing "empty" there would delete a banner on any caller that forgot depth.
 * Fail towards keeping what is already there.
 */
export function hasAttachedImage(attached: AttachedImage): boolean {
  if (typeof attached === "string") return attached.length > 0;
  if (!attached || typeof attached !== "object") return false;
  return typeof attached.filename === "string" && attached.filename.length > 0;
}

/** What the seed may do with a category it finds by slug. */
export type CategorySeedAction = "create" | "leave-alone";

/**
 * Existing category → leave it alone. Missing → create it.
 *
 * There is deliberately no "repair" branch. Re-filling a field that is empty
 * would overwrite the decision of a staff member who cleared it, and nothing
 * distinguishes "never set" from "set back to empty on purpose". Changing a
 * seeded department on production is a one-shot migration, the same route every
 * other seeded value already requires.
 */
export function decideCategorySeed(existing: unknown): CategorySeedAction {
  return existing ? "leave-alone" : "create";
}

/**
 * The newest upload of a photo set, in order. Each re-run of the attach script adds a
 * generation ("<name> 2-1.webp", then "<name> 2-2.webp"), so only the highest generation
 * is one complete, current set. The lead photo carries no number of its own
 * ("<name>-3.webp" in generation 3), and it goes first.
 */
export function latestImageSet(filenames: string[], name: string): string[] {
  const rows = filenames.flatMap((filename) => {
    const numbered = filename.match(/^(.*) (\d+)(?:-(\d+))?\.[a-z]+$/i);
    if (numbered?.[1] === name) return [{ filename, order: Number(numbered[2]), generation: Number(numbered[3] ?? 0) }];
    const lead = filename.match(/^(.*?)(?:-(\d+))?\.[a-z]+$/i);
    return lead?.[1] === name ? [{ filename, order: 0, generation: Number(lead[2] ?? 0) }] : [];
  });
  const newest = Math.max(...rows.map((r) => r.generation));
  return rows
    .filter((r) => r.generation === newest)
    .sort((a, b) => a.order - b.order)
    .map((r) => r.filename);
}

/**
 * What a product's photos should become, or undefined to leave them alone. Photos are
 * filled in when a product has none. Otherwise they change only if they are exactly the
 * set left by the first run of this repair, which missed the lead photo, so a staff edit
 * always stands, and a product already put right is not written again.
 */
export function imagesToLink(current: string[], latest: string[]): string[] | undefined {
  if (latest.length === 0) return undefined;
  if (current.length === 0) return latest;
  const withoutLead = latest.slice(1);
  return current.length === withoutLead.length && current.every((id, i) => id === withoutLead[i]) ? latest : undefined;
}
