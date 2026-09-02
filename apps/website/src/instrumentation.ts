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
      // Both were absent from this list, which is exactly how they went missing
      // in the GCP→EC2 move without anyone noticing. Their fallbacks are not
      // safe defaults: an unset QUOTE_FROM_EMAIL sends as Resend's SANDBOX
      // address, which only delivers to the Resend account owner — so every
      // customer confirmation silently fails to arrive — and an unset
      // QUOTE_NOTIFY_EMAIL quietly moves the sales inbox.
      "QUOTE_FROM_EMAIL",
      "QUOTE_NOTIFY_EMAIL",
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
        // The remediation used to name ECS and tell the operator to redeploy.
        // That infrastructure was deleted at the AWS cutover, so it sent whoever
        // read it to a console page that no longer exists and to a rebuild that
        // would not have helped. Secrets are fetched by deploy/bin/with-secrets.sh
        // at PROCESS START, so the fix is a reload, not a build.
        `Populate them in AWS Secrets Manager under metnmat/prod/<NAME> (region ap-south-1, ` +
        `plaintext secrets, no surrounding quotes), then run the reload-app.yml workflow for ` +
        `this app. Secrets are read at process start, so a rebuild is neither needed nor sufficient.`,
    );
  }
}
