/**
 * Secure draft preview — the CMS admin's "Preview" button links here with a
 * short-lived HMAC token (see the dashboard's Posts.admin.preview). A valid
 * token enables Next.js draft mode (signed, httpOnly cookie) and redirects to
 * the article page, which then renders the draft version with a preview
 * banner. Drafts are never reachable through guessable public URLs.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { draftMode } from "next/headers";

export const dynamic = "force-dynamic";

function expectedSig(slug: string, exp: string): string {
  const secret = process.env.CMS_BLOG_KEY || process.env.INTERNAL_API_KEY || "";
  return createHmac("sha256", secret).update(`${slug}.${exp}`).digest("hex");
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const exp = req.nextUrl.searchParams.get("exp") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";

  const expMs = Number(exp);
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || !Number.isFinite(expMs) || Date.now() > expMs) {
    return NextResponse.json({ error: "Preview link is invalid or has expired." }, { status: 401 });
  }
  const want = Buffer.from(expectedSig(slug, exp));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    return NextResponse.json({ error: "Preview link is invalid or has expired." }, { status: 401 });
  }

  (await draftMode()).enable();
  return NextResponse.redirect(new URL(`/blog/${slug}`, req.nextUrl.origin));
}
