/**
 * Secure product draft preview — the CMS admin's Preview button links here with
 * a short-lived HMAC token (apps/dashboard/src/lib/preview-link.ts). A valid
 * token enables Next.js draft mode (signed, httpOnly cookie) and redirects to
 * the product page, which then renders the DRAFT version behind a preview
 * banner. Drafts stay unreachable through guessable public URLs.
 *
 * Mirrors /api/blog/preview. /api/ is already Disallow-ed in robots.ts.
 *
 * KNOWN PROPERTY, not a bug but worth knowing before you forward a link. Next.js
 * draft mode is a per-browser SWITCH, not a per-document grant: once a valid
 * token turns it on, that browser renders the draft of any product it visits,
 * and the cookie outlives the one-hour token. So a preview link forwarded
 * outside the company is a draft pass for the whole catalogue until that person
 * clears their cookies. The blog has behaved this way since it shipped, and
 * matching it was the deliberate choice here — scoping a draft grant to a single
 * slug needs a companion cookie the page checks, which is a change worth making
 * for both or neither.
 */
import { NextRequest, NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { previewTokenValid } from "@/backend/lib/preview-token";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const exp = req.nextUrl.searchParams.get("exp") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";

  const secret = process.env.CMS_PREVIEW_KEY || process.env.INTERNAL_API_KEY;
  if (!previewTokenValid({ slug, exp, sig, secret })) {
    return NextResponse.json({ error: "Preview link is invalid or has expired." }, { status: 401 });
  }

  (await draftMode()).enable();
  return NextResponse.redirect(new URL(`/shop/p/${slug}`, req.nextUrl.origin));
}
