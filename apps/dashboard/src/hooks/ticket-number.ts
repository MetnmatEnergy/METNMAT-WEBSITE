import type { CollectionBeforeValidateHook } from "payload";
import { newTicketNumber } from "../lib/ticket-number";

/**
 * Issue a ticket number on create, and refuse to let it change afterwards.
 *
 * Runs as `beforeValidate` because that is early enough to still fill the field
 * before Payload validates it. The browser is handled separately — see
 * `lib/ticket-number.ts`, which explains why a custom `validate` is what makes
 * the form submittable in the first place.
 *
 * A number supplied by the caller is kept. The website mints its own and posts
 * it over the internal key, then prints it on the customer's confirmation email
 * and builds their status-lookup link from it, so second-guessing it here would
 * break the public flow this is not allowed to touch.
 */

/** How many times to redraw before letting the unique index arbitrate. */
const MAX_ATTEMPTS = 5;

/**
 * A number no existing ticket is using.
 *
 * `unique: true` turns a collision into a failed save, and for a customer
 * raising a ticket a failed save is a lost request. Four hex characters is
 * 65536 a day — rare, not impossible.
 *
 * The search is advisory, not a lock: two requests can still draw the same
 * number between the check and the write, which is exactly what the unique
 * index is for. So a failure to search is not a failure to issue — a ticket the
 * index might reject beats no ticket at all.
 */
async function unusedTicketNumber(payload: {
  find: (args: never) => Promise<{ docs?: unknown[] }>;
  logger?: { warn: (o: unknown, m?: string) => void };
}): Promise<string> {
  let candidate = newTicketNumber();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await payload.find({
        collection: "tickets",
        where: { ticketNumber: { equals: candidate } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      } as never);
      if (!(res?.docs ?? []).length) return candidate;
    } catch (err) {
      payload.logger?.warn(
        { err },
        "[tickets] could not check the new ticket number for collisions — issuing it anyway",
      );
      return candidate;
    }
    candidate = newTicketNumber();
  }

  // Every draw collided, which says something is wrong with the search rather
  // than with the numbers. Issue one and let the index decide, rather than
  // hanging the request.
  payload.logger?.warn(
    { attempts: MAX_ATTEMPTS },
    "[tickets] every candidate ticket number appeared to be taken — issuing the last one",
  );
  return candidate;
}

export const ticketNumberBeforeValidate: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data;

  if (operation === "update") {
    // Immutable once issued. It is printed on the customer's confirmation email
    // and is how they look the ticket up, so changing it orphans them from
    // their own ticket. Unlike stock, the stored value is safe to read from
    // `originalDoc` here: Tickets has no versions, so Payload falls back to the
    // live document rather than a snapshot.
    const issued = typeof originalDoc?.ticketNumber === "string" ? originalDoc.ticketNumber : "";
    if (issued && "ticketNumber" in data && data.ticketNumber !== issued) {
      req?.payload?.logger?.warn(
        {
          ticket: originalDoc?.id,
          attempted: data.ticketNumber,
          kept: issued,
          by: req?.user?.email ?? "unknown",
        },
        "[tickets] discarded an attempt to change an issued ticket number",
      );
    }
    if (issued && "ticketNumber" in data) data.ticketNumber = issued;
    return data;
  }

  if (operation !== "create") return data;

  const supplied = typeof data.ticketNumber === "string" ? data.ticketNumber.trim() : "";
  if (supplied) {
    data.ticketNumber = supplied;
    return data;
  }

  if (!req?.payload) return data;
  data.ticketNumber = await unusedTicketNumber(req.payload as never);
  return data;
};
