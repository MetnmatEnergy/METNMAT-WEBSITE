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

  try {
    await fetch(`${CMS}/api/customers/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
  } catch {
    /* swallow — never reveal whether the account exists */
  }
  return NextResponse.json({ success: true });
}
