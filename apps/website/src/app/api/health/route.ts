import { NextResponse } from "next/server";

// GET /api/health — simple liveness probe.
export async function GET() {
  return NextResponse.json({ ok: true, service: "website-api", ts: new Date().toISOString() });
}
