import { getPayload } from "payload";
import config from "@payload-config";
import { derivePassword, PIN_REGEX } from "../../lib/pin";
import {
  countAttempt,
  clearAttempts,
  isOverBudget,
  ipKey,
  GLOBAL_KEY,
  THROTTLE_WINDOW_MINUTES,
} from "../../lib/pin-throttle";

export const dynamic = "force-dynamic";

/**
 * Trusted-proxy-aware client IP for the brute-force lock. The old leftmost
 * X-Forwarded-For read let an attacker rotate a fake header per request and
 * brute-force the 4-digit PIN into a staff session (audit finding). Prod
 * topology (AWS, 2026-08-20): Caddy appends the connecting peer to
 * X-Forwarded-For, so strip OUR trusted hop(s) from the RIGHT and key on the
 * rightmost remaining token — attacker-supplied values sit further left and are
 * never reached. Mirrors clientIp() in the website's rate-limit.ts.
 */
const TRUSTED_PROXY_IPS = new Set(
  (process.env.TRUSTED_PROXY_IPS || "")
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
  const payload = await getPayload({ config });

  /*
   * Charge the attempt BEFORE any credential work.
   *
   * The previous guard checked an in-process counter here and only wrote to it
   * three awaits later. Node interleaves at every await, so a concurrent burst
   * from one address all passed the check before any of them recorded a
   * failure: the real budget was the attacker's in-flight concurrency, not 5.
   * Increment-then-test in one atomic operation has no window to race.
   *
   * The global budget is charged too. It is the only ceiling here that rotating
   * source addresses cannot spend around, and PIN sign-in has no legitimate
   * high-volume caller.
   */
  const [ipFails, globalFails] = await Promise.all([
    countAttempt(payload, ipKey(ip)),
    countAttempt(payload, GLOBAL_KEY),
  ]);
  if (isOverBudget(ipFails, globalFails)) {
    return Response.json(
      { error: `Too many attempts. Try again in ${THROTTLE_WINDOW_MINUTES} minutes.` },
      { status: 429, headers: { "Retry-After": "900" } }
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
    return Response.json({ error: "Enter your 4-digit key." }, { status: 400 });
  }

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
      // The attempt was already charged up front. The message stays identical
      // to every other failure so a wrong PIN cannot be told apart from a
      // wrong-but-existing one.
      return Response.json({ error: "Invalid key." }, { status: 401 });
    }

    const result = await payload.login({
      collection: "users",
      data: { email: String(user.email), password: derivePassword(pin) },
    });

    if (!result?.token) {
      return Response.json({ error: "Invalid key." }, { status: 401 });
    }

    // Clear this address's budget, never the global one: a correct guess must
    // not refund an attacker the attempts it took to find it.
    await clearAttempts(payload, ipKey(ip));

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
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }
}
