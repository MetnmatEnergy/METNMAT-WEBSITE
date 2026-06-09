/**
 * Transactional email for quote / customization requests.
 * Sends via Resend when RESEND_API_KEY is set; otherwise safely no-ops.
 *
 * The customer email goes to the address THEY entered in the form (input.email).
 * To deliver to any customer, metnmat.com must be verified at resend.com/domains
 * and QUOTE_FROM_EMAIL must use that domain (e.g. noreply@metnmat.com).
 */
type QuoteEmailInput = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  productName?: string;
  productSku?: string;
  design?: string;
  size?: string;
  material?: string;
  quantity?: string;
  attachmentNames?: string[];
};

/** A file to attach to the email. `content` is base64-encoded. */
export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function summaryTable(input: QuoteEmailInput): string {
  const rows: Array<[string, string | undefined]> = [
    ["Product", input.productName],
    ["Product code", input.productSku],
    ["Design / requirement", input.design],
    ["Size / dimensions", input.size],
    ["Material", input.material],
    ["Quantity", input.quantity],
    ["Attachments", input.attachmentNames?.length ? input.attachmentNames.join(", ") : undefined],
    ["Name", input.name],
    ["Mobile", input.phone],
    ["Email", input.email],
    ["Company", input.company],
  ];
  const cells = rows
    .filter(([, v]) => v && String(v).trim())
    .map(
      ([label, v], i) =>
        `<tr style="background:${i % 2 ? "#ffffff" : "#fafafa"}">
           <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#6b7280;width:42%;vertical-align:top;font-size:13px">${esc(label)}</td>
           <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#111827;font-size:14px">${esc(String(v))}</td>
         </tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #eee;border-radius:10px;overflow:hidden">${cells}</table>`;
}

/** Professional branded wrapper. */
function shell(opts: { heading: string; intro: string; body: string }): string {
  return `
  <div style="background:#f3f4f6;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:#0a0a0b;padding:22px 28px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle">
            <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:#d81f26;color:#fff;border-radius:8px;font-weight:800;font-size:18px">M</span>
          </td>
          <td style="vertical-align:middle;padding-left:12px">
            <span style="color:#fff;font-weight:700;font-size:16px;letter-spacing:.5px">METNMAT</span>
            <span style="color:#9ca3af;font-size:11px;display:block;letter-spacing:2px;text-transform:uppercase">Research &amp; Innovations</span>
          </td>
        </tr></table>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 10px;font-size:20px;color:#111827">${opts.heading}</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151">${opts.intro}</p>
        ${opts.body}
      </div>
      <div style="padding:18px 28px;background:#fafafa;border-top:1px solid #eee;color:#6b7280;font-size:12px;line-height:1.6">
        METNMAT Research &amp; Innovations · Howrah, West Bengal &amp; Sambalpur, Odisha, India<br/>
        contact@metnmat.com · +91 78726 86501<br/>
        This is an automated confirmation — you can simply reply to this email to reach our team.
      </div>
    </div>
  </div>`;
}

export async function sendQuoteEmails(
  input: QuoteEmailInput,
  attachments: EmailAttachment[] = []
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const from = process.env.QUOTE_FROM_EMAIL || "METNMAT <onboarding@resend.dev>";
  const notify = process.env.QUOTE_NOTIFY_EMAIL || "contact@metnmat.com";
  const table = summaryTable(input);
  const resendAttachments = attachments.map((a) => ({
    filename: a.filename,
    content: a.content,
  }));

  const customerHtml = shell({
    heading: `Thank you for your request, ${esc(input.name)}!`,
    intro:
      "We&rsquo;ve received your customization request and our team will review it and get back to you shortly. Here&rsquo;s a copy of the details you submitted, for your records:",
    body: `<h3 style="margin:0 0 8px;font-size:14px;color:#111827">Your customization request</h3>${table}`,
  });

  const notifyHtml = shell({
    heading: "New customization request",
    intro: "A customer submitted a customization request from the website.",
    body: table,
  });

  async function send(
    to: string,
    subject: string,
    html: string,
    replyTo: string
  ): Promise<boolean> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        reply_to: replyTo,
        ...(resendAttachments.length ? { attachments: resendAttachments } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[email] Resend ${res.status} sending to ${to}: ${detail}`);
    }
    return res.ok;
  }

  try {
    // Confirmation to the CUSTOMER — replying reaches our team (notify inbox).
    const toCustomer = await send(
      input.email,
      "Thank you for your request — METNMAT",
      customerHtml,
      notify
    );
    // Internal copy to the team — replying reaches the customer.
    await send(notify, `New customization request from ${input.name}`, notifyHtml, input.email);
    return toCustomer;
  } catch {
    return false;
  }
}
