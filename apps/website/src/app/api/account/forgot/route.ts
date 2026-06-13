import { NextResponse } from "next/server";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
export const dynamic = "force-dynamic";

/** Request a password-reset email. Always returns success (no email enumeration). */
export async function POST(req: Request): Promise<Response> {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

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
