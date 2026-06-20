/**
 * Server-side file validation that does NOT trust the client.
 *
 * The browser-declared Content-Type on a multipart upload is attacker-controlled
 * (a renamed .html/.exe/.zip can claim `application/pdf`). So we sniff the real
 * leading bytes ("magic numbers") and only accept the formats the quote / RFQ
 * flow actually stores: PDF + the image formats the EnquiryUploads collection
 * allows. No external dependency — these signatures are stable and well-known.
 */

export type SniffedKind = "pdf" | "png" | "jpeg" | "gif" | "webp" | "isobmff" | null;

/** Returns the detected file kind from the leading bytes, or null if unknown. */
export function sniffFileSignature(buf: Buffer): SniffedKind {
  if (buf.length < 12) return null;

  // PDF: "%PDF-"
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) {
    return "pdf";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  // WEBP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "webp";
  }
  // ISO-BMFF container (HEIC / HEIF / AVIF — phone camera photos): bytes 4-7 == "ftyp"
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "isobmff";

  return null;
}

/** True only when the real bytes are an accepted PDF / image attachment. */
export function isAllowedUploadSignature(buf: Buffer): boolean {
  return sniffFileSignature(buf) !== null;
}

/**
 * Make a client-supplied filename safe to store and to put in a
 * Content-Disposition header: strip any path, replace anything that isn't an
 * ASCII word char / dot / dash / space (this also removes control chars and
 * unicode bidi-override tricks), collapse runs, and cap the length.
 */
export function safeFilename(name: string): string {
  const base = (name || "file").split(/[\\/]/).pop() || "file"; // strip directories
  const cleaned = base
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return cleaned.replace(/^[._-]+/, "") || "file";
}
