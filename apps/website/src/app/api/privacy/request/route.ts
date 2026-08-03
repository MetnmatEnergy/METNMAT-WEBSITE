import { NextResponse } from "next/server";
import { validateDataRequest } from "@/backend/validation";
import { createDataRequest, type DataRequestType } from "@/backend/services/data-requests.service";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

/**
 * POST /api/privacy/request — file a Data Principal rights request (DPDP ss.11-14).
 *
 * Unlike the enquiry route there is NO email fallback on a CMS failure. A rights
 * request carries a statutory clock, so it has to leave an auditable record with
 * a reference and a due date. Silently emailing it instead would look like
 * success while the obligation went untracked — the caller is told to try again
 * or write to the Grievance Officer directly.
 */
export async function POST(request: Request) {
  const rl = await limitRate(`privacy-request:${clientIp(request)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const body = await request.json().catch(() => null);
  const result = validateDataRequest(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, fields: result.fields }, { status: 400 });
  }

  const reference = await createDataRequest({
    ...result.data,
    type: result.data.type as DataRequestType,
  });

  if (!reference) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "We couldn't record your request right now. Please try again, or email contact@metnmat.com and we will log it manually.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, reference }, { status: 201 });
}
