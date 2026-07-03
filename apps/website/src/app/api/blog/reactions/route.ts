/**
 * Article reactions (Like / Dislike).
 *
 * GET  ?articleId=…   → { reaction, likeCount, dislikeCount } for this visitor
 * POST { articleId, reaction: "LIKE" | "DISLIKE" | "NONE" }
 *
 * Identity: logged-in customers react as `customer:<id>` (one reaction per
 * account); anonymous visitors get a signed httpOnly cookie id (one per
 * browser). Uniqueness is enforced by a DB unique index in the CMS; this route
 * adds rate limiting so the endpoint can't be hammered.
 */
import { NextRequest, NextResponse } from "next/server";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { getCurrentCustomer } from "@/backend/lib/customer";
import {
  VISITOR_COOKIE,
  mintVisitorToken,
  verifyVisitorToken,
} from "@/backend/lib/blog-visitor";
import { getReactionState, reactToArticle } from "@/backend/services/blog.service";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-f0-9]{24}$/i;

/**
 * Resolve the reacting identity. `established` is true only when the identity
 * did NOT have to be minted on this request — a logged-in customer or a
 * round-tripped signed cookie. Fresh mints must never COUNT a reaction
 * (a cookieless script would otherwise get a new identity per request and
 * inflate counters without bound); the client retries once with the cookie.
 */
async function resolveVisitor(
  req: NextRequest,
): Promise<{ visitorId: string; established: boolean; setCookie?: string }> {
  const customer = await getCurrentCustomer().catch(() => null);
  if (customer?.id) return { visitorId: `customer:${customer.id}`, established: true };
  const token = req.cookies.get(VISITOR_COOKIE)?.value;
  const existing = verifyVisitorToken(token);
  if (existing) return { visitorId: `anon:${existing}`, established: true };
  const fresh = mintVisitorToken();
  return { visitorId: `anon:${verifyVisitorToken(fresh)}`, established: false, setCookie: fresh };
}

function withVisitorCookie(res: NextResponse, setCookie?: string): NextResponse {
  if (setCookie) {
    res.cookies.set(VISITOR_COOKIE, setCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return res;
}

export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get("articleId") ?? "";
  if (!ID_RE.test(articleId)) {
    return NextResponse.json({ ok: false, error: "Invalid article" }, { status: 400 });
  }
  const rl = await limitRate(`blog-react-get:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }
  const { visitorId, setCookie } = await resolveVisitor(req);
  const state = await getReactionState(articleId, visitorId);
  if (!state) {
    return NextResponse.json({ ok: false, error: "Unavailable" }, { status: 503 });
  }
  return withVisitorCookie(NextResponse.json(state), setCookie);
}

export async function POST(req: NextRequest) {
  const rl = await limitRate(`blog-react:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests — please slow down." },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }
  let body: { articleId?: string; reaction?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const articleId = String(body.articleId ?? "");
  const reaction = String(body.reaction ?? "").toUpperCase() as "LIKE" | "DISLIKE" | "NONE";
  if (!ID_RE.test(articleId) || !["LIKE", "DISLIKE", "NONE"].includes(reaction)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { visitorId, established, setCookie } = await resolveVisitor(req);
  if (!established) {
    // First contact from this browser: issue the signed identity cookie but do
    // NOT count the reaction — the client retries once with the cookie set.
    return withVisitorCookie(
      NextResponse.json({ ok: false, retry: true, error: "Identity cookie issued — retry." }, { status: 428 }),
      setCookie,
    );
  }
  const result = await reactToArticle(articleId, visitorId, reaction);
  if (!result?.ok) {
    return NextResponse.json(
      { ok: false, error: "Could not save your reaction — please try again." },
      { status: 502 },
    );
  }
  return withVisitorCookie(NextResponse.json(result), setCookie);
}
