import { NextResponse } from "next/server";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
export const dynamic = "force-dynamic";

/** Request a password-reset email. Always returns success (no email enumeration). */
export async function POST(req: Request): Promise<Response> {
  const rl = await limitRate(`forgot:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  // Per-email throttle to prevent reset-email bombing of a specific address.
  // Return success regardless (never reveal whether the account exists).
  const er = await limitRate(`forgot:email:${email}`, 3, 60 * 60_000);
  if (!er.ok) return NextResponse.json({ success: true });

  /*
   * Two different things were being conflated.
   *
   * Not revealing whether an account exists is correct and stays: Payload's
   * forgot-password answers the same way either way, and so do we. But the
   * catch-all also swallowed OUR OWN failures — a CMS that was down, or
   * answering 500 — and still returned success. The customer was told to check
   * an inbox for a mail that had not been sent and never would be, and the only
   * way to discover it was to keep waiting.
   *
   * A transport failure or a 5xx is information about US, not about the account,
   * so reporting it reveals nothing and is the honest answer. Anything the CMS
   * actually answers stays a success from the caller's point of view.
   */
  try {
    const res = await fetch(`${CMS}/api/customers/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 500) {
      console.warn(`[forgot] CMS answered ${res.status} — reset email not sent`);
      return NextResponse.json(
        { error: "We couldn't send the reset email just now. Please try again in a moment." },
        { status: 502 }
      );
    }
  } catch (e) {
    console.warn(`[forgot] CMS unreachable — reset email not sent: ${(e as Error).name}`);
    return NextResponse.json(
      { error: "We couldn't send the reset email just now. Please try again in a moment." },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true });
}
