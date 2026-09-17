import { createHmac, timingSafeEqual } from "crypto";
import { limitRate } from "@/backend/lib/rate-limit";
import { isUnusableSecret } from "@/backend/lib/placeholder-secret";
import { emailSyntaxOk, emailDomain, emailLimitKey } from "@/backend/lib/email-address";
import { mailDomainVerdict, type MailDomainVerdict } from "@/backend/lib/email-mx";

/**
 * Bot and abuse checks for the public quote / customization form.
 *
 * WHAT WENT WRONG
 * Every submission sent two emails: a "Thank you for your request" to whatever
 * address was typed into the form, and a notification to the sales inbox. On
 * 2026-09-03/04 the Resend log filled with submissions under names like
 * "fbdfbdf" to addresses like "FS@JFOWI.COM". Each one bounced, and each bounce
 * counted against the metnmat.com sending reputation — and because the reply
 * echoes the submitted text back to any address, the form was usable as a mail
 * relay by anyone who cared to.
 *
 * WHAT THIS ADDS, IN LAYERS
 *  1. A bot check on the submission itself. The honeypot lives in the validator;
 *     this module adds Cloudflare Turnstile when a secret is configured, and a
 *     signed timing token when it is not. Failing either is a rejection.
 *  2. A sanity check on the visitor's address — strict syntax, then whether the
 *     domain can receive mail at all. Failing it does not reject the enquiry
 *     (a real lead with a typo is still a lead), but it does withhold the
 *     auto-reply and tags the sales notification as possible spam.
 *  3. A budget on the auto-reply: two per address per day, five per IP per
 *     hour. Beyond that the enquiry is still filed and the team still told;
 *     only the outbound copy to the visitor stops.
 *
 * None of this touches whether the enquiry is filed. The failure mode being
 * designed against is a lost lead, so every check short of "this is a bot"
 * degrades to "send less mail", never to "drop the request".
 */

// ── Signed timing token ──────────────────────────────────────────────────────
//
// The client fetches a token when the form is shown and sends it back with the
// submission. Verifying it proves two things a scripted POST usually cannot:
// the caller made the GET first, and at least MIN_AGE elapsed between the two.
// A person needs longer than three seconds to type a requirement, a name, a
// number and an address; a script that posts the moment it has the token does
// not. This is the fallback layer — Turnstile, when configured, replaces it.

/** Shorter than any human fill of this form. */
export const FORM_TOKEN_MIN_AGE_MS = 3_000;
/** Long enough for a tab left open over a working day. */
export const FORM_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** `<13-digit ms>.<32-char mac>` — anything longer is not ours. */
const MAX_FORM_TOKEN_LENGTH = 64;

/**
 * The same secret the attachment grant is signed with, under a different HMAC
 * domain so the two token families can never be swapped for each other. No dev
 * fallback constant: without a secret the check is simply off, which is the
 * honest state rather than one that a value in the repository could satisfy.
 */
const formTokenSecret = (): string =>
  process.env.ATTACHMENT_SIGNING_SECRET || process.env.INTERNAL_API_KEY || "";

/** Whether submissions are expected to carry a timing token. */
export const formTokenEnabled = (): boolean => Boolean(formTokenSecret());

const signFormToken = (iat: string, key: string): string =>
  createHmac("sha256", key).update(`form-token.${iat}`).digest("base64url").slice(0, 32);

/** A fresh token stamped `now`, or null when no secret is configured. */
export function mintFormToken(now: number = Date.now()): string | null {
  const key = formTokenSecret();
  if (!key) return null;
  const iat = String(now);
  return `${iat}.${signFormToken(iat, key)}`;
}

export type FormTokenVerdict =
  | { ok: true; ageMs: number }
  | { ok: false; reason: "missing" | "malformed" | "forged" | "expired" | "too_fast" };

/**
 * Check a submitted token. With no secret configured there is nothing to check
 * against and every token passes — callers gate on `formTokenEnabled()`.
 */
export function verifyFormToken(token: unknown, now: number = Date.now()): FormTokenVerdict {
  const key = formTokenSecret();
  if (!key) return { ok: true, ageMs: 0 };
  if (typeof token !== "string" || token.length === 0) return { ok: false, reason: "missing" };
  if (token.length > MAX_FORM_TOKEN_LENGTH) return { ok: false, reason: "malformed" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [iat, mac] = parts as [string, string];
  if (!/^\d{10,16}$/.test(iat)) return { ok: false, reason: "malformed" };

  const want = Buffer.from(signFormToken(iat, key));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    return { ok: false, reason: "forged" };
  }

  const ageMs = now - Number(iat);
  if (ageMs > FORM_TOKEN_TTL_MS) return { ok: false, reason: "expired" };
  if (ageMs < FORM_TOKEN_MIN_AGE_MS) return { ok: false, reason: "too_fast" };
  return { ok: true, ageMs };
}

// ── Cloudflare Turnstile ─────────────────────────────────────────────────────

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 5_000;
/** Cloudflare's documented maximum token length. */
const MAX_TURNSTILE_TOKEN_LENGTH = 2_048;

/** True when a usable secret is configured, i.e. submissions must carry a token. */
export const turnstileConfigured = (): boolean =>
  !isUnusableSecret(process.env.TURNSTILE_SECRET_KEY);

export type TurnstileVerdict =
  | { ok: true }
  | { ok: false; reason: "missing" | "failed" | "unavailable" };

/**
 * Ask Cloudflare whether a widget token is genuine.
 *
 * "unavailable" is kept apart from "failed" on purpose. A Cloudflare outage, a
 * timeout, or OUR misconfiguration (a wrong secret) must not lock every
 * customer out of the form; the caller treats it as a suspicious-but-accepted
 * submission. A token Cloudflare actually looked at and refused is a failure.
 */
export async function verifyTurnstile(token: unknown, ip?: string): Promise<TurnstileVerdict> {
  if (typeof token !== "string" || token.length === 0) return { ok: false, reason: "missing" };
  if (token.length > MAX_TURNSTILE_TOKEN_LENGTH) return { ok: false, reason: "failed" };
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        ...(ip && ip !== "unknown" ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[form-guard] Turnstile siteverify HTTP ${res.status}`);
      return { ok: false, reason: "unavailable" };
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true };

    const codes = data["error-codes"] ?? [];
    // These describe our side, not the visitor's. Names only — never the secret.
    if (
      codes.some(
        (c) =>
          c === "invalid-input-secret" || c === "missing-input-secret" || c === "internal-error"
      )
    ) {
      console.error(
        `[form-guard] Turnstile rejected OUR request (${codes.join(", ")}) — check TURNSTILE_SECRET_KEY`
      );
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "failed" };
  } catch (e) {
    console.warn("[form-guard] Turnstile siteverify unreachable:", (e as Error).message);
    return { ok: false, reason: "unavailable" };
  }
}

// ── Screening ────────────────────────────────────────────────────────────────

export type ScreenVerdict =
  /** Nothing about the submission suggests automation. */
  | { verdict: "pass" }
  /** Accept it, but withhold the auto-reply and say why to the team. */
  | { verdict: "suspect"; reasons: string[] }
  /** Refuse it. `error` is safe to show the visitor; `reason` is for the log. */
  | { verdict: "reject"; reason: string; error: string };

/**
 * The bot check proper. Turnstile when configured; the timing token otherwise;
 * nothing when neither is set up (local dev with no secrets at all).
 *
 * The honeypot is not here: the validator rejects a filled honeypot before any
 * of this runs, so that a bot never gets as far as a Cloudflare round-trip.
 */
export async function screenSubmission(
  body: Record<string, unknown>,
  ip: string
): Promise<ScreenVerdict> {
  if (turnstileConfigured()) {
    const t = await verifyTurnstile(body.turnstileToken, ip);
    if (t.ok) return { verdict: "pass" };
    if (t.reason === "unavailable")
      return { verdict: "suspect", reasons: ["turnstile-unavailable"] };
    return {
      verdict: "reject",
      reason: `turnstile-${t.reason}`,
      error:
        "We couldn't confirm this wasn't an automated submission. Please refresh the page and try again.",
    };
  }

  if (formTokenEnabled()) {
    const v = verifyFormToken(body.formToken);
    if (v.ok) return { verdict: "pass" };
    if (v.reason === "too_fast") {
      return {
        verdict: "reject",
        reason: "form-token-too_fast",
        error: "That was quick! Please take a moment to check your details, then submit again.",
      };
    }
    return {
      verdict: "reject",
      reason: `form-token-${v.reason}`,
      error: "This form has expired. Please refresh the page and try again.",
    };
  }

  return { verdict: "pass" };
}

// ── Address sanity ───────────────────────────────────────────────────────────

export type EmailSanity = {
  syntax: boolean;
  domain: MailDomainVerdict;
  /** Empty when the address looks deliverable. */
  reasons: string[];
};

/**
 * Strict syntax, then DNS. A syntax failure short-circuits: there is no domain
 * worth asking about. "unknown" from DNS is not a reason — see email-mx.ts.
 */
export async function checkEmailSanity(email: string): Promise<EmailSanity> {
  if (!emailSyntaxOk(email)) return { syntax: false, domain: "unknown", reasons: ["email-syntax"] };
  const domain = emailDomain(email);
  if (!domain) return { syntax: false, domain: "unknown", reasons: ["email-syntax"] };
  const verdict = await mailDomainVerdict(domain);
  return {
    syntax: true,
    domain: verdict,
    reasons: verdict === "rejects" ? ["email-domain-no-mail"] : [],
  };
}

// ── Auto-reply budget ────────────────────────────────────────────────────────

/** "Thank you" copies one address may receive per day. */
export const AUTO_REPLY_PER_ADDRESS = 2;
export const AUTO_REPLY_ADDRESS_WINDOW_MS = 24 * 60 * 60 * 1000;
/** "Thank you" copies one client IP may trigger per hour. */
export const AUTO_REPLY_PER_IP = 5;
export const AUTO_REPLY_IP_WINDOW_MS = 60 * 60 * 1000;

export type AutoReplyBudget = { ok: true } | { ok: false; exceeded: "address" | "ip" };

/**
 * Spend one unit of auto-reply budget for this address and this IP.
 *
 * Counted on the shared limiter, so it holds across instances when Upstash is
 * configured and degrades to per-process otherwise, exactly like every other
 * limit on the site. Call it only when the reply is actually about to be sent:
 * a suspect submission never reaches here, so it never spends a real
 * customer's allowance.
 *
 * The address bucket is checked first so that a single address hammering the
 * form spends its own allowance before it touches the shared per-IP one — a
 * NAT'd office should not lose its auto-replies to one colleague's retries.
 */
export async function autoReplyBudget(email: string, ip: string): Promise<AutoReplyBudget> {
  const addr = await limitRate(
    `quote-reply:addr:${emailLimitKey(email)}`,
    AUTO_REPLY_PER_ADDRESS,
    AUTO_REPLY_ADDRESS_WINDOW_MS
  );
  if (!addr.ok) return { ok: false, exceeded: "address" };

  // "unknown" means no forwarding header at all, which behind Caddy never
  // happens; if it did, every visitor would share one bucket, so skip it.
  if (ip && ip !== "unknown") {
    const perIp = await limitRate(
      `quote-reply:ip:${ip}`,
      AUTO_REPLY_PER_IP,
      AUTO_REPLY_IP_WINDOW_MS
    );
    if (!perIp.ok) return { ok: false, exceeded: "ip" };
  }
  return { ok: true };
}
