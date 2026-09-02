import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mintAttachmentGrant,
  verifyAttachmentGrant,
  collectGrantedIds,
} from "../apps/website/src/backend/lib/attachment-grant";

/**
 * The bug these guard against.
 *
 * `/api/quote` accepted `attachmentIds` from the request body, read each id back
 * with the internal key (which satisfies the staff-only read gate on
 * enquiry-uploads) and attached the bytes to an email addressed to a field in
 * the same untrusted body. Anyone could therefore have another customer's
 * drawings mailed to themselves, and the ids were guessable: the public upload
 * endpoint hands one out, and Mongo ObjectIds are a timestamp plus a per-process
 * random plus a sequential counter.
 *
 * The tests that matter are the negative ones — the id must be unusable without
 * a signature this process minted.
 */

const ID_A = "507f1f77bcf86cd799439011";
const ID_B = "507f1f77bcf86cd799439012"; // the neighbouring id an attacker would walk to
const NOW = 1_760_000_000_000;

let saved: { attach?: string; internal?: string };

beforeEach(() => {
  saved = {
    attach: process.env.ATTACHMENT_SIGNING_SECRET,
    internal: process.env.INTERNAL_API_KEY,
  };
  process.env.ATTACHMENT_SIGNING_SECRET = "test-signing-secret";
  delete process.env.INTERNAL_API_KEY;
});

afterEach(() => {
  if (saved.attach === undefined) delete process.env.ATTACHMENT_SIGNING_SECRET;
  else process.env.ATTACHMENT_SIGNING_SECRET = saved.attach;
  if (saved.internal === undefined) delete process.env.INTERNAL_API_KEY;
  else process.env.INTERNAL_API_KEY = saved.internal;
});

describe("attachment grants", () => {
  it("round-trips an id the uploader was given", () => {
    const grant = mintAttachmentGrant(ID_A, NOW);
    expect(grant).toBeTruthy();
    expect(verifyAttachmentGrant(grant, NOW)).toBe(ID_A);
  });

  // ── The exploit ───────────────────────────────────────────────────────────
  it("REFUSES a bare id — this is the whole vulnerability", () => {
    expect(verifyAttachmentGrant(ID_A, NOW)).toBeNull();
    expect(collectGrantedIds([ID_A, ID_B], 5, NOW)).toEqual({ ids: [], rejected: 2 });
  });

  it("refuses a grant re-pointed at someone else's id", () => {
    const grant = mintAttachmentGrant(ID_A, NOW)!;
    const [, exp, mac] = grant.split(".");
    // Attacker keeps a signature they legitimately hold, swaps the id.
    expect(verifyAttachmentGrant(`${ID_B}.${exp}.${mac}`, NOW)).toBeNull();
  });

  it("refuses a grant whose expiry has been extended", () => {
    const grant = mintAttachmentGrant(ID_A, NOW)!;
    const [id, exp, mac] = grant.split(".");
    const later = String(Number(exp) + 86_400_000);
    expect(verifyAttachmentGrant(`${id}.${later}.${mac}`, NOW)).toBeNull();
  });

  it("refuses a tampered signature", () => {
    const grant = mintAttachmentGrant(ID_A, NOW)!;
    const [id, exp, mac] = grant.split(".");
    const flipped = (mac[0] === "A" ? "B" : "A") + mac.slice(1);
    expect(verifyAttachmentGrant(`${id}.${exp}.${flipped}`, NOW)).toBeNull();
  });

  it("expires", () => {
    const grant = mintAttachmentGrant(ID_A, NOW)!;
    expect(verifyAttachmentGrant(grant, NOW + 11 * 3600_000)).toBe(ID_A);
    expect(verifyAttachmentGrant(grant, NOW + 13 * 3600_000)).toBeNull();
  });

  // ── The URL-injection primitive ───────────────────────────────────────────
  it("refuses ids that are not ObjectIds, so none can reach a privileged URL", () => {
    // Each of these, interpolated raw into `${CMS}/api/enquiry-uploads/${id}`,
    // turned a file readback into an arbitrary internal-key-authenticated GET.
    for (const bad of [
      "../../customers",
      "../customers?limit=1000",
      "507f1f77bcf86cd799439011/../../users",
      "507f1f77bcf86cd799439011?depth=5&x=",
      "507f1f77bcf86cd79943901",   // 23 chars
      "507f1f77bcf86cd7994390111", // 25 chars
      "507F1F77BCF86CD799439011",  // uppercase is not what Payload emits
      "",
    ]) {
      const forged = mintAttachmentGrant(bad, NOW);
      expect(forged, `should not mint for ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  // ── Fail closed ───────────────────────────────────────────────────────────
  it("fails closed with no secret configured, rather than accepting anything", () => {
    const grant = mintAttachmentGrant(ID_A, NOW)!;
    delete process.env.ATTACHMENT_SIGNING_SECRET;
    delete process.env.INTERNAL_API_KEY;
    expect(mintAttachmentGrant(ID_A, NOW)).toBeNull();
    expect(verifyAttachmentGrant(grant, NOW)).toBeNull();
  });

  it("does not accept a grant signed with a different secret", () => {
    const grant = mintAttachmentGrant(ID_A, NOW)!;
    process.env.ATTACHMENT_SIGNING_SECRET = "a-different-secret";
    expect(verifyAttachmentGrant(grant, NOW)).toBeNull();
  });

  it("falls back to INTERNAL_API_KEY when no dedicated secret is set", () => {
    delete process.env.ATTACHMENT_SIGNING_SECRET;
    process.env.INTERNAL_API_KEY = "internal-key";
    const grant = mintAttachmentGrant(ID_A, NOW);
    expect(verifyAttachmentGrant(grant, NOW)).toBe(ID_A);
  });

  // ── Shape / abuse bounds ──────────────────────────────────────────────────
  it("rejects non-strings and oversized tokens without doing work", () => {
    for (const bad of [null, undefined, 42, {}, [], true, "a".repeat(500)]) {
      expect(verifyAttachmentGrant(bad, NOW)).toBeNull();
    }
    expect(verifyAttachmentGrant(`${ID_A}.${NOW + 1000}`, NOW)).toBeNull();
    expect(verifyAttachmentGrant(`${ID_A}.${NOW + 1000}.a.b`, NOW)).toBeNull();
  });

  it("caps the list, so one cheap request cannot drive unbounded readbacks", () => {
    const ids = Array.from({ length: 40 }, (_, i) =>
      "507f1f77bcf86cd7994390".concat(String(i).padStart(2, "0"))
    );
    const grants = ids.map((id) => mintAttachmentGrant(id, NOW)!);
    const out = collectGrantedIds(grants, 5, NOW);
    expect(out.ids).toHaveLength(5);
    expect(out.rejected).toBe(35);
  });

  it("dedupes, so the same file is not attached repeatedly", () => {
    const grant = mintAttachmentGrant(ID_A, NOW)!;
    const out = collectGrantedIds([grant, grant, grant], 5, NOW);
    expect(out.ids).toEqual([ID_A]);
  });

  it("keeps the valid grants when the list is a mix", () => {
    const good = mintAttachmentGrant(ID_A, NOW)!;
    const out = collectGrantedIds([ID_B, good, "nonsense", null, 7], 5, NOW);
    expect(out.ids).toEqual([ID_A]);
    expect(out.rejected).toBe(4);
  });

  it("treats a non-array as empty rather than throwing", () => {
    for (const bad of [undefined, null, "grant", 5, {}]) {
      expect(collectGrantedIds(bad, 5, NOW)).toEqual({ ids: [], rejected: 0 });
    }
  });
});
