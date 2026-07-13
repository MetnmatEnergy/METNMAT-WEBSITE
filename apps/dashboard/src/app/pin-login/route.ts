import { getPayload } from "payload";
import config from "@payload-config";
import { derivePassword, PIN_REGEX, checkLock, recordFailure, recordSuccess } from "../../lib/pin";

export const dynamic = "force-dynamic";

/**
 * Trusted-proxy-aware client IP for the brute-force lock. The old leftmost
 * X-Forwarded-For read let an attacker rotate a fake header per request and
 * brute-force the 4-digit PIN into a staff session (audit finding). Prod
 * topology (verified 2026-07-13): Google external ALB appends
 * "<client-ip>, <lb-ip>", so strip OUR trusted hop(s) from the RIGHT and key on
 * the rightmost remaining token — attacker-supplied values sit further left and
 * are never reached. Mirrors clientIp() in the website's rate-limit.ts.
 */
const TRUSTED_PROXY_IPS = new Set(
  (process.env.TRUSTED_PROXY_IPS || "35.201.95.137")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
function lockKeyIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/^::ffff:/, ""))
      .filter(Boolean);
    while (parts.length > 1 && TRUSTED_PROXY_IPS.has(parts[parts.length - 1]!)) parts.pop();
    const ip = parts[parts.length - 1];
    if (ip) return ip;
  }
  return req.headers.get("x-real-ip") || "local";
}

/**
 * 4-digit PIN sign-in. Looks up the staff account by PIN and logs in through
 * Payload's own login() (so we get its JWT + httpOnly cookie), then sets the
 * `payload-token` cookie the admin UI reads. Brute-force throttled by IP.
 */
export async function POST(req: Request): Promise<Response> {
  const ip = lockKeyIp(req);

  const lock = checkLock(ip);
  if (lock.locked) {
    return Response.json(
      { error: `Too many attempts. Try again in ${lock.minutes} minute${lock.minutes === 1 ? "" : "s"}.` },
      { status: 429 }
    );
  }

  let pin = "";
  try {
    const body = (await req.json()) as { pin?: unknown };
    pin = String(body?.pin ?? "").trim();
  } catch {
    /* malformed body falls through to validation */
  }

  if (!PIN_REGEX.test(pin)) {
    recordFailure(ip);
    return Response.json({ error: "Enter your 4-digit key." }, { status: 400 });
  }

  const payload = await getPayload({ config });

  try {
    const found = await payload.find({
      collection: "users",
      where: { pin: { equals: pin } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const user = found.docs[0] as { email?: string } | undefined;

    if (!user?.email) {
      const after = recordFailure(ip);
      return Response.json(
        { error: after.locked ? `Locked for ${after.minutes} minutes.` : "Invalid key." },
        { status: 401 }
      );
    }

    const result = await payload.login({
      collection: "users",
      data: { email: String(user.email), password: derivePassword(pin) },
    });

    if (!result?.token) {
      recordFailure(ip);
      return Response.json({ error: "Invalid key." }, { status: 401 });
    }

    recordSuccess(ip);

    const nowSec = Math.floor(Date.now() / 1000);
    const maxAge = result.exp ? Math.max(60, result.exp - nowSec) : 7200;
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

    const res = Response.json({ success: true, redirect: "/admin" });
    res.headers.append(
      "Set-Cookie",
      `payload-token=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
    );
    return res;
  } catch {
    const after = recordFailure(ip);
    return Response.json(
      { error: after.locked ? `Locked for ${after.minutes} minutes.` : "Invalid key." },
      { status: 401 }
    );
  }
}
