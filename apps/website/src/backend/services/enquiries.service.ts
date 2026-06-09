/**
 * Enquiries service — persists customization/quote requests into the dashboard
 * CMS (Payload `enquiries` collection, which allows public create). The team
 * then sees and manages them in the admin.
 */
const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";

export type EnquiryInput = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  source: string;
  productName?: string;
  productSku?: string;
  productSlug?: string;
  design?: string;
  size?: string;
  material?: string;
  quantity?: string;
  attachmentNames?: string[];
  /** IDs of files already uploaded to the dashboard `enquiry-uploads` collection. */
  attachmentIds?: string[];
};

/** A parsed upload (raw bytes) ready to forward to the dashboard. */
export type ParsedFile = { filename: string; contentType: string; buffer: Buffer };

/** An uploaded file as stored in the dashboard. */
export type UploadedFile = { id: string; filename: string; url?: string };

/**
 * Upload customer files into the dashboard `enquiry-uploads` collection (public
 * create). Returns the created docs so the enquiry can link them and emails can
 * reference them. Failures are skipped (the request still succeeds).
 */
export async function uploadEnquiryFiles(
  files: ParsedFile[],
  source: string
): Promise<UploadedFile[]> {
  const out: UploadedFile[] = [];
  for (const f of files) {
    try {
      const form = new FormData();
      const blob = new Blob([new Uint8Array(f.buffer)], { type: f.contentType });
      form.append("file", blob, f.filename);
      form.append("_payload", JSON.stringify({ source }));
      const res = await fetch(`${CMS}/api/enquiry-uploads`, { method: "POST", body: form });
      if (!res.ok) {
        console.warn(`[enquiry] upload failed (${res.status}) for ${f.filename}`);
        continue;
      }
      const json = (await res.json()) as { doc?: { id?: string; filename?: string; url?: string } };
      if (json?.doc?.id) {
        const url = json.doc.url
          ? json.doc.url.startsWith("http")
            ? json.doc.url
            : `${CMS}${json.doc.url}`
          : undefined;
        out.push({ id: json.doc.id, filename: json.doc.filename ?? f.filename, url });
      }
    } catch {
      console.warn(`[enquiry] upload error for ${f.filename}`);
    }
  }
  return out;
}

/**
 * Read an uploaded enquiry file back from the dashboard (server-to-server, using
 * the shared internal key) and return it base64-encoded for email attachment.
 * Best-effort: returns null on any failure so the email still sends.
 */
export async function fetchEnquiryFileBase64(
  id: string
): Promise<{ filename: string; content: string; contentType: string } | null> {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return null;
  try {
    // 1) Look up the doc to get filename + mimeType.
    const metaRes = await fetch(`${CMS}/api/enquiry-uploads/${id}?depth=0`, {
      headers: { "x-internal-key": key },
      cache: "no-store",
    });
    if (!metaRes.ok) return null;
    const doc = (await metaRes.json()) as { filename?: string; mimeType?: string };
    if (!doc?.filename) return null;

    // 2) Download the binary via the collection file route.
    const fileRes = await fetch(
      `${CMS}/api/enquiry-uploads/file/${encodeURIComponent(doc.filename)}`,
      { headers: { "x-internal-key": key }, cache: "no-store" }
    );
    if (!fileRes.ok) return null;
    const buf = Buffer.from(await fileRes.arrayBuffer());
    return {
      filename: doc.filename,
      content: buf.toString("base64"),
      contentType: doc.mimeType || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

export async function createEnquiry(input: EnquiryInput): Promise<boolean> {
  try {
    const res = await fetch(`${CMS}/api/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "new",
        source: input.source,
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        productName: input.productName,
        productSku: input.productSku,
        productSlug: input.productSlug,
        design: input.design,
        size: input.size,
        material: input.material,
        quantity: input.quantity,
        message: input.message,
        ...(input.attachmentIds?.length ? { attachments: input.attachmentIds } : {}),
      }),
    });
    if (!res.ok) {
      console.warn(`[enquiry] CMS save failed: ${res.status}`);
      return false;
    }
    return true;
  } catch {
    console.warn("[enquiry] CMS unreachable — not saved.");
    return false;
  }
}
