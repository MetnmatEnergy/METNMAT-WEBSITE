import type { CollectionBeforeChangeHook } from "payload";

/**
 * A customer who changes their own email address loses `emailVerified`.
 *
 * THE HOLE (2026-09-17 audit). `emailVerified` is staff-only at field level, but
 * nothing tied it to the address it verified. A customer could earn it (a
 * password reset proves they can read their own inbox), then PATCH their own
 * record to a guest buyer's address. The website matches guest orders and
 * invoices to accounts by `email equals` once `emailVerified` is true, so the
 * account page then listed the victim's orders, addresses and GST invoices.
 * Guest buyers have not registered, so the unique index never blocked it.
 *
 * Field-level access runs BEFORE collection beforeChange hooks (Payload strips
 * unauthorised fields in the beforeValidate pass), so a value set here is kept,
 * exactly like stampSessionsOnPasswordChange sets `sessionsValidFrom`.
 *
 * Staff edits are left alone: an admin correcting a typo in an address should
 * not un-verify the customer. Every other JWT that changes the email starts
 * over: not verified and signed out everywhere. `authProvider` is left as it
 * is, since flipping it could lock a Google-created account out of its own
 * password flow; a later password reset on the new address re-verifies it.
 */
export const resetVerificationOnEmailChange: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (!data || operation !== "update") return data;
  const next = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const prev = typeof originalDoc?.email === "string" ? String(originalDoc.email).trim().toLowerCase() : "";
  if (!next || !prev || next === prev) return data;
  const staff = (req?.user as { collection?: string } | null | undefined)?.collection === "users";
  if (staff) return data;
  const d = data as Record<string, unknown>;
  d.emailVerified = false;
  d.sessionsValidFrom = Date.now();
  return data;
};
