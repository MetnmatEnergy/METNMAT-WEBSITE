import { NextResponse } from "next/server";
import { getCustomerToken, patchCurrentCustomer } from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { sanitizeAvatar } from "@/frontend/lib/avatar-presets";

export const dynamic = "force-dynamic";

/**
 * Update ONLY the profile picture — a partial patch, so changing the avatar never
 * touches name/phone/company/etc. Lets the avatar be set instantly from the
 * picker modal, independent of the profile form's Save.
 */
export async function POST(req: Request): Promise<Response> {
  const rl = await limitRate(`avatar:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many updates — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
    );
  }
  if (!(await getCustomerToken())) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  let body: { avatar?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // "" clears the picture; an emoji-preset/data-URI is stored; anything else 400s.
  const avatar = sanitizeAvatar(body?.avatar);
  if (avatar === null) {
    return NextResponse.json({ error: "That picture couldn't be used." }, { status: 400 });
  }

  const updated = await patchCurrentCustomer({ avatar });
  if (!updated) {
    return NextResponse.json(
      { error: "Couldn't update your picture right now. Please try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({ success: true, avatar });
}
