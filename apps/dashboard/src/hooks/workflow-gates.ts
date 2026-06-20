import type { CollectionBeforeChangeHook } from "payload";
import { hasRole, type Role } from "../access";

/**
 * Quotation workflow gates:
 *  - commercial approval (status → approved) requires Accounts/Admin;
 *  - only an APPROVED quotation can be marked Sent, and only with a PDF attached;
 *  - sentAt is stamped on first send.
 */
export const quotationBeforeChange: CollectionBeforeChangeHook = async ({
  req,
  operation,
  data,
  originalDoc,
}) => {
  if (!data) return data;
  const from = (originalDoc?.status ?? "draft") as string;
  const to = (data.status ?? from) as string;
  const user = req.user as { roles?: Role[] } | null | undefined;

  if (operation === "update" && to !== from) {
    if (to === "approved" && !hasRole(user, "super-admin", "admin", "accounts")) {
      throw new Error("Only Accounts/Admin can approve a quotation.");
    }
    if (to === "sent") {
      if (from !== "approved") throw new Error("A quotation must be approved before it can be sent.");
      if (!data.quotationFile && !originalDoc?.quotationFile) {
        throw new Error("Attach the quotation PDF before marking it Sent.");
      }
    }
  }
  if (to === "sent" && !originalDoc?.sentAt && !data.sentAt) {
    data.sentAt = new Date().toISOString();
  }
  return data;
};

/**
 * Task workflow gates:
 *  - cannot mark Done without a completion note;
 *  - a "quotation" task needs a linked quotation before it can be Done.
 */
export const taskBeforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, operation }) => {
  if (!data) return data;
  const from = (originalDoc?.status ?? "pending") as string;
  const to = (data.status ?? from) as string;

  if ((operation === "update" || operation === "create") && to === "done") {
    if (!data.completionNote && !originalDoc?.completionNote) {
      throw new Error("Add a completion note before marking the task Done.");
    }
    const type = (data.taskType ?? originalDoc?.taskType) as string | undefined;
    if (type === "quotation" && !data.relatedQuotation && !originalDoc?.relatedQuotation) {
      throw new Error("A quotation task needs a linked quotation before it can be marked Done.");
    }
  }
  return data;
};

/** Return/replacement gate: cannot be Resolved/Closed without a resolution note. */
export const returnBeforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, operation }) => {
  if (!data) return data;
  const from = (originalDoc?.status ?? "requested") as string;
  const to = (data.status ?? from) as string;
  if (operation === "update" && to !== from && (to === "resolved" || to === "closed")) {
    if (!data.resolution && !originalDoc?.resolution) {
      throw new Error("Add a resolution note before marking this return Resolved/Closed.");
    }
  }
  return data;
};

/**
 * RFQ (Enquiry) workflow gates:
 *  - cannot mark "quotation-sent" without a quotation (file or reference);
 *  - cannot mark "not-feasible" without a technical note;
 *  - cannot mark "closed"/"lost" without a reason.
 */
export const enquiryBeforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, operation }) => {
  if (!data) return data;
  const from = (originalDoc?.status ?? "new") as string;
  const to = (data.status ?? from) as string;
  if (operation === "update" && to !== from) {
    const has = (k: string) => Boolean((data as Record<string, unknown>)[k] ?? originalDoc?.[k]);
    if (to === "quotation-sent" && !has("quotationRef") && !has("quotationFile")) {
      throw new Error("Attach a quotation (file or reference) before marking 'Quotation sent'.");
    }
    if (to === "not-feasible" && !has("technicalNote")) {
      throw new Error("Add a technical note before marking 'Not feasible'.");
    }
    if ((to === "closed" || to === "lost") && !has("closeReason") && !has("lossReason")) {
      throw new Error("Add a reason before marking this RFQ Closed/Lost.");
    }
  }
  return data;
};
