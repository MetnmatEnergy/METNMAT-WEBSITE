import { NextResponse } from "next/server";
import { findTicketByNumberAndEmail } from "@/backend/services/tickets.service";
import { rateLimit, clientIp } from "@/backend/lib/rate-limit";

/**
 * GET /api/support/status?ticket=TKT-…&email=…
 * Returns a ticket's public view (status + conversation) only when BOTH the
 * ticket number and the email match — the two together are the customer's
 * access credential (no login). Rate-limited to deter guessing.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = rateLimit(`support-status:${clientIp(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 30) } }
    );
  }

  const url = new URL(req.url);
  const ticket = url.searchParams.get("ticket")?.trim();
  const email = url.searchParams.get("email")?.trim();
  if (!ticket || !email) {
    return NextResponse.json({ ok: false, error: "Ticket number and email are required." }, { status: 400 });
  }

  const doc = await findTicketByNumberAndEmail(ticket, email);
  if (!doc) {
    // Same message whether the number is wrong or the email mismatches.
    return NextResponse.json(
      { ok: false, error: "No ticket found for that number and email." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    ticket: {
      ticketNumber: doc.ticketNumber,
      status: doc.status,
      subject: doc.subject,
      category: doc.category,
      orderNumber: doc.orderNumber,
      description: doc.description,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      messages: (doc.messages ?? []).map((m) => ({
        from: m.from,
        authorName: m.authorName,
        body: m.body,
        createdAt: m.createdAt,
      })),
    },
  });
}
