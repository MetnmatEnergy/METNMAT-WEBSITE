import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ success: true });
  res.cookies.set(CUSTOMER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
