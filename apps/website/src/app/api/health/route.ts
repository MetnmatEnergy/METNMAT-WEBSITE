import { NextResponse } from "next/server";
import { geoAnalyticsConfigured } from "@/backend/services/analytics.service";

// GET /api/health — simple liveness probe.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "website-api",
    ts: new Date().toISOString(),
    // Boolean only; the token itself never leaves the server.
    features: { analyticsGeo: geoAnalyticsConfigured() },
  });
}
