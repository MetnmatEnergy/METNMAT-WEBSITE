import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";

/**
 * GET /api/ready — READINESS probe. Can this CMS actually serve?
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT /api/health
 *
 * On 2026-08-11 the dashboard returned 500 on every Payload route in production
 * — `/`, `/admin`, `/admin/login`, the whole REST API — because MONGODB_URI held
 * the literal string PLACEHOLDER_SET_ME and Payload could not initialise. The
 * deploy that shipped it went GREEN, ECS reported a steady state, and the ALB
 * kept the task in service throughout, because /api/health returns static JSON
 * and deliberately touches nothing. Nothing anywhere could tell the difference
 * between "alive" and "able to serve a single page".
 *
 * The two probes answer genuinely different questions and must stay separate:
 *
 *   /api/health  LIVENESS  — is the Node process up? Used by the ALB target
 *                            group. Must NOT touch Mongo: if it did, a brief
 *                            Atlas blip would fail every task at once, ECS would
 *                            replace them all, and the replacements would fail
 *                            the same check — turning a transient wobble into a
 *                            full outage.
 *   /api/ready   READINESS — can Payload init and reach the database? Used by
 *                            CI after a deploy, and by a human debugging. NOT
 *                            wired to the ALB, for exactly the reason above.
 *
 * So this endpoint is allowed to fail. Failing it stops a bad deploy from being
 * reported as success; it never takes a running task out of service.
 *
 * DISCLOSURE
 * This route is publicly reachable, so it returns a fixed reason code and never
 * the underlying exception — a Mongo connection error can quote the connection
 * string, credentials included.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET() {
  const started = Date.now();
  try {
    const payload = await getPayload({ config });

    // A real query, not just init. getPayload can resolve from a warm cache, so
    // touching a collection is what actually proves the database is reachable
    // right now. `users` is the smallest collection and always exists.
    await payload.count({ collection: "users" });

    return NextResponse.json(
      { ready: true, service: "dashboard-cms", ms: Date.now() - started },
      { headers: NO_STORE },
    );
  } catch (e) {
    // Log the real detail server-side (CloudWatch), return a code to the caller.
    console.error("[ready] readiness check failed:", e);

    // Payload tags its own init failures, which distinguishes "cannot reach the
    // database" from "the app is broken in some other way" without disclosing
    // anything about either.
    const reason =
      e && typeof e === "object" && "payloadInitError" in e
        ? "payload-init-failed"
        : "database-unreachable";

    return NextResponse.json(
      { ready: false, service: "dashboard-cms", reason, ms: Date.now() - started },
      { status: 503, headers: NO_STORE },
    );
  }
}

/** Probes commonly send HEAD; without this it falls through to Payload's catch-all, which answers 404. */
export async function HEAD() {
  const res = await GET();
  return new Response(null, { status: res.status, headers: NO_STORE });
}
