import { describe, it, expect } from "vitest";
import {
  sniffFileSignature,
  isAllowedUploadSignature,
  safeFilename,
} from "../apps/website/src/backend/lib/file-signature";

// Build a >=12-byte buffer from a leading byte sequence.
const buf = (head: number[]) => Buffer.from([...head, ...new Array(Math.max(0, 12 - head.length)).fill(0)]);
const PDF = buf([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const PNG = buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = buf([0xff, 0xd8, 0xff]);
const GIF = buf([0x47, 0x49, 0x46, 0x38]); // GIF8
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); // RIFF....WEBP
const HEIC = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]); // ....ftypheic
const HTML = Buffer.from("<!DOCTYPE html><html></html>");

describe("sniffFileSignature", () => {
  it("detects real file types from magic bytes", () => {
    expect(sniffFileSignature(PDF)).toBe("pdf");
    expect(sniffFileSignature(PNG)).toBe("png");
    expect(sniffFileSignature(JPEG)).toBe("jpeg");
    expect(sniffFileSignature(GIF)).toBe("gif");
    expect(sniffFileSignature(WEBP)).toBe("webp");
    expect(sniffFileSignature(HEIC)).toBe("isobmff");
  });

  it("rejects spoofed / dangerous content", () => {
    expect(sniffFileSignature(HTML)).toBeNull();
    expect(sniffFileSignature(Buffer.from("MZ\x90\x00"))).toBeNull(); // EXE, too short anyway
    // ZIP is now *detected* (blog manuscripts are docx/odt zips) but stays
    // BLOCKED for the quote/RFQ flow — asserted in isAllowedUploadSignature below.
    expect(sniffFileSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("zip");
  });

  it("returns null for buffers shorter than 12 bytes", () => {
    expect(sniffFileSignature(Buffer.from([0x25, 0x50]))).toBeNull();
  });
});

describe("isAllowedUploadSignature", () => {
  it("allows PDF + images, blocks everything else", () => {
    expect(isAllowedUploadSignature(PDF)).toBe(true);
    expect(isAllowedUploadSignature(PNG)).toBe(true);
    // A renamed HTML file claiming application/pdf is still rejected by content.
    expect(isAllowedUploadSignature(HTML)).toBe(false);
    // ZIP/OLE documents are for the blog submission flow only — never quote/RFQ.
    expect(isAllowedUploadSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
  });
});

describe("safeFilename", () => {
  it("strips path separators and traversal", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Windows\\System32\\evil.exe")).toBe("evil.exe");
  });

  it("removes control/unicode-trick characters", () => {
    expect(safeFilename("inv‮gpj.exe")).not.toContain("‮");
    expect(safeFilename("a b c.pdf")).toBe("a_b_c.pdf");
  });

  it("caps length and never returns empty", () => {
    expect(safeFilename("x".repeat(500)).length).toBeLessThanOrEqual(120);
    expect(safeFilename("")).toBe("file");
    expect(safeFilename("...")).toBe("file");
  });
});
