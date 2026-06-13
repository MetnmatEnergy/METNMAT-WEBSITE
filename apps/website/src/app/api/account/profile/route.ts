import { NextResponse } from "next/server";
import { patchCurrentCustomer } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: { name?: string; phone?: string; company?: string; gstin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });

  const updated = await patchCurrentCustomer({
    name,
    phone: String(body?.phone ?? "").trim(),
    company: String(body?.company ?? "").trim(),
    gstin: String(body?.gstin ?? "").trim(),
  });
  if (!updated) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  return NextResponse.json({ success: true, customer: updated });
}
