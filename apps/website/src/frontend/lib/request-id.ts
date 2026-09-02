/**
 * A key identifying ONE filled-in form.
 *
 * Sent with every submit attempt so the server can recognise a repeat — a double
 * click, a refresh of the POST, a client retry after a slow response — instead
 * of filing a second RFQ and re-sending both emails with the customer's
 * attachments a second time. Mint once when the form is first shown and hold it
 * until a submission succeeds; a new key means a genuinely new request.
 *
 * randomUUID needs a secure context. The fallback keeps a plain-http preview
 * working rather than throwing inside a render, and does not need to be
 * unguessable: the key only ever addresses the sender's own submission.
 */
export function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
