import { NextResponse } from "next/server";
import { createTicket } from "@/backend/services/tickets.service";
import { sendTicketEmails } from "@/backend/lib/email";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

/**
 * POST /api/support — raise a support ticket.
 * Public form endpoint; the ticket is written to the CMS via the internal key
 * (the browser never touches the CMS). Returns the new ticket number.
 */
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const CATEGORIES = new Set([
  "order-issue",
  "product-quality",
  "shipping-delivery",
  "payment-billing",
  "technical-support",
  "other",
]);

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  category?: string;
  subject?: string;
  description?: string;
  orderNumber?: string;
  attachmentIds?: string[];
};

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const rl = await limitRate(`support:${clientIp(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 30) } }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Invalid request.");
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const subject = body.subject?.trim();
  const description = body.description?.trim();
  const category = CATEGORIES.has(body.category ?? "") ? (body.category as string) : "other";

  if (!name) return bad("Please enter your name.");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return bad("Please enter a valid email.");
  if (!subject || subject.length < 3) return bad("Please add a short subject.");
  if (!description || description.length < 10) {
    return bad("Please describe your issue in a little more detail.");
  }
  if (description.length > 5000) return bad("Please keep the description under 5000 characters.");

  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.filter((id) => typeof id === "string").slice(0, 5)
    : undefined;

  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const ticketNumber = `TKT-${ymd}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const doc = await createTicket({
    ticketNumber,
    category,
    subject,
    description,
    orderNumber: body.orderNumber?.trim() || undefined,
    name,
    email,
    phone: body.phone?.trim() || undefined,
    attachmentIds,
    source: "website support form",
  });
  if (!doc) return bad("Could not create your ticket. Please try again.", 502);

  // Confirmation + internal alert — best-effort, never block the response.
  const statusUrl = `${SITE}/support?view=status&ticket=${encodeURIComponent(ticketNumber)}`;
  const emailed = await sendTicketEmails({
    ticketNumber,
    name,
    email,
    subject,
    description,
    category,
    orderNumber: body.orderNumber?.trim() || undefined,
    statusUrl,
  }).catch(() => false);

  return NextResponse.json({ ok: true, ticketNumber, emailed });
}
