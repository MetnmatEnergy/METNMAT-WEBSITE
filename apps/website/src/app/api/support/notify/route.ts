import { NextResponse } from "next/server";
import { sendTicketReplyEmail } from "@/backend/lib/email";

/**
 * POST /api/support/notify — internal only (x-internal-key). Called by the
 * dashboard's ticket afterChange hook when staff add a reply, so the website
 * (which owns Resend) emails that reply to the customer.
 */
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(req: Request) {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret || req.headers.get("x-internal-key") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { ticketNumber?: string; name?: string; email?: string; subject?: string; body?: string; authorName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (!body.ticketNumber || !body.email || !body.body) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  const emailed = await sendTicketReplyEmail({
    ticketNumber: body.ticketNumber,
    name: body.name ?? "there",
    email: body.email,
    subject: body.subject ?? "your ticket",
    body: body.body,
    authorName: body.authorName,
    statusUrl: `${SITE}/support?view=status&ticket=${encodeURIComponent(body.ticketNumber)}`,
  }).catch(() => false);

  return NextResponse.json({ ok: true, emailed });
}
