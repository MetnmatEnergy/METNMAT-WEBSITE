import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE, cookieOptions } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ success: true });
  // Expire it with the SAME attributes it was set with (secure/sameSite/httpOnly,
  // path=/) so the browser reliably matches and drops the cookie.
  res.cookies.set(CUSTOMER_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return res;
}
