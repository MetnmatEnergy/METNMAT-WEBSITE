import { NextResponse } from "next/server";
import { createTicket } from "@/backend/services/tickets.service";
import { sendTicketEmails } from "@/backend/lib/email";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { collectGrantedIds } from "@/backend/lib/attachment-grant";
import { screenSubmission, checkEmailSanity, autoReplyBudget } from "@/backend/lib/form-guard";
import { honeypotTripped } from "@/backend/validation";

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
  /** Signed grants from /api/quote/upload — never bare ids. */
  attachmentGrants?: unknown;
  /** Bot check, same fields as the quote form (components/commerce/bot-check). */
  formToken?: unknown;
  turnstileToken?: unknown;
  mm_trap?: unknown;
};

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await limitRate(`support:${ip}`);
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

  // Honeypot first, so a bot never reaches a Cloudflare round-trip.
  if (honeypotTripped(body as Record<string, unknown>)) return bad("Invalid request.");

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

  /*
   * BOT CHECK, then ADDRESS SANITY, then the AUTO-REPLY BUDGET — the quote
   * form's layers (backend/lib/form-guard.ts), which this endpoint never had.
   *
   * In September 2026 the support inbox filled with tickets whose names and
   * subjects were random letters ("cyPcWDbiRYvYDcwleEJb"). Each one sent a
   * confirmation to whatever address was typed in, carrying the submitted
   * subject — the same mail relay the quote form was closed against on
   * 2026-09-04. A failed challenge is refused; a doubtful address is still
   * filed and staff still told, but gets no confirmation and the alert is
   * tagged. A real customer's ticket is never dropped short of "this is a bot".
   */
  const screen = await screenSubmission(body as Record<string, unknown>, ip);
  if (screen.verdict === "reject") {
    console.warn(`[support] rejected submission: ${screen.reason}`);
    return NextResponse.json(
      { ok: false, error: screen.error, code: "bot-check", reason: screen.reason },
      { status: 400 }
    );
  }
  const sanity = await checkEmailSanity(email);
  const suspectReasons = [
    ...(screen.verdict === "suspect" ? screen.reasons : []),
    ...sanity.reasons,
  ];
  let sendCustomerCopy = false;
  if (suspectReasons.length === 0) {
    const budget = await autoReplyBudget(email, ip);
    sendCustomerCopy = budget.ok;
    if (!budget.ok) console.warn(`[support] confirmation withheld: ${budget.exceeded} budget exhausted`);
  } else {
    console.warn(`[support] confirmation withheld, alert tagged: ${suspectReasons.join(", ")}`);
  }

  // Attachment ids are not accepted from the body. They address private files
  // belonging to whoever uploaded them, so an unverified id let a caller staple
  // another customer's document onto their own ticket for staff to open.
  const granted = collectGrantedIds(body.attachmentGrants, 5);
  if (granted.rejected > 0) {
    console.warn(`[support] rejected ${granted.rejected} unverified attachment reference(s)`);
  }
  const attachmentIds = granted.ids.length ? granted.ids : undefined;

  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  // Ten characters from an alphabet without look-alikes (~49 bits). The number
  // plus an email is the whole credential for reading and replying to a ticket;
  // the previous four hex characters (65,536 per day) could be walked from a
  // few addresses (2026-09-17 audit). Same alphabet and length as the CMS's
  // lib/ticket-number.ts, whose pattern is what validates this on create.
  const TICKET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const suffixBytes = new Uint8Array(10);
  crypto.getRandomValues(suffixBytes);
  let suffix = "";
  for (const b of suffixBytes) suffix += TICKET_ALPHABET[b % TICKET_ALPHABET.length];
  const ticketNumber = `TKT-${ymd}-${suffix}`;

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
  }, { sendCustomerCopy, suspectReasons }).catch(() => false);

  return NextResponse.json({ ok: true, ticketNumber, emailed });
}
