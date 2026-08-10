import { NextResponse } from "next/server";

/**
 * GET /api/health — liveness probe for the CMS container.
 *
 * WHY THIS EXISTS
 * Until now the dashboard had no health route, so an ALB target group had to
 * check "/", which returns a redirect to /admin. That passes a 200-399 matcher,
 * but it is fragile: any change to the root redirect silently changes what
 * "healthy" means, and a redirect says nothing about whether the app can serve.
 *
 * WHY IT DELIBERATELY DOES NOT TOUCH MONGODB
 * This is a LIVENESS check, not a readiness check. If it reported unhealthy
 * whenever Atlas was briefly unreachable, the load balancer would drain every
 * task at once and ECS would replace them — turning a transient database blip
 * into a full outage, with the new tasks failing exactly the same check. The
 * container is "alive" if the Node process can serve a request; whether its
 * dependencies are reachable is a separate question, answered by the
 * application's own error handling.
 *
 * ROUTING NOTE
 * Payload owns a catch-all at (payload)/api/[...slug]/route.ts, which handles
 * /api/*. This file wins for /api/health because Next.js resolves a static
 * segment ahead of a catch-all. A conflict would surface as a build error, so
 * `next build` succeeding is the proof that this route is reachable.
 */

// Never prerendered or cached — a cached health check is not a health check.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "dashboard-cms",
      ts: new Date().toISOString(),
    },
    {
      // Belt and braces alongside `dynamic`: some proxies cache a bare 200 by
      // heuristic, which would mask a dead container behind a stale OK.
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

/**
 * HEAD is what most load balancers and uptime probes actually send. Without it
 * the request would fall through to Payload's catch-all router, which does not
 * handle HEAD and answers 404 — the same defect that made every media file
 * appear missing to crawlers before it was fixed.
 */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
