import type { CollectionBeforeDeleteHook, Where } from "payload";
import { staffError } from "../lib/staff-error";

/**
 * A document may not be deleted out from under the record that relies on it.
 *
 * THE RULE IS THE REPOSITORY'S OWN — this enforces it rather than inventing it.
 * `collections/Invoices.ts:7` says in its own header: "Statutory document — not
 * destructively deletable (super-admin only)", and backs it with
 * `delete: isSuperAdmin`. The serial is protected to match: once minted it is
 * pinned rather than re-issued (`hooks/order-workflow.ts:93-125`).
 *
 * THE BACK DOOR. The invoice RECORD lives in `invoices`; the invoice PDF lives
 * in `documents`, whose `delete: canManageAssets` is a strictly wider set —
 * super-admin, admin, marketing, or any custom role holding the Assets or
 * Content area. So a role that cannot touch the invoice could delete the
 * invoice's file, leaving a statutory record pointing at nothing. Documents had
 * no `beforeDelete` at all, so nothing noticed.
 *
 * WHAT IS AND IS NOT DECIDED HERE. The test is simply "does anything still
 * point at this file". No retention policy is invented: nothing is time-based,
 * and the `type` select is never consulted, so a certificate and a scratch PDF
 * are treated alike. An unreferenced document stays deletable — a guard that
 * made every PDF permanent would be its own defect, and tidying is a real task.
 * Delete ACCESS is left exactly as it was; narrowing it would be an RBAC
 * decision, which is not this hook's to make.
 *
 * Refusing rather than cascading, for the same reason Media and Categories
 * refuse: tidying a library must never edit the records that depend on it.
 */

/** One collection that can point at a document, and how to say so. */
export type DocumentRef = {
  collection: string;
  /** Field paths whose value is a document id. */
  paths: string[];
  /** Field to read a human label from — the collection's own useAsTitle. */
  titleField: string;
  singular: string;
  plural: string;
  /**
   * This collection has drafts, so its published state is not its whole state.
   * A draft REVISION is written only to the versions collection
   * (`utilities/update.js` guards the main write with `if (!isSavingDraft)`),
   * so a reference added by an unpublished edit is invisible to a query against
   * the main collection. Same trap as the media guard, same treatment.
   */
  drafts?: true;
};

/**
 * Every field pointing at `documents`. Kept in step with the collections by a
 * guardrail test, which fails if a new document field appears and is not listed.
 */
export const DOCUMENT_REFS: DocumentRef[] = [
  { collection: "invoices", paths: ["invoiceFile"], titleField: "invoiceNumber", singular: "invoice", plural: "invoices" },
  { collection: "quotations", paths: ["quotationFile"], titleField: "quotationNumber", singular: "quotation", plural: "quotations" },
  { collection: "enquiries", paths: ["quotationFile"], titleField: "name", singular: "enquiry", plural: "enquiries" },
  { collection: "tasks", paths: ["completionEvidence"], titleField: "title", singular: "task", plural: "tasks" },
  { collection: "posts", paths: ["attachments"], titleField: "title", singular: "blog article", plural: "blog articles", drafts: true },
  { collection: "products", paths: ["documents"], titleField: "name", singular: "product", plural: "products", drafts: true },
];

/** A collection's usage of one document, ready to be phrased. */
export type DocumentUsage = {
  count: number;
  singular: string;
  plural: string;
  /** Up to three titles, so staff can go straight to them. */
  examples?: string[];
};

export type DocumentRefLookup = {
  find(args: {
    collection: string;
    where: Where;
    limit: number;
    depth: number;
    overrideAccess: boolean;
  }): Promise<{ totalDocs: number; docs: Record<string, unknown>[] }>;
  findVersions(args: {
    collection: string;
    where: Where;
    limit: number;
    depth: number;
    overrideAccess: boolean;
  }): Promise<{ totalDocs: number; docs: Record<string, unknown>[] }>;
  findByID(args: {
    collection: string;
    id: string | number;
    depth: number;
    overrideAccess: boolean;
  }): Promise<Record<string, unknown> | null>;
};

const whereForRef = (ref: DocumentRef, id: string | number): Where =>
  ref.paths.length === 1
    ? { [ref.paths[0] as string]: { equals: id } }
    : { or: ref.paths.map((path) => ({ [path]: { equals: id } })) };

/**
 * The same question asked of the unpublished head.
 *
 * `latest` keeps superseded versions out — every old revision also names the
 * files it referenced, and honouring those would make a PDF undeletable forever
 * once it had ever been attached to anything. `version._status: draft` keeps
 * published heads out, because those ARE the main document and are already
 * counted.
 */
const whereForDraftRef = (ref: DocumentRef, id: string | number): Where => ({
  and: [
    { latest: { equals: true } },
    { "version._status": { equals: "draft" } },
    ref.paths.length === 1
      ? { [`version.${ref.paths[0] as string}`]: { equals: id } }
      : { or: ref.paths.map((path) => ({ [`version.${path}`]: { equals: id } })) },
  ],
});

/** Who still points at this document. */
export async function collectDocumentUsages(
  db: DocumentRefLookup,
  id: string | number
): Promise<{ usages: DocumentUsage[] }> {
  const published = await Promise.all(
    DOCUMENT_REFS.map(async (ref): Promise<DocumentUsage> => {
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

  const drafted = await Promise.all(
    DOCUMENT_REFS.filter((ref) => ref.drafts).map(async (ref): Promise<DocumentUsage> => {
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

  return { usages: [...published, ...drafted].filter((u) => u.count > 0) };
}

/** What blocks a document delete, phrased for the person attempting it. */
export function documentDeleteBlocker(args: {
  title?: string | null;
  usages: DocumentUsage[];
}): string | null {
  const usages = args.usages.filter((u) => u.count > 0);
  if (usages.length === 0) return null;

  const label = args.title ? `"${args.title}"` : "This document";

  const parts = usages.map((u) => {
    const noun = u.count === 1 ? u.singular : u.plural;
    const names = (u.examples ?? []).filter((n) => typeof n === "string" && n.length > 0);
    if (names.length === 0) return `${u.count} ${noun}`;
    const shown = names.join(", ");
    return u.count > names.length ? `${u.count} ${noun} (e.g. ${shown})` : `${u.count} ${noun} (${shown})`;
  });

  const what =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return (
    `${label} is still attached to ${what}. Remove the attachment there first — those records ` +
    `link to this exact file, so deleting it here would leave them pointing at nothing. ` +
    `Invoices and quotations are kept as business records, so their PDFs are meant to stay.`
  );
}

export const documentBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req;

  const [{ usages }, doc] = await Promise.all([
    collectDocumentUsages(payload as unknown as DocumentRefLookup, id),
    payload
      .findByID({ collection: "documents", id, depth: 0, overrideAccess: true })
      .catch(() => null),
  ]);

  const blocker = documentDeleteBlocker({
    title: (doc as { title?: string } | null)?.title ?? null,
    usages,
  });

  // APIError, not a bare Error: without a status, isErrorPublic() rejects it and
  // routeError replaces the body with "Something went wrong."
  if (blocker) throw staffError(blocker);
};
