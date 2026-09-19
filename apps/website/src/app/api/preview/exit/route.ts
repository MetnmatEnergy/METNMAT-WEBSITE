import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/frontend/lib/preview-exit";
import { publicOrigin } from "@/frontend/lib/public-origin";

export const dynamic = "force-dynamic";

/**
 * Leave draft mode.
 *
 * The CMS Preview button turns Next.js draft mode on for the whole BROWSER, not
 * just the tab it opens (it is a cookie). Until now nothing turned it off, so
 * staff kept seeing the red "Draft preview" banner on every product and
 * article they opened afterwards — including published ones — and read it as
 * "the site is showing my draft" (owner, 2026-09-19). The banner now links
 * here. Clears the bypass cookie and returns to the page it was on.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  (await draftMode()).disable();
  const to = safeReturnPath(req.nextUrl.searchParams.get("to"));
  return NextResponse.redirect(new URL(to, publicOrigin(req.headers)));
}
