import type { CollectionBeforeChangeHook } from "payload";

/**
 * Fields only staff may set on an enquiry. `create` is public (the website's
 * quote and contact forms post here anonymously), and Payload's field access
 * was never declared on the workflow block, so an anonymous POST could file an
 * RFQ already `won`, with a `quoteAmount`, an assigned owner, a linked
 * quotation and staff-looking internal notes, polluting the pipeline and the
 * overview page (2026-09-17 audit). The workflow gates only run on update.
 */
export const STAFF_ONLY_ENQUIRY_FIELDS = [
  "status",
  "priority",
  "referenceId",
  "assignedSalesOwner",
  "assignedTechnicalOwner",
  "expectedValue",
  "quoteAmount",
  "quotation",
  "quotationRef",
  "quotationFile",
  "nextFollowUpDate",
  "lastContactedDate",
  "technicalNote",
  "closeReason",
  "lossReason",
  "internalNotes",
  "customerVisibleNotes",
] as const;

/**
 * On a create by anyone who is not a logged-in staff member, drop every
 * staff-only field and start the RFQ as a fresh `new` / `normal` one. Runs
 * before the reference hook, which then mints the reference itself.
 */
export const stripInternalOnPublicCreate: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (!data || operation !== "create") return data;
  const staff = (req?.user as { collection?: string } | null | undefined)?.collection === "users";
  if (staff) return data;
  const clean: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const key of STAFF_ONLY_ENQUIRY_FIELDS) delete clean[key];
  clean.status = "new";
  clean.priority = "normal";
  return clean;
};
