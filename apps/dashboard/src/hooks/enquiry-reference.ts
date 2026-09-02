import type { CollectionBeforeChangeHook } from "payload";

/**
 * Give every enquiry a reference the customer can quote back.
 *
 * There was none. A customer who submitted a customization request had nothing
 * to put in a follow-up email, and staff had nothing to search on but a name and
 * a date — so "I sent a request last week" was an unanswerable question.
 *
 * Assigned HERE rather than on the website because `create` on this collection
 * is public: a value in the request body cannot be trusted, and a reference that
 * a submitter can choose is worse than none at all, since two records could
 * carry the same one. On create the field is overwritten unconditionally.
 */
const pad = (n: number): string => String(n).padStart(2, "0");

/** RFQ-YYYYMMDD-XXXXXX. Date first so the admin list sorts and reads naturally. */
function mintReference(now: Date, random: () => string): string {
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `RFQ-${ymd}-${random()}`;
}

/**
 * Six base32-ish characters, ambiguous ones removed so a reference read aloud or
 * copied off a screen survives the trip. ~1 in 10^9 for a same-day collision at
 * this volume, and the field is unique, so a clash fails loudly rather than
 * silently attaching two customers to one reference.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomSuffix = (): string => {
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
};

export const assignEnquiryReference: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation !== "create") return data;
  return { ...data, referenceId: mintReference(new Date(), randomSuffix) };
};

/** Exported for tests — the shape is a customer-facing promise. */
export const __mintReference = mintReference;
