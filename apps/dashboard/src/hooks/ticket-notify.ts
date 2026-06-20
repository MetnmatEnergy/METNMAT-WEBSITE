import type { CollectionAfterChangeHook } from "payload";
import { outboundKey } from "../lib/internal-key";

/**
 * When staff add a new reply to a ticket's conversation, ping the website to
 * email that reply to the customer (the website owns Resend). Fire-and-forget;
 * a delivery failure never blocks saving the ticket. The website's 200/401
 * keeps the trust model identical to the revalidation hook.
 */
const WEBSITE = process.env.WEBSITE_URL || "http://localhost:3000";
const KEY = outboundKey("CMS_TICKET_WRITE_KEY");

type Msg = { from?: string; body?: string; authorName?: string };

export const notifyTicketReply: CollectionAfterChangeHook = async ({ doc, previousDoc, operation }) => {
  try {
    if (operation !== "update" || !KEY) return doc;
    const before: Msg[] = Array.isArray(previousDoc?.messages) ? previousDoc.messages : [];
    const after: Msg[] = Array.isArray(doc?.messages) ? doc.messages : [];
    if (after.length <= before.length) return doc;

    // The newly-added trailing message — only email customer-facing STAFF replies.
    const added = after[after.length - 1];
    if (!added || added.from !== "staff" || !added.body) return doc;

    void fetch(`${WEBSITE}/api/support/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": KEY },
      body: JSON.stringify({
        ticketNumber: doc.ticketNumber,
        name: doc.name,
        email: doc.email,
        subject: doc.subject,
        body: added.body,
        authorName: added.authorName,
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      /* website down — staff reply still saved; customer sees it on next status check */
    });
  } catch {
    /* never block the ticket write */
  }
  return doc;
};
