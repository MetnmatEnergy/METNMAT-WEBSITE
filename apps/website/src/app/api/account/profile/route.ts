import { NextResponse } from "next/server";
import { getCustomerToken, patchCurrentCustomer } from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // Throttle profile writes (an authenticated session can otherwise hammer the CMS).
  const rl = await limitRate(`profile:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many updates — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  // No session → ask to sign in. (Distinct from an upstream failure below.)
  if (!(await getCustomerToken())) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  let body: { name?: string; phone?: string; company?: string; gstin?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });

  // Only forward a recognised role (the CMS select rejects unknowns; keep it clean).
  const ROLES = ["", "student", "phd", "faculty", "scientist", "procurement", "industry", "other"];
  const role = ROLES.includes(String(body?.role ?? "")) ? String(body?.role ?? "") : "";

  const updated = await patchCurrentCustomer({
    name,
    phone: String(body?.phone ?? "").trim(),
    company: String(body?.company ?? "").trim(),
    gstin: String(body?.gstin ?? "").trim(),
    // null (not "") — Payload's select validator rejects "" but accepts null, so
    // this both saves a chosen role and lets a user clear it back to "Not set".
    role: role || null,
  });
  // A null here means the save failed upstream (network/CMS), not a bad session —
  // don't mislead the user into re-logging in.
  if (!updated) {
    return NextResponse.json(
      { error: "Couldn't save your changes right now. Please try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true, customer: updated });
}
