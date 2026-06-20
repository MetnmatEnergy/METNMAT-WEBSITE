import { NextResponse } from "next/server";
import { findTicketByNumberAndEmail, addTicketMessage } from "@/backend/services/tickets.service";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

/**
 * POST /api/support/reply — the customer adds a message to their own ticket.
 * Gated by ticket number + email (same credential as the status lookup).
 */
export const dynamic = "force-dynamic";

type Body = { ticket?: string; email?: string; body?: string };

export async function POST(req: Request) {
  const rl = await limitRate(`support-reply:${clientIp(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many messages. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 30) } }
    );
  }

  let data: Body;
  try {
    data = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const ticket = data.ticket?.trim();
  const email = data.email?.trim();
  const message = data.body?.trim();
  if (!ticket || !email) {
    return NextResponse.json({ ok: false, error: "Ticket and email are required." }, { status: 400 });
  }
  if (!message || message.length < 2) {
    return NextResponse.json({ ok: false, error: "Please type a message." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ ok: false, error: "Message is too long." }, { status: 400 });
  }

  const doc = await findTicketByNumberAndEmail(ticket, email);
  if (!doc) {
    return NextResponse.json({ ok: false, error: "No ticket found for that number and email." }, { status: 404 });
  }

  const saved = await addTicketMessage(
    doc.id,
    { from: "customer", authorName: doc.name, body: message },
    doc.status
  );
  if (!saved) {
    return NextResponse.json({ ok: false, error: "Could not send your message. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
