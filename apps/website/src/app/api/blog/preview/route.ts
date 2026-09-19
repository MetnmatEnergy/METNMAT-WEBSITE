/**
 * Secure draft preview — the CMS admin's "Preview" button links here with a
 * short-lived HMAC token (see the dashboard's Posts.admin.preview). A valid
 * token enables Next.js draft mode (signed, httpOnly cookie) and redirects to
 * the article page, which then renders the draft version with a preview
 * banner. Drafts are never reachable through guessable public URLs.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/frontend/lib/public-origin";
import { draftMode } from "next/headers";
import { isUnusableSecret } from "@/backend/lib/placeholder-secret";

export const dynamic = "force-dynamic";

/**
 * Null when no usable secret is configured: an HMAC over an empty or
 * placeholder key is one anyone can compute, so the link must fail closed
 * (the shop preview already does this through previewTokenValid()).
 */
function expectedSig(slug: string, exp: string): string | null {
  const secret = [process.env.CMS_BLOG_KEY, process.env.INTERNAL_API_KEY].find((s) => !isUnusableSecret(s));
  if (!secret) return null;
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
  const expected = expectedSig(slug, exp);
  if (!expected) {
    return NextResponse.json({ error: "Preview is not configured." }, { status: 503 });
  }
  const want = Buffer.from(expected);
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    return NextResponse.json({ error: "Preview link is invalid or has expired." }, { status: 401 });
  }

  (await draftMode()).enable();
  // Not the request's own origin: behind Caddy that is the server's
  // 127.0.0.1:3100 and the browser was sent to localhost (frontend/lib/public-origin).
  return NextResponse.redirect(new URL(`/blog/${slug}`, publicOrigin(req.headers)));
}
