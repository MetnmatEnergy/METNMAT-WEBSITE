/**
 * Support tickets service — persists & reads tickets in the dashboard CMS
 * (Payload `tickets` collection). All calls use the shared x-internal-key, so
 * only the website SERVER touches tickets — the public never does.
 */
const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const KEY = process.env.INTERNAL_API_KEY || "";

const headers = { "Content-Type": "application/json", "x-internal-key": KEY };

export type TicketMessage = {
  from: "customer" | "staff";
  authorName?: string;
  body: string;
  createdAt?: string;
};

export type TicketInput = {
  ticketNumber: string;
  category: string;
  subject: string;
  description: string;
  orderNumber?: string;
  name: string;
  email: string;
  phone?: string;
  attachmentIds?: string[];
  source?: string;
};

export type TicketDoc = {
  id: string;
  ticketNumber: string;
  status: string;
  priority?: string;
  category?: string;
  subject: string;
  description: string;
  orderNumber?: string;
  name: string;
  email: string;
  phone?: string;
  messages?: TicketMessage[];
  createdAt?: string;
  updatedAt?: string;
};

/** Create a new ticket (status "open"). Returns the created doc or null. */
export async function createTicket(input: TicketInput): Promise<TicketDoc | null> {
  try {
    const { attachmentIds, ...rest } = input;
    const res = await fetch(`${CMS}/api/tickets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...rest,
        status: "open",
        priority: "normal",
        messages: [],
        ...(attachmentIds?.length ? { attachments: attachmentIds } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`[tickets] create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const json = (await res.json()) as { doc?: TicketDoc };
    return json?.doc ?? null;
  } catch (e) {
    console.error("[tickets] create error:", e);
    return null;
  }
}

/**
 * Look up a ticket by its number AND email (the two together act as the
 * customer's access credential — no public read of the CMS). Returns null when
 * the number is unknown or the email doesn't match.
 */
export async function findTicketByNumberAndEmail(
  ticketNumber: string,
  email: string
): Promise<TicketDoc | null> {
  try {
    const res = await fetch(
      `${CMS}/api/tickets?depth=0&limit=1&where[ticketNumber][equals]=${encodeURIComponent(ticketNumber.trim())}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { docs?: TicketDoc[] };
    const doc = json?.docs?.[0];
    if (!doc) return null;
    if (doc.email?.toLowerCase().trim() !== email.toLowerCase().trim()) return null;
    return doc;
  } catch {
    return null;
  }
}

/** Append a message to a ticket's thread. Customer replies re-open the ticket. */
export async function addTicketMessage(
  id: string,
  message: TicketMessage,
  currentStatus?: string
): Promise<boolean> {
  try {
    // Read current thread (Payload array fields are replaced wholesale on PATCH).
    const cur = await fetch(`${CMS}/api/tickets/${id}?depth=0`, { headers, cache: "no-store" });
    if (!cur.ok) return false;
    const curDoc = (await cur.json()) as TicketDoc;
    const messages = [...(curDoc.messages ?? []), { ...message, createdAt: new Date().toISOString() }];

    const reopen =
      message.from === "customer" && ["waiting", "resolved", "closed"].includes(currentStatus ?? curDoc.status);

    const res = await fetch(`${CMS}/api/tickets/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ messages, ...(reopen ? { status: "open" } : {}) }),
    });
    return res.ok;
  } catch (e) {
    console.error("[tickets] add message error:", e);
    return false;
  }
}
