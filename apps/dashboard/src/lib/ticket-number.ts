/**
 * The support ticket number: how a customer finds their own ticket again.
 *
 * WHAT WAS BROKEN. `ticketNumber` was declared `required: true` with
 * `admin.readOnly: true`, and nothing on the server filled it in. Those cannot
 * both hold from the admin — read-only means the box cannot be typed into,
 * required means an empty box is refused, and the refusal happens in the
 * BROWSER:
 *
 *   payload/dist/fields/validations.js  (text)
 *     if (required) { if (!value || value.length === 0) return t('validation:required') }
 *   @payloadcms/ui/dist/forms/Form/index.js:285
 *     if (!isValid_2) { errorToast(t('error:correctInvalidFields')); ... return }
 *
 * The request never reached the server, so no hook could have rescued it.
 * Tickets is the severe form of this: a collection with `versions.drafts` lets
 * staff press Save draft, which submits with `skipValidation: true` and lets the
 * value appear. Tickets has no versions key, so there was no second button —
 * staff simply could not raise a ticket.
 *
 * The public flow never hit it, because the website mints its own number and
 * posts it over the internal key. Only the admin path was dead.
 *
 * ONE SHAPE, TWO APPS. `apps/website/src/app/api/support/route.ts` builds the
 * same string, and the two cannot import from one another. They share a format
 * instead, and a test asserts the website still builds the shape described here
 * — so a change on that side fails loudly rather than quietly producing a second
 * kind of ticket number for staff to tell apart.
 */

/** `TKT-YYYYMMDD-XXXX`, the form printed on every confirmation email. */
export const TICKET_NUMBER_PATTERN = /^TKT-\d{8}-[0-9A-F]{4}$/;

/**
 * Build a ticket number for a moment in time and a random suffix.
 *
 * The date is LOCAL, matching the website. Pure, so the format is testable
 * without stubbing the clock or the random source.
 */
export function formatTicketNumber(now: Date, suffix: string): string {
  const ymd =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}`;
  return `TKT-${ymd}-${suffix.slice(0, 4).toUpperCase()}`;
}

/** A fresh candidate number. Four hex characters — 65536 per day. */
export function newTicketNumber(now: Date = new Date()): string {
  return formatTicketNumber(now, crypto.randomUUID().slice(0, 4));
}

/**
 * The validator that lets the form be submitted at all.
 *
 * A custom `validate` REPLACES the built-in text validator rather than running
 * alongside it, so `required: true` stays declared — and stays true, because the
 * server fills the field before the document is written. The same function runs
 * in the browser and on the server, so the two cannot disagree.
 *
 * UPDATE IS NOT POLICED, deliberately. The number is pinned to the stored value
 * on update, so re-checking its shape could only ever lock staff out of a ticket
 * raised before this format existed — a ticket someone is presumably waiting on
 * an answer to.
 */
export function ticketNumberValidator() {
  return (value: unknown, ctx: unknown): true | string => {
    const operation = (ctx as { operation?: string } | undefined)?.operation;
    if (operation === "update") return true;

    const v = typeof value === "string" ? value.trim() : "";
    if (v === "") return true; // the server issues it

    return TICKET_NUMBER_PATTERN.test(v)
      ? true
      : "Leave this empty and a ticket number will be created, or enter one like TKT-20260905-A1B2.";
  };
}
