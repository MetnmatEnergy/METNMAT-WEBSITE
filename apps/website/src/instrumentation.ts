/**
 * Runtime fail-fast (SEC-04). Next.js calls register() once when the server
 * boots. Triple-guarded so it NEVER runs during `next build` (which has no
 * runtime secrets) or on the edge runtime — only when the Node server is
 * actually starting in production. Mirrors the dashboard's onInit assertion.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  if (!process.env.INTERNAL_API_KEY) missing.push("INTERNAL_API_KEY");
  if (!process.env.NEXT_PUBLIC_CMS_URL) missing.push("NEXT_PUBLIC_CMS_URL");
  if (missing.length) {
    throw new Error(`[website] Refusing to start — missing required production env: ${missing.join(", ")}`);
  }
}
