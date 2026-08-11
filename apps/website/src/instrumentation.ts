/**
 * Runtime fail-fast (SEC-04). Next.js calls register() once when the server
 * boots. Triple-guarded so it NEVER runs during `next build` (which has no
 * runtime secrets) or on the edge runtime — only when the Node server is
 * actually starting in production. Mirrors the dashboard's onInit assertion.
 */

// Imported from placeholder-secret.ts, NOT internal-key.ts: this file is also
// compiled for the edge runtime, and internal-key.ts imports node's `crypto`,
// which does not resolve there. That import broke the build once already.
import { PLACEHOLDER_SECRET, isUnusableSecret } from "@/backend/lib/placeholder-secret";

/**
 * A placeholder secret is treated as MISSING, not as a value.
 *
 * INTERNAL_API_KEY still set to the Terraform placeholder would authenticate any
 * caller who has read this repository, and PAYLOAD_SECRET holding it would let
 * admin session JWTs be forged. An unset secret fails closed; this one fails
 * open, so it is the more dangerous of the two states. See internal-key.ts.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  if (isUnusableSecret(process.env.INTERNAL_API_KEY)) missing.push("INTERNAL_API_KEY");
  if (!process.env.NEXT_PUBLIC_CMS_URL) missing.push("NEXT_PUBLIC_CMS_URL");
  if (missing.length) {
    throw new Error(
      `[website] Refusing to start — missing or placeholder required production env: ${missing.join(", ")}. ` +
        `A secret still set to ${PLACEHOLDER_SECRET} is a publicly-known value, not a configured one.`,
    );
  }

  // Not fatal, but must never pass silently: these degrade behaviour rather than
  // break startup, and every one of them failed quietly during the AWS bring-up.
  // Names only — a value is never logged.
  const degraded = (
    [
      "RESEND_API_KEY",
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
      "CMS_OAUTH_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "OPEN_EXCHANGE_RATES_APP_ID",
      "UPSTASH_REDIS_REST_TOKEN",
      "ANALYTICS_GEO_TOKEN",
    ] as const
  ).filter((k) => isUnusableSecret(process.env[k]));

  if (degraded.length) {
    console.error(
      `[website] ${degraded.length} secret(s) are unset or still ${PLACEHOLDER_SECRET}: ${degraded.join(", ")}. ` +
        `Affected features fail silently — payments, transactional email, Google sign-in and rate limiting. ` +
        `Populate them in AWS Secrets Manager under metnmat/prod/<NAME>, then redeploy: ECS resolves secrets ` +
        `only at task start, so updating a secret does NOT affect a running task.`,
    );
  }
}
