import { NextResponse } from "next/server";
import { uploadEnquiryFiles, type ParsedFile } from "@/backend/services/enquiries.service";
import { rateLimit, clientIp } from "@/backend/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = /^(application\/pdf|image\/)/;

/**
 * Upload ONE customer file immediately (as soon as they attach it), so the form
 * can show a real progress animation and the file lands in the dashboard +
 * database right away. Returns the stored doc id used later to link the enquiry.
 */
export async function POST(request: Request) {
  const rl = rateLimit(`upload:${clientIp(request)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many uploads. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 30) } }
    );
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "Expected multipart/form-data." }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const source = typeof form.get("source") === "string" ? (form.get("source") as string) : "quote";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ ok: false, error: "File is larger than 10 MB." }, { status: 413 });
  }
  if (!ALLOWED.test(file.type || "")) {
    return NextResponse.json({ ok: false, error: "Only PDF or image files are allowed." }, { status: 415 });
  }

  const parsed: ParsedFile = {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    buffer: Buffer.from(await file.arrayBuffer()),
  };

  const [stored] = await uploadEnquiryFiles([parsed], source);
  if (!stored?.id) {
    return NextResponse.json({ ok: false, error: "Storage failed. Please retry." }, { status: 502 });
  }

  return NextResponse.json(
    { ok: true, id: stored.id, filename: stored.filename, url: stored.url, size: file.size, type: parsed.contentType },
    { status: 201 }
  );
}
