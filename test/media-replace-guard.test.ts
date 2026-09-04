import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mediaReplaceBlocker,
  mediaReplaceGuard,
} from "../apps/dashboard/src/hooks/media-replace-guard";

/**
 * Replacing a photograph changes it everywhere it is shown, at once.
 *
 * A product does not hold a copy of its image; it holds the media id. So
 * uploading a new file onto an existing media record repoints every product,
 * category, article and settings screen using that record — twelve pages can
 * change because one person fixed one photo.
 *
 * WHAT IS ALREADY SAFE, checked before adding anything. The old file IS removed
 * (`collections/operations/utilities/update.js:78` calls `deleteAssociatedFiles`
 * when a new file arrives), so nothing is orphaned. The resolution floor IS
 * re-applied, because `enforceProductImageSpec` keys off `req.file` rather than
 * the operation. The replacement IS audit-logged. References stay valid — they
 * point at the same id, which still resolves.
 *
 * So this is not a correctness hole; it is a blast radius nobody is shown. No
 * code can tell a corrected re-export from the wrong photograph pasted onto a
 * shared record, which is why the rule is a confirmation rather than a refusal:
 * the intended workflow is upload -> classify -> correct -> use, and correcting
 * has to stay possible.
 *
 * THE RULE. A new file on an existing record that nothing uses saves straight
 * through. A new file on a record something DOES use is refused once, with the
 * count and a few names, until "replace it everywhere" is ticked. The tick is
 * then cleared, so it authorises one replacement rather than becoming a
 * permanently open door.
 */

const usage = (count: number, singular: string, plural: string, examples: string[] = []) => ({
  count,
  singular,
  plural,
  examples,
});

describe("what the employee is told before replacing", () => {
  it("says nothing when the image is unused", () => {
    expect(mediaReplaceBlocker({ usages: [], settings: [], confirmed: false })).toBeNull();
  });

  it("names the count and a few of the documents", () => {
    const msg =
      mediaReplaceBlocker({
        usages: [usage(12, "product", "products", ["Ferrous Sulphate", "Copper Foil"])],
        settings: [],
        confirmed: false,
      }) ?? "";
    expect(msg).toContain("12 products");
    expect(msg).toContain("Ferrous Sulphate");
  });

  it("counts settings screens too", () => {
    const msg =
      mediaReplaceBlocker({ usages: [], settings: ["Branding"], confirmed: false }) ?? "";
    expect(msg).toMatch(/Branding/);
  });

  it("tells them how to proceed AND how to avoid it", () => {
    // Both paths matter: confirming is right for a corrected export, uploading
    // a new image is right for a different photograph. A message that only
    // offers the first teaches people to tick past it.
    const msg = mediaReplaceBlocker({ usages: [usage(3, "product", "products")], settings: [], confirmed: false }) ?? "";
    expect(msg, "names the tick").toMatch(/replace it everywhere/i);
    expect(msg, "offers the safe alternative").toMatch(/upload/i);
  });

  it("says nothing once it has been confirmed", () => {
    expect(
      mediaReplaceBlocker({
        usages: [usage(12, "product", "products")],
        settings: ["Branding"],
        confirmed: true,
      }),
    ).toBeNull();
  });

  it("reads as a sentence, not an error code", () => {
    const msg = mediaReplaceBlocker({ usages: [usage(1, "product", "products")], settings: [], confirmed: false }) ?? "";
    expect(msg).not.toMatch(/error|invalid|failed|E\d{3}/i);
  });
});

const fakeReq = (opts: { file?: boolean; refs?: number; settings?: boolean } = {}) => {
  const find = vi.fn(async (args: { collection: string }) =>
    args.collection === "products" && opts.refs
      ? { totalDocs: opts.refs, docs: [{ name: "Ferrous Sulphate" }] }
      : { totalDocs: 0, docs: [] },
  );
  const findVersions = vi.fn(async () => ({ totalDocs: 0, docs: [] }));
  const findGlobal = vi.fn(async () => (opts.settings ? { logo: "m1" } : {}));
  return {
    req: {
      file: opts.file ? { data: Buffer.from("new bytes") } : undefined,
      payload: { find, findVersions, findGlobal, logger: { warn: vi.fn(), error: vi.fn() } },
      user: { email: "staff@metnmat.com" },
    },
    find,
    findVersions,
  };
};

const run = async (
  data: Record<string, unknown>,
  operation: "create" | "update",
  req: unknown,
  originalDoc?: Record<string, unknown>,
) => mediaReplaceGuard({ data, operation, originalDoc, req } as never);

describe("when the guard actually runs", () => {
  it("a metadata-only edit passes straight through and looks nothing up", async () => {
    // Fixing alt text or a wrong `category` must stay frictionless — that is
    // the workflow Media.update was deliberately widened to allow.
    const { req, find } = fakeReq({ file: false, refs: 12 });
    await expect(run({ alt: "Corrected" }, "update", req, { id: "m1" })).resolves.toBeDefined();
    expect(find, "no new file means no question to ask").not.toHaveBeenCalled();
  });

  it("a create passes through — nothing can reference it yet", async () => {
    const { req, find } = fakeReq({ file: true, refs: 12 });
    await expect(run({ alt: "New" }, "create", req)).resolves.toBeDefined();
    expect(find).not.toHaveBeenCalled();
  });

  it("a create is never interrupted, even if an originalDoc carries an id", async () => {
    // Without this, the operation check is only redundantly protected by there
    // happening to be no id to look up — true today, and not what the rule is.
    // Nothing can reference a record that is being created.
    const { req } = fakeReq({ file: true, refs: 12 });
    await expect(run({}, "create", req, { id: "m1" })).resolves.toBeDefined();
  });

  it("replacing an UNUSED image is not interrupted", async () => {
    const { req } = fakeReq({ file: true, refs: 0 });
    await expect(run({}, "update", req, { id: "m1" })).resolves.toBeDefined();
  });

  it("replacing an image in use is refused until it is confirmed", async () => {
    // THE REGRESSION this closes: before, this saved silently and twelve
    // product pages changed without anyone being told.
    const { req } = fakeReq({ file: true, refs: 12 });
    await expect(run({}, "update", req, { id: "m1" })).rejects.toThrow(/12 products/);
  });

  it("the refusal names a document, so they can go and look", async () => {
    const { req } = fakeReq({ file: true, refs: 12 });
    await expect(run({}, "update", req, { id: "m1" })).rejects.toThrow(/Ferrous Sulphate/);
  });

  it("a settings reference alone is enough to ask", async () => {
    const { req } = fakeReq({ file: true, refs: 0, settings: true });
    await expect(run({}, "update", req, { id: "m1" })).rejects.toThrow(/Branding/);
  });

  it("ticking the box lets it through", async () => {
    const { req } = fakeReq({ file: true, refs: 12 });
    await expect(run({ confirmReplace: true }, "update", req, { id: "m1" })).resolves.toBeDefined();
  });

  it("the tick authorises ONE replacement, then clears itself", async () => {
    // Left set, it would silently authorise every future replacement of this
    // record — the guard would be off and look on.
    const { req } = fakeReq({ file: true, refs: 12 });
    const data: Record<string, unknown> = { confirmReplace: true };
    await run(data, "update", req, { id: "m1" });
    expect(data.confirmReplace).toBe(false);
  });

  it("counts unpublished references too, by reusing the delete guard's lookup", async () => {
    // One reference table, one set of rules. A file used only by a draft edit
    // is just as replaced as one used by a published page.
    const { req, findVersions } = fakeReq({ file: true, refs: 0 });
    req.payload.findVersions = vi.fn(async (args: { collection: string }) =>
      args.collection === "products"
        ? { totalDocs: 1, docs: [{ version: { name: "Draft Product" } }] }
        : { totalDocs: 0, docs: [] },
    ) as never;
    await expect(run({}, "update", req, { id: "m1" })).rejects.toThrow(/unpublished/i);
    void findVersions;
  });

  it("is refused publicly, so the message is not swallowed", async () => {
    // A bare Error carries no status; isErrorPublic rejects it and routeError
    // replaces the body with "Something went wrong."
    const { req } = fakeReq({ file: true, refs: 3 });
    const err = await run({}, "update", req, { id: "m1" }).catch((e) => e);
    expect((err as { status?: number }).status).toBe(400);
    expect((err as { isPublic?: boolean }).isPublic).toBe(true);
  });
});

describe("the collection is wired to it", () => {
  const src = readFileSync(
    join(__dirname, "..", "apps", "dashboard", "src", "collections", "Media.ts"),
    "utf8",
  );

  it("the guard runs before the derivative work", () => {
    // Refusing early avoids a pointless sharp render of a file that is not
    // going to be saved.
    expect(src).toMatch(/beforeChange: \[mediaReplaceGuard, generateDisplayDerivative\]/);
  });

  it("the confirmation field exists and is not required", () => {
    expect(src).toMatch(/name: "confirmReplace"/);
    const at = src.indexOf('name: "confirmReplace"');
    expect(src.slice(at, at + 500)).not.toMatch(/required: true/);
  });

  it("the field explains itself where staff will read it", () => {
    const at = src.indexOf('name: "confirmReplace"');
    expect(src.slice(at, at + 600)).toMatch(/description:/);
  });

  it("delete is still guarded separately — this did not replace that", () => {
    expect(src).toMatch(/beforeDelete: \[mediaBeforeDelete\]/);
  });
});
