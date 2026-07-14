import { NextResponse } from "next/server";
import {
  getCurrentCustomer,
  patchCurrentCustomer,
  CUSTOMER_COOKIE,
  cookieOptions,
} from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
export const dynamic = "force-dynamic";

/**
 * POST /api/account/password  { currentPassword, newPassword }
 * Changes the signed-in customer's password. The CURRENT password is verified
 * (via a login attempt) before the change — having a valid session is not enough,
 * so a hijacked tab can't silently lock the owner out.
 */
export async function POST(req: Request): Promise<Response> {
  const rl = await limitRate(`pwchange:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const me = await getCurrentCustomer();
  if (!me?.email) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const current = String(body?.currentPassword ?? "");
  const next = String(body?.newPassword ?? "");
  if (next.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: "New password must be different from your current one." }, { status: 400 });
  }

  // Verify the current password before allowing the change.
  try {
    const lr = await fetch(`${CMS}/api/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: me.email, password: current }),
      cache: "no-store",
    });
    if (!lr.ok) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: "Couldn't verify your current password right now. Please try again." },
      { status: 502 }
    );
  }

  const updated = await patchCurrentCustomer({ password: next });
  if (!updated) {
    return NextResponse.json(
      { error: "Couldn't update your password right now. Please try again." },
      { status: 502 }
    );
  }

  // The change bumped this account's `sessionsValidFrom`, so the token in THIS
  // browser's cookie (minted before the change) is now invalid too. Re-login
  // with the new password to mint a fresh token and refresh the cookie — the
  // current device stays signed in while every OTHER device is signed out.
  // Best-effort: the password IS changed regardless; if the refresh fails the
  // user simply re-signs in with the new password (never a lockout).
  const res = NextResponse.json({ success: true });
  try {
    const lr2 = await fetch(`${CMS}/api/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: me.email, password: next }),
      cache: "no-store",
    });
    const data = (await lr2.json().catch(() => ({}))) as { token?: string; exp?: number };
    if (lr2.ok && data?.token) {
      const maxAge = data.exp ? Math.max(60, data.exp - Math.floor(Date.now() / 1000)) : undefined;
      res.cookies.set(CUSTOMER_COOKIE, data.token, cookieOptions(maxAge));
    }
  } catch {
    /* refresh is best-effort — password already changed */
  }
  return res;
}
