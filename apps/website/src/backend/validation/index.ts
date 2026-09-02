/**
 * Request validation.
 *
 * The tech stack specifies Zod. To keep this skeleton install-free, validation
 * is hand-rolled for now. When ready, install Zod and replace these helpers:
 *
 *   pnpm --filter website add zod
 *
 * TODO(backend): swap to Zod schemas (z.object({...})).
 */
import type { Enquiry } from "@/backend/models";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; fields: Record<string, string> };

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Validate an incoming contact/quote enquiry payload. */
export function validateEnquiry(
  input: unknown,
  source: Enquiry["source"]
): ValidationResult<Enquiry> {
  const fields: Record<string, string> = {};
  const body = (input ?? {}) as Record<string, unknown>;

  // Honeypot: a hidden field real visitors never see or fill. Bots fill every
  // input, so any value here is spam — reject before validation. The field name
  // is deliberately non-standard so browser autofill won't populate it.
  if (String(body.hp_company_url ?? "").trim() !== "") {
    return { success: false, fields: { _rejected: "invalid submission" } };
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (name.length < 2) fields.name = "Please enter your name.";
  if (!isEmail(email)) fields.email = "Please enter a valid email.";
  if (message.length < 5) fields.message = "Please add a few more details.";

  /*
   * Upper bounds.
   *
   * There were none on this validator, though the sibling DPDP one caps its
   * free text at 4000 for exactly this reason. Every field here is written to
   * the CMS and interpolated into two emails, so an unbounded value is a way to
   * make one anonymous request store and mail an arbitrary amount — and a
   * megabyte "name" turns the staff enquiry list into something that will not
   * render. The limits are generous enough that no real enquiry meets them.
   */
  if (name.length > 200) fields.name = "Please keep your name under 200 characters.";
  if (email.length > 254) fields.email = "Please enter a valid email.";
  if (message.length > 8000) fields.message = "Please keep this under 8000 characters.";
  for (const [key, limit] of [
    ["phone", 40],
    ["company", 200],
  ] as const) {
    if (String(body[key] ?? "").trim().length > limit) {
      fields[key] = `Please keep this under ${limit} characters.`;
    }
  }

  if (Object.keys(fields).length > 0) return { success: false, fields };

  return {
    success: true,
    data: {
      name,
      email,
      message,
      phone: body.phone ? String(body.phone).trim() : undefined,
      company: body.company ? String(body.company).trim() : undefined,
      source,
    },
  };
}

/**
 * DPDP data-rights request. Same honeypot + field-error shape as the enquiry
 * validator so the client form handling is identical.
 *
 * Kept deliberately light on required fields: a Data Principal exercising a
 * statutory right must not be made to justify themselves. Name and a reachable
 * email are the minimum needed to verify identity and reply; everything else is
 * optional. Identity is verified out-of-band by a human before anything is
 * disclosed or erased — this form never authenticates anyone.
 */
export function validateDataRequest(
  input: unknown
): ValidationResult<{
  type: string;
  name: string;
  email: string;
  phone?: string;
  details?: string;
}> {
  const fields: Record<string, string> = {};
  const body = (input ?? {}) as Record<string, unknown>;

  if (String(body.hp_company_url ?? "").trim() !== "") {
    return { success: false, fields: { _rejected: "invalid submission" } };
  }

  const allowed = ["access", "correction", "erasure", "withdraw", "nominate", "grievance"];
  const type = String(body.type ?? "").trim();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const details = String(body.details ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  if (!allowed.includes(type)) fields.type = "Please choose the type of request.";
  if (name.length < 2) fields.name = "Please enter your name.";
  if (!isEmail(email)) fields.email = "Please enter a valid email so we can reply.";
  // Cap free text: this reaches the CMS, and an unbounded body is a cheap DoS.
  if (details.length > 4000) fields.details = "Please keep this under 4000 characters.";

  if (Object.keys(fields).length > 0) return { success: false, fields };

  return {
    success: true,
    data: {
      type,
      name,
      email,
      phone: phone || undefined,
      details: details || undefined,
    },
  };
}
