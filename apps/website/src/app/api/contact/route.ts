import { NextResponse } from "next/server";
import { validateEnquiry } from "@/backend/validation";
import { createEnquiry } from "@/backend/services/enquiries.service";
import { sendQuoteEmails } from "@/backend/lib/email";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { screenSubmission, checkEmailSanity } from "@/backend/lib/form-guard";
import { recordIntegrationLog } from "@/backend/services/orders.service";
import { alertResearchGroup } from "@/backend/lib/group-alert";

// POST /api/contact — submit a contact enquiry.
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = await limitRate(`contact:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const result = validateEnquiry(body, "contact");

  if (!result.success) {
    return NextResponse.json({ ok: false, fields: result.fields }, { status: 400 });
  }
  const data = result.data;

  /*
   * BOT CHECK, then ADDRESS SANITY — the quote and support forms' layers
   * (backend/lib/form-guard.ts), which this endpoint never had. It had only the
   * honeypot and a per-IP rate limit, so on 2026-10-30 two submissions named in
   * random letters ("Bacrgk Yprcrdymt", "Scug Cipiv") with a phone number as the
   * message went straight to the WhatsApp group: a dotted Gmail address passes
   * the mail-server check. A failed challenge is refused; a doubtful address is
   * still filed and staff still emailed, tagged, but kept out of the group.
   */
  const screen = await screenSubmission(body ?? {}, ip);
  if (screen.verdict === "reject") {
    console.warn(`[contact] rejected submission: ${screen.reason}`);
    return NextResponse.json(
      { ok: false, error: screen.error, code: "bot-check", reason: screen.reason },
      { status: 400 }
    );
  }
  const sanity = await checkEmailSanity(data.email);
  const suspectReasons = [
    ...(screen.verdict === "suspect" ? screen.reasons : []),
    ...sanity.reasons,
  ];
  if (suspectReasons.length) {
    console.warn(`[contact] team email tagged: ${suspectReasons.join(", ")}`);
  }

  /*
   * SAVE, then EMAIL THE TEAM — every time.
   *
   * The team email used to be a fallback for a failed CMS save only, and the
   * fallback was dead: it tested `!saved`, but createEnquiry has returned an
   * object since 2026-09-02, so it never ran. Every contact message reached the
   * admin and nobody's inbox, and on 2026-10-30 a university's request for a
   * quotation surfaced only through the WhatsApp group. Now sales is emailed
   * like a quote request. The visitor gets no copy, as before: the form's own
   * success screen is the acknowledgement, and an auto-reply here would be one
   * more address-of-your-choice relay to guard.
   */
  const saved = await createEnquiry(data);
  const emailed = await sendQuoteEmails({ ...data, referenceId: saved.referenceId }, [], {
    kind: "contact",
    sendCustomerCopy: false,
    suspectReasons,
  });

  if (!emailed.team) {
    console.error(`[contact] team email NOT sent for ${saved.referenceId ?? "an unsaved message"}`);
    if (saved.ok) {
      void recordIntegrationLog({
        integration: "contact-email",
        status: "error",
        summary: `Contact message ${saved.referenceId ?? "(no reference)"} filed, but the team email did not send`,
        payload: { reference: saved.referenceId, email: data.email },
      });
    }
  }

  if (!saved.ok) {
    console.error("[contact] CMS save FAILED", { email: data.email, teamNotified: emailed.team });
    // The lead is not lost as long as the team was reached.
    if (!emailed.team) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "We couldn't submit your message right now. Please try again, or email us directly at contact@metnmat.com.",
        },
        { status: 502 }
      );
    }
  } else if (suspectReasons.length === 0) {
    // Not for a tagged message: the group's send budget is shared with the
    // Amazon order alerts, and the tagged email already reaches sales.
    void alertResearchGroup({
      kind: "contact",
      reference: saved.referenceId,
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      message: data.message,
    });
  }

  return NextResponse.json(
    { ok: true, saved: saved.ok, reference: saved.referenceId, emailedTeam: emailed.team },
    { status: 201 }
  );
}
