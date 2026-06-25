import { NextResponse } from "next/server";
import { getCurrentCustomer, getCustomerOrder, type FullOrder } from "@/backend/lib/customer";
import { site } from "@/frontend/lib/site";

/**
 * GET /api/orders/[orderNumber]/invoice
 * A self-contained, printable Tax Invoice (its own HTML document, so none of the
 * site chrome prints). Owner-scoped: a customer can only fetch invoices for their
 * own paid orders. "Download" = the browser's Print → Save as PDF.
 *
 * Seller GSTIN/CIN are read from env (COMPANY_GSTIN / COMPANY_CIN) so the legal
 * identifiers aren't hardcoded; the lines are omitted when unset.
 */
export const dynamic = "force-dynamic";

const PAID_STATES = new Set(["paid", "shipped", "delivered"]);

const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v || 0);

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso?: string): string {
  return iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

function invoiceHtml(order: FullOrder): string {
  const gstin = process.env.COMPANY_GSTIN;
  const cin = process.env.COMPANY_CIN;
  const total = order.total || 0;
  const gst = order.gstAmount || 0;
  const taxable = Math.max(0, total - gst);
  const addr = [order.addressLine1, order.addressLine2, [order.city, order.state, order.pincode].filter(Boolean).join(", "), order.country]
    .filter(Boolean)
    .map((l) => esc(l))
    .join("<br/>");

  const rows = (order.items ?? [])
    .map(
      (it, i) => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;color:#6b7280;font-size:12px">${i + 1}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;color:#111827;font-size:13px">
          ${esc(it.productName)}${it.size ? ` · ${esc(it.size)}` : ""}${it.sku ? `<br/><span style="color:#9ca3af;font-size:11px">${esc(it.sku)}</span>` : ""}
        </td>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;color:#374151;font-size:13px;text-align:center">${esc(it.qty ?? 0)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;color:#111827;font-size:13px;text-align:right">${inr(it.lineTotal || 0)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Tax Invoice ${esc(order.orderNumber)} — METNMAT</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827}
  .sheet{max-width:760px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
  .bar{display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:760px;margin:0 auto;padding:0 8px 12px}
  .btn{background:#d81f26;color:#fff;border:0;border-radius:999px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
  .btn.secondary{background:#fff;color:#374151;border:1px solid #d1d5db}
  .head{background:#0a0a0b;color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  .logo{display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:#d81f26;color:#fff;border-radius:8px;font-weight:800;font-size:18px}
  .muted{color:#6b7280} .sm{font-size:12px} .xs{font-size:11px}
  .grid{display:flex;gap:24px;flex-wrap:wrap;padding:24px 28px}
  .col{flex:1;min-width:220px}
  h1{margin:0;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#fff}
  h2{margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6b7280}
  table{border-collapse:collapse;width:100%}
  .tot{margin-left:auto;width:280px}
  .tot td{padding:6px 12px;font-size:13px}
  @media print{ body{background:#fff} .sheet{border:0;border-radius:0;margin:0;max-width:none} .no-print{display:none!important} }
</style>
</head><body>
<div class="bar no-print">
  <a href="/account/orders/${encodeURIComponent(order.orderNumber || "")}" class="btn secondary">← Back to order</a>
  <button class="btn" onclick="window.print()">Print / Save as PDF</button>
</div>
<div class="sheet">
  <div class="head">
    <div>
      <table role="presentation"><tr>
        <td><span class="logo">M</span></td>
        <td style="padding-left:12px">
          <div style="font-weight:700;font-size:15px;letter-spacing:.5px">METNMAT</div>
          <div class="xs" style="color:#9ca3af;letter-spacing:2px;text-transform:uppercase">Innovations Private Limited</div>
        </td>
      </tr></table>
    </div>
    <h1>Tax Invoice</h1>
  </div>

  <div class="grid">
    <div class="col">
      <h2>Seller</h2>
      <div style="font-weight:600;font-size:13px">${esc(site.legalName)}</div>
      <div class="muted sm">${site.addresses[0].lines.map((l) => esc(l)).join("<br/>")}</div>
      <div class="muted sm">${esc(site.contact.email)} · ${esc(site.contact.phone)}</div>
      ${gstin ? `<div class="muted sm">GSTIN: ${esc(gstin)}</div>` : ""}
      ${cin ? `<div class="muted xs">CIN: ${esc(cin)}</div>` : ""}
    </div>
    <div class="col">
      <h2>Bill to</h2>
      <div style="font-weight:600;font-size:13px">${esc(order.name)}</div>
      <div class="muted sm">${addr || "—"}</div>
      ${order.phone ? `<div class="muted sm">${esc(order.phone)}</div>` : ""}
      ${order.email ? `<div class="muted sm">${esc(order.email)}</div>` : ""}
      ${order.gstin ? `<div class="muted sm">GSTIN: ${esc(order.gstin)}</div>` : ""}
    </div>
    <div class="col" style="min-width:180px">
      <h2>Invoice</h2>
      <div class="sm"><span class="muted">No.</span> <strong>${esc(order.orderNumber)}</strong></div>
      <div class="sm"><span class="muted">Date:</span> ${fmtDate(order.paidAt || order.createdAt)}</div>
      ${order.razorpayPaymentId ? `<div class="sm muted">Payment ref: ${esc(order.razorpayPaymentId)}</div>` : ""}
      <div class="sm muted">Paid via Razorpay (INR)</div>
    </div>
  </div>

  <div style="padding:0 28px 8px">
    <table>
      <thead><tr style="background:#fafafa">
        <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">#</th>
        <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Description</th>
        <th style="padding:9px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Qty</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="padding:8px 28px 24px">
    <table class="tot">
      <tr><td class="muted">Taxable value</td><td style="text-align:right">${inr(taxable)}</td></tr>
      <tr><td class="muted">GST (18%)</td><td style="text-align:right">${inr(gst)}</td></tr>
      <tr><td style="font-weight:700;border-top:2px solid #111;padding-top:10px">Grand total (incl. GST)</td>
          <td style="font-weight:700;text-align:right;border-top:2px solid #111;padding-top:10px">${inr(total)}</td></tr>
    </table>
  </div>

  <div style="padding:16px 28px;background:#fafafa;border-top:1px solid #eee" class="muted xs">
    All amounts in INR, inclusive of GST. This is a computer-generated tax invoice and does not require a signature.<br/>
    Questions? ${esc(site.contact.email)} · ${esc(site.contact.phone)} · ${esc(site.url)}
  </div>
</div>
</body></html>`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
): Promise<Response> {
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw);

  const customer = await getCurrentCustomer();
  if (!customer?.email) {
    return NextResponse.redirect(
      new URL(`/login?redirect=/account/orders/${encodeURIComponent(orderNumber)}`, req.url)
    );
  }

  // Owner-scoped: only the customer's own order resolves.
  const order = await getCustomerOrder(customer.email, orderNumber);
  if (!order) {
    return new NextResponse("Invoice not found.", { status: 404 });
  }
  if (!PAID_STATES.has((order.status || "").toLowerCase())) {
    return new NextResponse("An invoice is available once the order is paid.", { status: 409 });
  }

  return new NextResponse(invoiceHtml(order), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
