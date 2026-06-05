import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload";

/**
 * Audit logging — records who created/updated/deleted a document and when.
 * Attach the returned hooks to any collection that needs an audit trail.
 * Writes to the `audit-logs` collection (which itself is NOT audited).
 */
export const auditAfterChange: CollectionAfterChangeHook = async ({
  req,
  operation,
  doc,
  collection,
}) => {
  try {
    await req.payload.create({
      collection: "audit-logs",
      data: {
        action: operation, // "create" | "update"
        collectionSlug: collection.slug,
        documentId: String(doc.id),
        documentLabel: doc?.title || doc?.name || doc?.filename || String(doc.id),
        user: req.user?.id,
        userEmail: req.user?.email,
      },
    });
  } catch {
    /* never block the main write on an audit failure */
  }
  return doc;
};

export const auditAfterDelete: CollectionAfterDeleteHook = async ({
  req,
  doc,
  collection,
}) => {
  try {
    await req.payload.create({
      collection: "audit-logs",
      data: {
        action: "delete",
        collectionSlug: collection.slug,
        documentId: String(doc?.id),
        documentLabel: doc?.title || doc?.name || doc?.filename || String(doc?.id),
        user: req.user?.id,
        userEmail: req.user?.email,
      },
    });
  } catch {
    /* ignore */
  }
  return doc;
};
