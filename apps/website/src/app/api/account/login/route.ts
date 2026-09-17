import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE, cookieOptions } from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const rl = await limitRate(`login:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  // Per-address budget under the CMS's own lock (8 failures locks the account
  // for 10 minutes): without it, anyone who knows a customer's email can keep
  // that account locked from a few IPs. Five a minute per address is well above
  // what a person typing their own password needs and below the CMS threshold.
  const rlEmail = await limitRate(`login-email:${email}`, 5, 60_000);
  if (!rlEmail.ok) {
    return NextResponse.json(
      { error: "Too many sign-in attempts for this email. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rlEmail.retryAfter ?? 60) } }
    );
  }
  try {
    const r = await fetch(`${CMS}/api/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as { token?: string; exp?: number };
    if (!r.ok || !data?.token) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    const res = NextResponse.json({ success: true });
    const maxAge = data.exp ? Math.max(60, data.exp - Math.floor(Date.now() / 1000)) : undefined;
    res.cookies.set(CUSTOMER_COOKIE, data.token, cookieOptions(maxAge));
    return res;
  } catch {
    return NextResponse.json({ error: "Couldn't sign in right now. Please try again." }, { status: 502 });
  }
}
