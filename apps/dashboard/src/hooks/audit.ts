import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload";

/**
 * Audit logging — records who created/updated/deleted a document and when.
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
        documentLabel:
          doc?.title || doc?.name || doc?.orderNumber || doc?.quotationNumber ||
          doc?.ticketNumber || doc?.filename || String(doc.id),
        user: req.user?.id,
        userEmail: req.user?.email,
      },
    });
  } catch (err) {
    // Never block the main write on an audit failure — but DO surface it, so a
    // persistently failing audit trail can't go silently dark.
    req.payload.logger.error(
      { err, collection: collection.slug, operation, documentId: String(doc?.id) },
      "[audit] failed to write audit-log entry",
    );
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
        documentLabel:
          doc?.title || doc?.name || doc?.orderNumber || doc?.quotationNumber ||
          doc?.ticketNumber || doc?.filename || String(doc?.id),
        user: req.user?.id,
        userEmail: req.user?.email,
      },
    });
  } catch (err) {
    req.payload.logger.error(
      { err, collection: collection.slug, documentId: String(doc?.id) },
      "[audit] failed to write audit-log delete entry",
    );
  }
  return doc;
};
