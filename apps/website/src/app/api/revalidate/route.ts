import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { verifyKey } from "@/backend/lib/internal-key";

/**
 * On-demand revalidation, called by the dashboard (Payload afterChange hooks)
 * whenever staff save content. Purges every "cms"-tagged fetch so edits show
 * up on the next request instead of waiting out the 60s ISR window.
 * Protected by the shared INTERNAL_API_KEY (same trust model as enquiry reads).
 */
export async function POST(req: Request) {
  if (!verifyKey(req, "CMS_REVALIDATE_KEY")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  revalidateTag("cms");
  return NextResponse.json({ ok: true, revalidated: "cms" });
}
