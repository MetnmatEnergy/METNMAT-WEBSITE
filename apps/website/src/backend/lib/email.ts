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
        METNMAT Research &amp; Innovations · Howrah, West Bengal, India<br/>
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

// ── Order confirmation (Razorpay checkout) ───────────────────────────────────

type OrderEmailInput = {
  orderNumber: string;
  name: string;
  email: string;
  phone?: string;
  items: { productName: string; qty: number; lineTotal: number }[];
  subtotal: number;
  gstAmount: number;
  total: number;
  razorpayPaymentId: string;
  address?: string;
  /** International customers browsed in USD — show both currencies. */
  displayCurrency?: "INR" | "USD";
  usdRateAtPurchase?: number;
  totalUsdApprox?: number;
};

const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

function orderTable(input: OrderEmailInput): string {
  const itemRows = input.items
    .map(
      (it, i) =>
        `<tr style="background:${i % 2 ? "#ffffff" : "#fafafa"}">
           <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#111827;font-size:14px">${esc(it.productName)}</td>
           <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#6b7280;font-size:13px;text-align:center">× ${it.qty}</td>
           <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#111827;font-size:14px;text-align:right">${inr(it.lineTotal)}</td>
         </tr>`
    )
    .join("");
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #eee;border-radius:10px;overflow:hidden">
    ${itemRows}
    <tr><td colspan="2" style="padding:10px 14px;color:#6b7280;font-size:13px">Includes GST (18%)</td>
        <td style="padding:10px 14px;color:#6b7280;font-size:13px;text-align:right">${inr(input.gstAmount)}</td></tr>
    <tr style="background:#fafafa"><td colspan="2" style="padding:12px 14px;color:#111827;font-weight:700;font-size:14px;border-top:1px solid #eee">Total paid (incl. GST)</td>
        <td style="padding:12px 14px;color:#111827;font-weight:700;font-size:15px;text-align:right;border-top:1px solid #eee">${inr(input.total)}${
          input.displayCurrency === "USD" && input.totalUsdApprox
            ? `<br/><span style="font-weight:600;color:#6b7280;font-size:13px">≈ $${input.totalUsdApprox.toFixed(2)} USD</span>`
            : ""
        }</td></tr>
  </table>
  ${
    input.displayCurrency === "USD"
      ? `<p style="margin:12px 0 0;font-size:12px;color:#6b7280">International order — charged in INR; the USD amount is indicative at ₹${input.usdRateAtPurchase ?? "—"}/$. Your bank statement will show the INR charge converted at your bank's rate.</p>`
      : ""
  }
  <p style="margin:14px 0 0;font-size:13px;color:#6b7280">
    Order <strong>${esc(input.orderNumber)}</strong> · Payment ID ${esc(input.razorpayPaymentId)}
    ${input.address ? `<br/>Ships to: ${esc(input.address)}` : ""}
  </p>`;
}

/** Confirmation to the customer + internal copy to the team. */
export async function sendOrderEmails(input: OrderEmailInput): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.QUOTE_FROM_EMAIL || "METNMAT <onboarding@resend.dev>";
  const notify = process.env.QUOTE_NOTIFY_EMAIL || "contact@metnmat.com";
  const table = orderTable(input);
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supportUrl = `${site}/support?order=${encodeURIComponent(input.orderNumber)}`;
  const supportBlock = `
    <p style="margin:18px 0 0;font-size:13px;color:#6b7280">
      Need help with this order?
      <a href="${supportUrl}" style="color:#d81f26;font-weight:600;text-decoration:none">Raise a support ticket</a>
      and we&rsquo;ll get on it.
    </p>`;

  const customerHtml = shell({
    heading: `Order confirmed — thank you, ${esc(input.name)}!`,
    intro:
      "Your payment was received and your order is confirmed. We&rsquo;ll share dispatch details soon. A GST invoice will accompany your shipment.",
    body: table + supportBlock,
  });
  const notifyHtml = shell({
    heading: `New PAID order ${esc(input.orderNumber)}`,
    intro: `${esc(input.name)} (${esc(input.email)}${input.phone ? ", " + esc(input.phone) : ""}) placed a paid order on the website.`,
    body: table,
  });

  const send = async (to: string, subject: string, html: string, replyTo: string) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, reply_to: replyTo }),
    });
    if (!res.ok) console.warn(`[email] Resend ${res.status} sending order email to ${to}`);
    return res.ok;
  };

  try {
    const toCustomer = await send(
      input.email,
      `Order confirmed ${input.orderNumber} — METNMAT`,
      customerHtml,
      notify
    );
    await send(notify, `💰 New paid order ${input.orderNumber} (${inr(input.total)})`, notifyHtml, input.email);
    return toCustomer;
  } catch {
    return false;
  }
}

// ── Support tickets ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  "order-issue": "Order issue",
  "product-quality": "Product quality / damage",
  "shipping-delivery": "Shipping & delivery",
  "payment-billing": "Payment & billing",
  "technical-support": "Technical support",
  other: "Other",
};

type TicketEmailInput = {
  ticketNumber: string;
  name: string;
  email: string;
  subject: string;
  description: string;
  category: string;
  orderNumber?: string;
  statusUrl: string;
};

/** Ticket raised → confirmation to the customer + alert to the support inbox. */
export async function sendTicketEmails(input: TicketEmailInput): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.QUOTE_FROM_EMAIL || "METNMAT <onboarding@resend.dev>";
  const notify = process.env.QUOTE_NOTIFY_EMAIL || "contact@metnmat.com";

  const detail = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #eee;border-radius:10px;overflow:hidden">
      <tr style="background:#fafafa"><td style="padding:10px 14px;color:#6b7280;width:38%;font-size:13px">Ticket</td><td style="padding:10px 14px;color:#111827;font-weight:700;font-size:14px">${esc(input.ticketNumber)}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px">Subject</td><td style="padding:10px 14px;color:#111827;font-size:14px">${esc(input.subject)}</td></tr>
      <tr style="background:#fafafa"><td style="padding:10px 14px;color:#6b7280;font-size:13px">Category</td><td style="padding:10px 14px;color:#111827;font-size:14px">${esc(CATEGORY_LABELS[input.category] ?? input.category)}</td></tr>
      ${input.orderNumber ? `<tr><td style="padding:10px 14px;color:#6b7280;font-size:13px">Order</td><td style="padding:10px 14px;color:#111827;font-size:14px">${esc(input.orderNumber)}</td></tr>` : ""}
      <tr style="background:#fafafa"><td style="padding:10px 14px;color:#6b7280;font-size:13px;vertical-align:top">Details</td><td style="padding:10px 14px;color:#111827;font-size:14px;white-space:pre-wrap">${esc(input.description)}</td></tr>
    </table>`;

  const customerHtml = shell({
    heading: `We&rsquo;ve got your request, ${esc(input.name)}`,
    intro:
      "Thanks for reaching out. Your support ticket has been created and our team will get back to you shortly. You can track its progress any time using the button below.",
    body: `${detail}
      <div style="margin-top:18px"><a href="${esc(input.statusUrl)}" style="display:inline-block;background:#d81f26;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:600;font-size:14px">Track your ticket</a></div>`,
  });
  const notifyHtml = shell({
    heading: `New support ticket ${esc(input.ticketNumber)}`,
    intro: `${esc(input.name)} (${esc(input.email)}) raised a support ticket.`,
    body: detail,
  });

  const send = async (to: string, subject: string, html: string, replyTo: string) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, reply_to: replyTo }),
    });
    if (!res.ok) console.warn(`[email] Resend ${res.status} sending ticket email to ${to}`);
    return res.ok;
  };

  try {
    const toCustomer = await send(
      input.email,
      `Support ticket ${input.ticketNumber} received — METNMAT`,
      customerHtml,
      notify
    );
    await send(notify, `🎫 New ticket ${input.ticketNumber}: ${input.subject}`, notifyHtml, input.email);
    return toCustomer;
  } catch {
    return false;
  }
}

/** Staff replied on a ticket → email that reply to the customer. */
export async function sendTicketReplyEmail(input: {
  ticketNumber: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  authorName?: string;
  statusUrl: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.QUOTE_FROM_EMAIL || "METNMAT <onboarding@resend.dev>";
  const notify = process.env.QUOTE_NOTIFY_EMAIL || "contact@metnmat.com";

  const html = shell({
    heading: `Reply to your ticket ${esc(input.ticketNumber)}`,
    intro: `Our team${input.authorName ? ` (${esc(input.authorName)})` : ""} replied to your ticket "${esc(input.subject)}":`,
    body: `
      <div style="border-left:3px solid #d81f26;background:#fafafa;padding:14px 16px;border-radius:6px;color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(input.body)}</div>
      <div style="margin-top:18px"><a href="${esc(input.statusUrl)}" style="display:inline-block;background:#d81f26;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:600;font-size:14px">View &amp; reply</a></div>`,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: input.email,
        subject: `Re: [${input.ticketNumber}] ${input.subject} — METNMAT`,
        html,
        reply_to: notify,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
