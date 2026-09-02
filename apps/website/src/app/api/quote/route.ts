import { NextResponse } from "next/server";
import { validateEnquiry } from "@/backend/validation";
import {
  createEnquiry,
  uploadEnquiryFiles,
  fetchEnquiryFileBase64,
  type ParsedFile,
} from "@/backend/services/enquiries.service";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { sendQuoteEmails, type EmailAttachment } from "@/backend/lib/email";
import { isAllowedUploadSignature, safeFilename } from "@/backend/lib/file-signature";
import { collectGrantedIds } from "@/backend/lib/attachment-grant";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB each
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB total
const ALLOWED = /^(application\/pdf|image\/)/;

/**
 * Parse the request body. Supports BOTH:
 *  - multipart/form-data (when the customer attaches files / camera photos)
 *  - application/json (backward-compatible)
 * Files are returned as raw buffers so they can be BOTH uploaded to the
 * dashboard and attached (base64) to the confirmation email.
 */
async function parseBody(request: Request): Promise<{
  body: Record<string, unknown>;
  files: ParsedFile[];
}> {
  const ct = request.headers.get("content-type") || "";

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const body: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === "string" && k !== "files") body[k] = v;
    }
    if (typeof body.product === "string") {
      try {
        body.product = JSON.parse(body.product as string);
      } catch {
        body.product = null;
      }
    }

    const files: ParsedFile[] = [];
    let total = 0;
    for (const file of form.getAll("files")) {
      if (!(file instanceof File) || file.size === 0) continue;
      if (files.length >= MAX_FILES) break;
      if (file.size > MAX_FILE_BYTES) continue;
      if (!ALLOWED.test(file.type || "")) continue;
      total += file.size;
      if (total > MAX_TOTAL_BYTES) break;
      // Same content-based hardening as /api/quote/upload: verify the REAL bytes
      // (reject spoofed MIME) and sanitize the filename — don't trust file.type/name.
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!isAllowedUploadSignature(buffer)) continue;
      files.push({
        filename: safeFilename(file.name),
        contentType: file.type || "application/octet-stream",
        buffer,
      });
    }
    return { body, files };
  }

  const json = await request.json().catch(() => null);
  return { body: (json ?? {}) as Record<string, unknown>, files: [] };
}

// POST /api/quote — submit a quote request (with optional file attachments).
export async function POST(request: Request) {
  const rl = await limitRate(`quote:${clientIp(request)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const { body: b, files } = await parseBody(request);
  const result = validateEnquiry(b, "quote");

  if (!result.success) {
    return NextResponse.json({ ok: false, fields: result.fields }, { status: 400 });
  }

  // product may arrive as an object (JSON) or already-parsed (multipart).
  const rawP = b.product;
  const p = (typeof rawP === "object" && rawP ? rawP : {}) as {
    name?: string;
    sku?: string;
    slug?: string;
  };
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : undefined);

  // Files already uploaded live (the new form flow) arrive as SIGNED GRANTS.
  //
  // A bare id is not accepted and `b.attachmentIds` is deliberately not read.
  // These ids address private customer files, and the readback below runs with
  // the internal key, so trusting the body here let anyone have anyone else's
  // attachment mailed to an address of their choosing. The grant is minted by
  // /api/quote/upload and handed only to the uploader.
  const granted = collectGrantedIds(b.attachmentGrants, MAX_FILES);
  const preUploadedIds = granted.ids;
  if (granted.rejected > 0) {
    console.warn(`[quote] rejected ${granted.rejected} unverified attachment reference(s)`);
  }
  const bodyNames = Array.isArray(b.attachmentNames)
    ? (b.attachmentNames as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  // Fallback: raw multipart files (no-JS / legacy) — store them now.
  const storedFromMultipart = files.length ? await uploadEnquiryFiles(files, "quote") : [];

  const attachmentIds = [...preUploadedIds, ...storedFromMultipart.map((u) => u.id)];
  const attachmentNames = [...bodyNames, ...files.map((f) => f.filename)];

  // Build email attachments: multipart files directly (base64) + readback of the
  // granted ids. Concurrent rather than sequential — the list is capped at
  // MAX_FILES, and serialising two CMS round-trips per attachment put that
  // latency on the customer's submit.
  const emailAttachments: EmailAttachment[] = files.map((f) => ({
    filename: f.filename,
    content: f.buffer.toString("base64"),
    contentType: f.contentType,
  }));
  const readBack = await Promise.all(preUploadedIds.map((id) => fetchEnquiryFileBase64(id)));
  for (const att of readBack) if (att) emailAttachments.push(att);

  const enquiry = {
    ...result.data,
    productName: p?.name,
    productSku: p?.sku,
    productSlug: p?.slug,
    design: str("design"),
    size: str("size"),
    material: str("material"),
    quantity: str("quantity"),
    attachmentNames,
    attachmentIds,
  };

  // Save the enquiry, linking the uploaded files, then email everyone.
  const saved = await createEnquiry(enquiry);
  const emailed = await sendQuoteEmails(enquiry, emailAttachments);
  // If BOTH the CMS save and the email failed, the RFQ is lost — don't return
  // success (the client branches only on res.ok). Surface an error so the
  // customer can retry instead of believing the request was received.
  if (!saved && !emailed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "We couldn't submit your request right now. Please try again, or email us directly at contact@metnmat.com.",
      },
      { status: 502 }
    );
  }
  return NextResponse.json(
    { ok: true, saved, emailed, attachments: attachmentIds.length, stored: attachmentIds.length },
    { status: 201 }
  );
}
