/**
 * "Request to Publish" — public submission endpoint.
 *
 * Protection: rate limit (3 per 10 min per IP), honeypot field, strict
 * server-side validation, extension + declared-MIME + magic-byte file checks,
 * per-file and total size caps, duplicate detection (same email + title in
 * 24 h), and private storage (files go to the staff-only
 * blog-submission-files collection). No stack traces ever reach the client.
 */
import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { isAllowedBlogSubmissionSignature, safeFilename } from "@/backend/lib/file-signature";
import { sendBlogSubmissionEmails } from "@/backend/lib/email";
import {
  createBlogSubmission,
  findRecentDuplicateSubmission,
  uploadSubmissionFile,
} from "@/backend/services/blog.service";

export const dynamic = "force-dynamic";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB per submission

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_FIELDS = ["orcidUrl", "googleScholarUrl", "researchGateUrl", "linkedinUrl"] as const;

const str = (form: FormData, key: string, max = 500): string =>
  String(form.get(key) ?? "")
    .trim()
    .slice(0, max);

const isChecked = (form: FormData, key: string): boolean => {
  const v = String(form.get(key) ?? "").toLowerCase();
  return v === "true" || v === "on" || v === "1" || v === "yes";
};

function validUrlOrEmpty(v: string): boolean {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Salted, keyed hash for abuse correlation — never a stored raw IP. */
function ipHash(ip: string): string {
  const secret = process.env.BLOG_SIGNING_SECRET || process.env.INTERNAL_API_KEY || "dev";
  const month = new Date().toISOString().slice(0, 7); // rotates monthly
  return createHmac("sha256", secret).update(`${ip}.${month}`).digest("hex").slice(0, 32);
}

function makeReference(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `BPR-${new Date().getFullYear()}-${code}`;
}

export async function POST(req: NextRequest) {
  const rl = await limitRate(`blog-submit:${clientIp(req)}`, 3, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions from this connection — please try again later." },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid submission." }, { status: 400 });
  }

  // Honeypot: hidden "website" field — bots fill it, humans never see it.
  if (str(form, "website")) return NextResponse.json({ ok: true, reference: makeReference() }); // pretend success

  // ── Field validation ────────────────────────────────────────────────────────
  const fields: Record<string, string> = {};
  const fullName = str(form, "fullName", 160);
  const email = str(form, "email", 200).toLowerCase();
  const proposedTitle = str(form, "proposedTitle", 240);
  const abstract = str(form, "abstract", 6000);
  const articleText = str(form, "articleText", 60_000);

  if (fullName.length < 2) fields.fullName = "Please enter your full name.";
  if (!EMAIL_RE.test(email)) fields.email = "Please enter a valid email address.";
  if (proposedTitle.length < 8) fields.proposedTitle = "Please enter the proposed article title.";
  if (abstract.length < 50) fields.abstract = "Please provide an abstract of at least 50 characters.";
  if (str(form, "contentType", 40) === "") fields.contentType = "Please choose an article type.";
  if (str(form, "category", 40) === "") fields.category = "Please choose a category.";

  for (const key of URL_FIELDS) {
    if (!validUrlOrEmpty(str(form, key, 300))) fields[key] = "Must be a full http(s) URL.";
  }

  const declarations = {
    authorisedToSubmit: isChecked(form, "authorisedToSubmit"),
    copyrightConfirmed: isChecked(form, "copyrightConfirmed"),
    understandsNoGuarantee: isChecked(form, "understandsNoGuarantee"),
    contactConsent: isChecked(form, "contactConsent"),
    termsAccepted: isChecked(form, "termsAccepted"),
  };
  for (const [k, v] of Object.entries(declarations)) {
    if (!v) fields[k] = "This confirmation is required.";
  }

  // ── File validation ────────────────────────────────────────────────────────
  const rawFiles = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (rawFiles.length > MAX_FILES) {
    fields.files = `Maximum ${MAX_FILES} files.`;
  }
  let totalBytes = 0;
  const validated: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  if (!fields.files) {
    for (const file of rawFiles) {
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const mime = EXT_MIME[ext];
      if (!mime) {
        fields.files = `"${file.name.slice(0, 60)}" is not an accepted format (PDF, DOC, DOCX, ODT, XLSX, PNG, JPG, WEBP).`;
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        fields.files = `"${file.name.slice(0, 60)}" is larger than 10 MB.`;
        break;
      }
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        fields.files = "Attachments exceed 25 MB in total.";
        break;
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!isAllowedBlogSubmissionSignature(buffer)) {
        fields.files = `"${file.name.slice(0, 60)}" does not match its declared format.`;
        break;
      }
      validated.push({ buffer, filename: safeFilename(file.name), mimeType: mime });
    }
  }

  if (Object.keys(fields).length) {
    return NextResponse.json(
      { ok: false, error: "Please correct the highlighted fields.", fields },
      { status: 400 },
    );
  }

  // ── Duplicate detection ─────────────────────────────────────────────────────
  if (await findRecentDuplicateSubmission(email, proposedTitle)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "We already have a recent submission with this title from your email address. The editorial team will be in touch — please avoid resubmitting.",
      },
      { status: 409 },
    );
  }

  // ── Store files (private collection) ───────────────────────────────────────
  const attachmentIds: string[] = [];
  const attachmentNames: string[] = [];
  for (const f of validated) {
    const id = await uploadSubmissionFile(f);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "File upload failed — please try again in a moment." },
        { status: 502 },
      );
    }
    attachmentIds.push(id);
    attachmentNames.push(f.filename);
  }

  // ── Create the submission ───────────────────────────────────────────────────
  const referenceNumber = makeReference();
  const submissionId = await createBlogSubmission({
    referenceNumber,
    status: "new",
    fullName,
    designation: str(form, "designation", 160),
    organisation: str(form, "organisation", 200),
    department: str(form, "department", 160),
    email,
    mobile: str(form, "mobile", 40),
    country: str(form, "country", 80),
    orcidUrl: str(form, "orcidUrl", 300),
    googleScholarUrl: str(form, "googleScholarUrl", 300),
    researchGateUrl: str(form, "researchGateUrl", 300),
    linkedinUrl: str(form, "linkedinUrl", 300),
    proposedTitle,
    contentType: str(form, "contentType", 40) || undefined,
    category: str(form, "category", 40) || undefined,
    researchArea: str(form, "researchArea", 200),
    abstract,
    keywords: str(form, "keywords", 400),
    articleText,
    coAuthors: str(form, "coAuthors", 2000),
    previouslyPublished: isChecked(form, "previouslyPublished"),
    previousPublicationUrl: str(form, "previousPublicationUrl", 300),
    conflictOfInterest: str(form, "conflictOfInterest", 2000),
    fundingAcknowledgement: str(form, "fundingAcknowledgement", 2000),
    additionalMessage: str(form, "additionalMessage", 4000),
    attachments: attachmentIds,
    ...declarations,
    sourceIpHash: ipHash(clientIp(req)),
  });

  if (!submissionId) {
    return NextResponse.json(
      { ok: false, error: "We could not record your submission — please try again shortly." },
      { status: 502 },
    );
  }

  // Content-type / category names for the emails (ids → labels, best effort).
  const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
  const labelOf = async (collection: string, id: string): Promise<string | undefined> => {
    if (!id) return undefined;
    try {
      const res = await fetch(`${CMS}/api/${collection}/${id}?depth=0`, {
        next: { revalidate: 300 },
      });
      if (!res.ok) return undefined;
      return ((await res.json()) as { name?: string }).name;
    } catch {
      return undefined;
    }
  };
  const [contentTypeName, categoryName] = await Promise.all([
    labelOf("blog-content-types", str(form, "contentType", 40)),
    labelOf("blog-categories", str(form, "category", 40)),
  ]);

  await sendBlogSubmissionEmails({
    referenceNumber,
    fullName,
    email,
    organisation: str(form, "organisation", 200) || undefined,
    designation: str(form, "designation", 160) || undefined,
    country: str(form, "country", 80) || undefined,
    proposedTitle,
    contentTypeName,
    categoryName,
    researchArea: str(form, "researchArea", 200) || undefined,
    abstract,
    keywords: str(form, "keywords", 400) || undefined,
    attachmentNames,
  }).catch(() => {});

  return NextResponse.json({ ok: true, reference: referenceNumber });
}
