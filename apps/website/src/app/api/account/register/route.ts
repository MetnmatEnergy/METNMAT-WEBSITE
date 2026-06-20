import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE, cookieOptions } from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const rl = await limitRate(`register:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  let body: { name?: string; email?: string; password?: string; phone?: string; company?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const phone = String(body?.phone ?? "").trim();
  const company = String(body?.company ?? "").trim();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    // Create the customer (public registration).
    const cr = await fetch(`${CMS}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone, company }),
      cache: "no-store",
    });
    if (!cr.ok) {
      const cd = await cr.json().catch(() => ({}));
      const blob = JSON.stringify(cd).toLowerCase();
      if (/already|duplicate|unique|taken/.test(blob)) {
        return NextResponse.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });
      }
      return NextResponse.json({ error: "Couldn't create your account. Please check your details." }, { status: 400 });
    }

    // Auto sign-in.
    const lr = await fetch(`${CMS}/api/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const ld = (await lr.json().catch(() => ({}))) as { token?: string; exp?: number };
    const res = NextResponse.json({ success: true });
    if (lr.ok && ld?.token) {
      const maxAge = ld.exp ? Math.max(60, ld.exp - Math.floor(Date.now() / 1000)) : undefined;
      res.cookies.set(CUSTOMER_COOKIE, ld.token, cookieOptions(maxAge));
    }
    return res;
  } catch {
    return NextResponse.json({ error: "Couldn't create your account right now. Please try again." }, { status: 502 });
  }
}
