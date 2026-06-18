import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE, cookieOptions } from "@/backend/lib/customer";
import { rateLimit, clientIp } from "@/backend/lib/rate-limit";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
export const dynamic = "force-dynamic";

/** Complete a password reset with the emailed token, then sign the customer in. */
export async function POST(req: Request): Promise<Response> {
  const rl = rateLimit(`reset:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = String(body?.token ?? "").trim();
  const password = String(body?.password ?? "");
  if (!token) return NextResponse.json({ error: "This reset link is invalid." }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const r = await fetch(`${CMS}/api/customers/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as { token?: string; exp?: number };
    if (!r.ok) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }
    const res = NextResponse.json({ success: true });
    if (data?.token) {
      const maxAge = data.exp ? Math.max(60, data.exp - Math.floor(Date.now() / 1000)) : undefined;
      res.cookies.set(CUSTOMER_COOKIE, data.token, cookieOptions(maxAge));
    }
    return res;
  } catch {
    return NextResponse.json({ error: "Couldn't reset your password right now." }, { status: 502 });
  }
}
