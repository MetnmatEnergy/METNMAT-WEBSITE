import type { EmailAdapter } from "payload";

/**
 * Minimal Resend email adapter for Payload (no extra dependency — uses Resend's
 * HTTP API). Powers transactional admin emails like customer password resets.
 * If RESEND_API_KEY is unset, emails are logged to the console (dev-safe) so the
 * flow never crashes. NOTE: in Resend test mode, delivery is limited to the
 * account's verified address until the sending domain is verified.
 */
export const resendAdapter = (): EmailAdapter => {
  const apiKey = process.env.RESEND_API_KEY || "";
  const fromFull = process.env.EMAIL_FROM || "METNMAT <onboarding@resend.dev>";
  const fromAddress = fromFull.match(/<([^>]+)>/)?.[1] || fromFull;

  return () => ({
    name: "resend",
    defaultFromAddress: fromAddress,
    defaultFromName: "METNMAT",
    sendEmail: async (message) => {
      const toList = (Array.isArray(message.to) ? message.to : [message.to])
        .map((t) => (typeof t === "string" ? t : (t as { address?: string })?.address))
        .filter(Boolean);

      if (!apiKey) {
        console.warn(`[email] RESEND_API_KEY not set — would send "${message.subject}" to`, toList);
        return { skipped: true };
      }
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: (typeof message.from === "string" && message.from) || fromFull,
            to: toList,
            subject: message.subject || "",
            html: message.html ? String(message.html) : undefined,
            text: message.text ? String(message.text) : undefined,
          }),
        });
        if (!res.ok) {
          console.error("[email] Resend send failed:", res.status, (await res.text()).slice(0, 200));
        }
        return res.json().catch(() => ({}));
      } catch (e) {
        console.error("[email] Resend error:", e instanceof Error ? e.message : e);
        return { error: true };
      }
    },
  });
};
