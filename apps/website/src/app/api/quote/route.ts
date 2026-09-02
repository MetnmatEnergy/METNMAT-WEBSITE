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
import {
  beginIdempotent,
  completeIdempotent,
  abandonIdempotent,
  normalizeIdempotencyKey,
} from "@/backend/lib/idempotency";

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

  /*
   * ONCE ONLY.
   *
   * Each submission files an RFQ for staff to work and sends two emails, one
   * carrying the customer's attachments. Nothing stopped a repeat: a double
   * click, a refresh of the POST, a client retry after a slow response or a
   * proxy replay each produced another RFQ and another pair of emails, and
   * staff could not tell duplicates from two genuine enquiries by one person.
   *
   * Claimed AFTER validation so a malformed body never burns a key, and
   * released on failure so a transient error does not lock the customer out of
   * retrying for the whole TTL.
   */
  const idemKey = normalizeIdempotencyKey(b.requestId);
  if (idemKey) {
    const prior = await beginIdempotent<Record<string, unknown>>(idemKey);
    if (prior.state === "done") {
      return NextResponse.json(prior.result, { status: 200 });
    }
    if (prior.state === "in_flight") {
      // The first attempt is still running. Answering 202 rather than an error
      // keeps the customer's screen truthful: it IS being processed.
      return NextResponse.json(
        { ok: true, pending: true, message: "Your request is already being submitted." },
        { status: 202 }
      );
    }
  }

  // product may arrive as an object (JSON) or already-parsed (multipart).
  const rawP = b.product;
  const p = (typeof rawP === "object" && rawP ? rawP : {}) as {
    name?: string;
    sku?: string;
    slug?: string;
  };
  /*
   * These four never went through validateEnquiry — the route reads them
   * straight off the body — so they had no length bound at all. Truncated
   * rather than rejected: they are supporting detail, and failing a whole
   * enquiry because someone pasted a long spec sheet into "material" would lose
   * a real lead over a formatting problem.
   */
  const DETAIL_MAX = 2000;
  const str = (k: string) =>
    typeof b[k] === "string" ? (b[k] as string).slice(0, DETAIL_MAX) : undefined;

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

  /*
   * PERSIST FIRST, then email.
   *
   * The order already ran this way, but the response did not respect it: a
   * failed CMS save with a successful email returned 201, so the RFQ existed
   * only in an inbox. It was absent from the admin queue staff actually work
   * from, and nobody was told. The request had not disappeared, but for every
   * practical purpose it had.
   *
   * Now the save is what decides acceptance. If it fails we still send the team
   * notification — losing the lead entirely would be worse — but we do not tell
   * the customer their request was received, because the system they will be
   * chased from does not have it.
   */
  const saved = await createEnquiry(enquiry);
  const withReference = { ...enquiry, referenceId: saved.referenceId };
  const emailed = await sendQuoteEmails(withReference, emailAttachments);

  if (!saved.ok) {
    console.error("[quote] CMS save FAILED — enquiry exists only in email", {
      email: enquiry.email,
      teamNotified: emailed.team,
    });
    if (idemKey) await abandonIdempotent(idemKey);
    return NextResponse.json(
      {
        ok: false,
        error: emailed.team
          ? "We've received your request by email but couldn't file it properly. Our team will still see it — if you don't hear back within one working day, please email contact@metnmat.com."
          : "We couldn't submit your request right now. Please try again, or email us directly at contact@metnmat.com.",
      },
      { status: 502 }
    );
  }

  const payload = {
    ok: true as const,
    reference: saved.referenceId,
    saved: saved.ok,
    // Reported separately so the success screen stops claiming a copy was
    // emailed to the customer when only the internal notification sent.
    emailedCustomer: emailed.customer,
    emailedTeam: emailed.team,
    attachments: attachmentIds.length,
    stored: attachmentIds.length,
  };

  // Remember the answer so a double click, a refresh of the POST, or a client
  // retry replays it instead of filing a second RFQ and sending both emails
  // again — this time with the customer's attachments a second time.
  if (idemKey) await completeIdempotent(idemKey, payload);

  return NextResponse.json(payload, { status: 201 });
}
