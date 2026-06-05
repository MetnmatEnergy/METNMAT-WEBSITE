/**
 * Backend environment config — the single place that reads process.env.
 * Add real values to apps/website/.env.local (never commit secrets).
 *
 * TODO(backend): fill these in when wiring MongoDB / external services.
 */
export const env = {
  // Database (MongoDB Atlas — single source of truth per the tech stack).
  mongoUri: process.env.MONGODB_URI ?? "",
  mongoDb: process.env.MONGODB_DB ?? "metnmat",

  // External services (add as needed): Razorpay, Brevo/Resend, etc.
  // razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",

  isProd: process.env.NODE_ENV === "production",
} as const;

/** Throws in production if a required env var is missing. */
export function assertEnv(keys: (keyof typeof env)[]) {
  for (const key of keys) {
    if (!env[key]) {
      const msg = `[backend] Missing required env: ${String(key)}`;
      if (env.isProd) throw new Error(msg);
      console.warn(msg + " (using empty fallback in dev)");
    }
  }
}
