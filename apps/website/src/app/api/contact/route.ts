import { NextResponse } from "next/server";
import { validateEnquiry } from "@/backend/validation";
import { createEnquiry } from "@/backend/services/enquiries.service";
import { sendQuoteEmails } from "@/backend/lib/email";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

// POST /api/contact — submit a contact enquiry.
export async function POST(request: Request) {
  const rl = await limitRate(`contact:${clientIp(request)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const body = await request.json().catch(() => null);
  const result = validateEnquiry(body, "contact");

  if (!result.success) {
    return NextResponse.json({ ok: false, fields: result.fields }, { status: 400 });
  }

  // Persist to the CMS. On a transient CMS failure DON'T claim success (the old
  // code always returned 201, silently losing the lead) — fall back to emailing
  // the team so the enquiry still reaches someone, and only surface an error if
  // BOTH channels fail so the client's retry UI shows.
  const saved = await createEnquiry(result.data);
  if (!saved) {
    const emailed = await sendQuoteEmails(result.data);
    if (!emailed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "We couldn't submit your message right now. Please try again, or email us directly at contact@metnmat.com.",
        },
        { status: 502 }
      );
    }
  }
  return NextResponse.json({ ok: true, saved }, { status: 201 });
}
