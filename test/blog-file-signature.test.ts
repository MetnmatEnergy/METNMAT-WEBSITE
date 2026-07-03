import { describe, it, expect } from "vitest";
import {
  sniffFileSignature,
  isAllowedUploadSignature,
  isAllowedBlogSubmissionSignature,
} from "../apps/website/src/backend/lib/file-signature";

const pad = (head: number[]) =>
  Buffer.from([...head, ...new Array(Math.max(0, 12 - head.length)).fill(0)]);

const ZIP = pad([0x50, 0x4b, 0x03, 0x04]); // PK.. (docx/xlsx/odt)
const OLE = pad([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // legacy .doc
const PDF = pad([0x25, 0x50, 0x44, 0x46, 0x2d]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXE = pad([0x4d, 0x5a]); // MZ
const HTML = Buffer.from("<!DOCTYPE html><html></html>");

describe("document signatures", () => {
  it("detects zip-based and OLE documents", () => {
    expect(sniffFileSignature(ZIP)).toBe("zip");
    expect(sniffFileSignature(OLE)).toBe("ole");
  });
  it("still rejects executables and html", () => {
    expect(sniffFileSignature(EXE)).toBeNull();
    expect(sniffFileSignature(HTML)).toBeNull();
  });
});

describe("isAllowedUploadSignature (quote/RFQ flow — unchanged behaviour)", () => {
  it("keeps accepting pdf/images and NOW STILL rejects documents", () => {
    expect(isAllowedUploadSignature(PDF)).toBe(true);
    expect(isAllowedUploadSignature(PNG)).toBe(true);
    expect(isAllowedUploadSignature(ZIP)).toBe(false);
    expect(isAllowedUploadSignature(OLE)).toBe(false);
    expect(isAllowedUploadSignature(EXE)).toBe(false);
  });
});

describe("isAllowedBlogSubmissionSignature (manuscripts)", () => {
  it("accepts pdf, docs and images", () => {
    expect(isAllowedBlogSubmissionSignature(PDF)).toBe(true);
    expect(isAllowedBlogSubmissionSignature(ZIP)).toBe(true);
    expect(isAllowedBlogSubmissionSignature(OLE)).toBe(true);
    expect(isAllowedBlogSubmissionSignature(PNG)).toBe(true);
  });
  it("rejects executables, html and unknown formats", () => {
    expect(isAllowedBlogSubmissionSignature(EXE)).toBe(false);
    expect(isAllowedBlogSubmissionSignature(HTML)).toBe(false);
    expect(isAllowedBlogSubmissionSignature(Buffer.from([1, 2, 3]))).toBe(false);
  });
});
