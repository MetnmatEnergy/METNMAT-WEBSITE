import type { CollectionBeforeChangeHook } from "payload";

/**
 * Store every enquiry email lower-cased and trimmed.
 *
 * The account page finds a customer's RFQ history by EXACT email equality: the
 * website's internal-key read of this collection is permitted only for
 * `where[email][equals]=<address>` (see internalOwnEmailOrManageSales), and it
 * sends the lower-cased account address. An enquiry stored as typed
 * ("Jane@Lab.Example") would therefore never match its own account.
 *
 * The website form already lower-cases before it submits; this covers staff
 * edits in the admin panel and any other writer, on create and update alike.
 * Mailboxes are case-insensitive in practice, so nothing is lost. Rows filed
 * before this hook existed are fixed once by lowercaseEnquiryEmails in seed.ts.
 */
export const normalizeEnquiryEmail: CollectionBeforeChangeHook = ({ data }) => {
  if (!data || typeof data.email !== "string") return data;
  const email = data.email.trim().toLowerCase();
  return email === data.email ? data : { ...data, email };
};
