import { isUnusableSecret } from "@/backend/lib/placeholder-secret";

/**
 * Form submission → the "Metnmat Research" WhatsApp group.
 *
 * The Command Center (MetnmatEnergy/Metnmat_Dashboard) owns the only linked
 * WhatsApp session, its whatsapp-web.js worker, and the group id. This side
 * only says what was submitted: POST /api/integrations/website/notify renders a
 * fixed template from these fields and queues it for the worker, the same queue
 * the Amazon order alerts use. No second session, no QR scan.
 *
 * NEVER IN THE WAY OF THE FORM. The email and the CMS record are what staff
 * work from; this is a nudge. Unset config, a CC that is down and a WhatsApp
 * session that is offline are all logged and swallowed, the call is bounded by a
 * timeout, and the routes never await it into their response.
 *
 * Off unless both COMMAND_CENTER_URL (deploy/v2/etc/web.conf) and
 * WEBSITE_ALERT_API_KEY (metnmat/web/env, same value as metnmat/cc/env) are set.
 */

export type FormAlertKind = "quote" | "contact" | "support" | "blog";

export type FormAlert = {
  kind: FormAlertKind;
  /** The submission's own reference (RFQ id, ticket number, BPR-…). */
  reference?: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  product?: string;
  subject?: string;
  category?: string;
  message?: string;
  attachments?: number;
};

const TIMEOUT_MS = 5_000;
let reportedOff = false;

export async function alertResearchGroup(alert: FormAlert): Promise<boolean> {
  const base = process.env.COMMAND_CENTER_URL?.trim().replace(/\/+$/, "");
  const key = process.env.WEBSITE_ALERT_API_KEY?.trim();
  if (!base || isUnusableSecret(key)) {
    if (!reportedOff) {
      reportedOff = true;
      console.info("[group-alert] off: COMMAND_CENTER_URL or WEBSITE_ALERT_API_KEY is not set");
    }
    return false;
  }

  // The CC sends one message per reference. A submission whose CMS save came
  // back without one still gets its alert, under a one-off id.
  const reference =
    alert.reference || `WEB-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

  try {
    const res = await fetch(`${base}/api/integrations/website/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...alert, reference }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) return true;
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    console.warn(
      `[group-alert] ${alert.kind} ${reference} not posted: HTTP ${res.status}${json?.error ? ` (${json.error})` : ""}`,
    );
  } catch (e) {
    console.warn(
      `[group-alert] ${alert.kind} ${reference} not posted: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return false;
}
