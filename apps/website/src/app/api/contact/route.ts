import { NextResponse } from "next/server";
import { validateEnquiry } from "@/backend/validation";
import { createEnquiry } from "@/backend/services/enquiries.service";
import { sendQuoteEmails } from "@/backend/lib/email";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { checkEmailSanity } from "@/backend/lib/form-guard";
import { alertResearchGroup } from "@/backend/lib/group-alert";

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
  if (saved.ok) {
    // This form has no bot challenge (honeypot and rate limit only), so an
    // address with no mail server is taken as spam and kept out of the group.
    const data = result.data;
    void checkEmailSanity(data.email)
      .then((s) =>
        s.reasons.length
          ? false
          : alertResearchGroup({
              kind: "contact",
              reference: saved.referenceId,
              name: data.name,
              company: data.company,
              email: data.email,
              phone: data.phone,
              message: data.message,
            })
      )
      .catch(() => false);
  }
  if (!saved) {
    const { customer, team } = await sendQuoteEmails(result.data);
    // The lead is not lost as long as the team was reached.
    const emailed = customer || team;
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
