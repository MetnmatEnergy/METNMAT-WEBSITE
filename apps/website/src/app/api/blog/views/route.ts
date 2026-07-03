/**
 * Privacy-conscious article view counting.
 * POST { articleId } — counts at most one view per browser per article per day
 * (compact httpOnly cookie; no IPs stored), rate-limited per IP against abuse.
 * Admin previews never hit this route (the preview page omits the tracker).
 */
import { NextRequest, NextResponse } from "next/server";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { VIEWED_COOKIE, registerView } from "@/backend/lib/blog-visitor";
import { trackArticleView } from "@/backend/services/blog.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await limitRate(`blog-view:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: true }); // silently drop — never error a page over analytics

  let body: { articleId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const articleId = String(body.articleId ?? "");
  if (!/^[a-f0-9]{24}$/i.test(articleId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const updatedCookie = registerView(req.cookies.get(VIEWED_COOKIE)?.value, articleId);
  if (updatedCookie === null) return NextResponse.json({ ok: true, counted: false });

  const counted = await trackArticleView(articleId);
  const res = NextResponse.json({ ok: true, counted });
  // Only mark the article as "viewed" when the CMS actually recorded it — a
  // transient CMS failure must not permanently swallow this visitor's view.
  if (counted) {
    res.cookies.set(VIEWED_COOKIE, updatedCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/", // must cover /api/blog/views — a narrower path would never be sent back
    });
  }
  return res;
}
