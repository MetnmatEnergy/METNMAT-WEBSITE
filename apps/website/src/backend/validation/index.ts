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

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (name.length < 2) fields.name = "Please enter your name.";
  if (!isEmail(email)) fields.email = "Please enter a valid email.";
  if (message.length < 5) fields.message = "Please add a few more details.";

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
