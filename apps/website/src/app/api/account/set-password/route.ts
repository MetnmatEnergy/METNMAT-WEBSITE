import { NextResponse } from "next/server";
import {
  getCurrentCustomer,
  CUSTOMER_COOKIE,
  cookieOptions,
} from "@/backend/lib/customer";
import { outboundKey } from "@/backend/lib/internal-key";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
export const dynamic = "force-dynamic";

/**
 * POST /api/account/set-password  { password }
 *
 * Gives a Google-created account its first password, so the customer can then
 * sign in with EITHER Google or email + password. No current password is asked
 * for because there isn't one — the CMS seeded a random secret at create time.
 *
 * That is only safe while the account genuinely has no chosen password, so the
 * precondition is enforced twice: here (fast, friendly error) and again in the
 * CMS endpoint (authoritative — it is the one holding overrideAccess). The
 * customer id comes from the session cookie, never from the request body.
 */
export async function POST(req: Request): Promise<Response> {
  const rl = await limitRate(`setpw:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const me = await getCurrentCustomer();
  if (!me?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  if (me.authProvider !== "google") {
    return NextResponse.json(
      { error: "You already have a password. Use “Change password” to update it." },
      { status: 409 }
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const password = String(body?.password ?? "");
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  // A password that is just the email (or its local part) is trivially guessable
  // for an account whose email is public on every order.
  const local = (me.email ?? "").split("@")[0] ?? "";
  const lower = password.toLowerCase();
  if (me.email && (lower === me.email.toLowerCase() || (local.length >= 4 && lower === local.toLowerCase()))) {
    return NextResponse.json({ error: "Choose a password that isn't your email address." }, { status: 400 });
  }

  try {
    const r = await fetch(`${CMS}/api/customers/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": outboundKey("CMS_OAUTH_KEY") },
      body: JSON.stringify({ customerId: me.id, password }),
      cache: "no-store",
    });
    if (r.status === 409) {
      return NextResponse.json(
        { error: "You already have a password. Use “Change password” to update it." },
        { status: 409 }
      );
    }
    if (!r.ok) {
      console.error(`[account/set-password] CMS refused status=${r.status}`);
      return NextResponse.json(
        { error: "Couldn't set your password right now. Please try again." },
        { status: 502 }
      );
    }
    // Setting the password bumped this account's `sessionsValidFrom`, which
    // invalidates the Google-login token currently in the cookie. Re-login with
    // the just-set password to mint a fresh token and refresh the cookie, so the
    // customer stays signed in on this device (mirrors the change-password route).
    // Best-effort: the password IS set regardless; a failed refresh just means
    // they sign in again with Google or the new password (never a lockout).
    const res = NextResponse.json({ success: true });
    try {
      const lr = await fetch(`${CMS}/api/customers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: me.email, password }),
        cache: "no-store",
      });
      const data = (await lr.json().catch(() => ({}))) as { token?: string; exp?: number };
      if (lr.ok && data?.token) {
        const maxAge = data.exp ? Math.max(60, data.exp - Math.floor(Date.now() / 1000)) : undefined;
        res.cookies.set(CUSTOMER_COOKIE, data.token, cookieOptions(maxAge));
      }
    } catch {
      /* refresh is best-effort — password already set */
    }
    return res;
  } catch {
    return NextResponse.json(
      { error: "Couldn't set your password right now. Please try again." },
      { status: 502 }
    );
  }
}
