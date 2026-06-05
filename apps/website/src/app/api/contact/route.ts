import { NextResponse } from "next/server";
import { validateEnquiry } from "@/backend/validation";
import { createEnquiry } from "@/backend/services/enquiries.service";
import { rateLimit, clientIp } from "@/backend/lib/rate-limit";

// POST /api/contact — submit a contact enquiry.
export async function POST(request: Request) {
  const rl = rateLimit(`contact:${clientIp(request)}`);
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

  const enquiry = await createEnquiry(result.data);
  return NextResponse.json({ ok: true, data: enquiry }, { status: 201 });
}
