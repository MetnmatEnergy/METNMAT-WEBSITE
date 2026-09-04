import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOCUMENT_REFS,
  collectDocumentUsages,
  documentDeleteBlocker,
  documentBeforeDelete,
  type DocumentRefLookup,
} from "../apps/dashboard/src/hooks/document-guards";

/**
 * A GST invoice PDF could be deleted by anyone who manages assets.
 *
 * THE RULE ALREADY EXISTS — this enforces it, it does not invent it.
 * `collections/Invoices.ts:7` says so in its own header: "Statutory document —
 * not destructively deletable (super-admin only)", and backs it with
 * `delete: isSuperAdmin` at :21. The serial is protected too: once minted it is
 * pinned rather than re-issued (`hooks/order-workflow.ts:93-125`).
 *
 * THE BACK DOOR. The invoice RECORD is in `invoices`; the invoice PDF is in
 * `documents`, whose `delete: canManageAssets` (Documents.ts:28) is a strictly
 * wider set — super-admin, admin, marketing, or any custom role holding the
 * Assets or Content area (`access/index.ts:179-181`). So a role that cannot
 * touch the invoice could delete the invoice's PDF, leaving the statutory
 * record pointing at a file that no longer exists. Documents had no
 * `beforeDelete` hook at all.
 *
 * THE RULE APPLIED HERE is reference-based, exactly as for media: a document
 * something still points at is refused; an unreferenced one is still deletable.
 * That keeps disposable attachments disposable, which is the other half of the
 * requirement — a guard that made every PDF permanent would be its own defect.
 *
 * No retention policy is invented. Nothing is time-based, nothing distinguishes
 * "financial" from "ordinary" by type, and the `type` select is not consulted:
 * being referenced is the whole test.
 */

const usage = (count: number, singular: string, plural: string, examples: string[] = []) => ({
  count,
  singular,
  plural,
  examples,
});

describe("the reference table names real fields", () => {
  const SRC = join(__dirname, "..", "apps", "dashboard", "src", "collections");
  const FILES: Record<string, string> = {
    invoices: "Invoices.ts",
    quotations: "Quotations.ts",
    enquiries: "Enquiries.ts",
    tasks: "Tasks.ts",
    posts: "Posts.ts",
    products: "Products.ts",
  };

  it("covers every collection that points at documents", () => {
    // A missed collection is a silent hole: the query matches nothing and the
    // guard looks like it worked.
    expect(DOCUMENT_REFS.map((r) => r.collection).sort()).toEqual(Object.keys(FILES).sort());
  });

  it.each(DOCUMENT_REFS.flatMap((r) => r.paths.map((p) => [r.collection, p] as const)))(
    "%s.%s really points at documents",
    (collection, path) => {
      const src = readFileSync(join(SRC, FILES[collection]), "utf8");
      const at = src.indexOf(`name: "${path}"`);
      expect(at, `${collection}.${path} not found`).toBeGreaterThan(-1);
      expect(src.slice(at, at + 300)).toContain('relationTo: "documents"');
    },
  );

  it("the drafts flag matches which referrers actually have drafts", () => {
    // Only Products and Posts do. Asking findVersions of a collection without
    // versions is an error, so an over-eager flag would break every delete.
    for (const ref of DOCUMENT_REFS) {
      const src = readFileSync(join(SRC, FILES[ref.collection]), "utf8");
      expect(Boolean(ref.drafts), `${ref.collection}`).toBe(/drafts:\s*\{|drafts:\s*true/.test(src));
    }
  });

  it("exactly two referrers have drafts", () => {
    expect(DOCUMENT_REFS.filter((r) => r.drafts).map((r) => r.collection).sort()).toEqual([
      "posts",
      "products",
    ]);
  });
});

describe("what a refusal says", () => {
  it("says nothing when the document is unreferenced", () => {
    expect(documentDeleteBlocker({ title: "Old draft.pdf", usages: [] })).toBeNull();
  });

  it("names the invoice that still points at it", () => {
    const msg =
      documentDeleteBlocker({
        title: "INV-2026-000123.pdf",
        usages: [usage(1, "invoice", "invoices", ["INV-2026-000123"])],
      }) ?? "";
    expect(msg).toContain("INV-2026-000123");
    expect(msg).toMatch(/invoice/i);
  });

  it("tells staff what to do instead of just refusing", () => {
    const msg = documentDeleteBlocker({ title: "q.pdf", usages: [usage(2, "quotation", "quotations")] }) ?? "";
    expect(msg.length).toBeGreaterThan(60);
    expect(msg).toMatch(/remove|clear|detach|unlink/i);
  });

  it("reads as a sentence, not an error code", () => {
    const msg = documentDeleteBlocker({ title: "x.pdf", usages: [usage(1, "task", "tasks")] }) ?? "";
    expect(msg).not.toMatch(/error|invalid|failed|E\d{3}/i);
  });
});

const P = (over: Record<string, unknown> = {}) => ({
  find: vi.fn(async () => ({ totalDocs: 0, docs: [] })),
  findVersions: vi.fn(async () => ({ totalDocs: 0, docs: [] })),
  findByID: vi.fn(async () => ({ title: "doc.pdf" })),
  ...over,
});

describe("counting what still points at a document", () => {
  it("a referenced invoice PDF cannot be deleted", async () => {
    // THE REGRESSION. Documents had no beforeDelete at all, so this succeeded
    // and the statutory record was left pointing at nothing.
    const db = P({
      find: vi.fn(async (a: { collection: string }) =>
        a.collection === "invoices"
          ? { totalDocs: 1, docs: [{ invoiceNumber: "INV-2026-000123" }] }
          : { totalDocs: 0, docs: [] },
      ),
    });
    const { usages } = await collectDocumentUsages(db as unknown as DocumentRefLookup, "d1");
    expect(documentDeleteBlocker({ title: "inv.pdf", usages })).toMatch(/INV-2026-000123/);
  });

  it("an unreferenced document is still deletable", async () => {
    // The other half of the requirement: disposable attachments stay disposable.
    const db = P();
    const { usages } = await collectDocumentUsages(db as unknown as DocumentRefLookup, "d1");
    expect(documentDeleteBlocker({ title: "scratch.pdf", usages })).toBeNull();
  });

  it.each(["quotations", "enquiries", "tasks", "posts", "products"])(
    "a reference from %s also blocks",
    async (collection) => {
      const db = P({
        find: vi.fn(async (a: { collection: string }) =>
          a.collection === collection ? { totalDocs: 1, docs: [{}] } : { totalDocs: 0, docs: [] },
        ),
      });
      const { usages } = await collectDocumentUsages(db as unknown as DocumentRefLookup, "d1");
      expect(usages.reduce((n, u) => n + u.count, 0)).toBe(1);
    },
  );

  it("a reference held only by an UNPUBLISHED product edit still blocks", async () => {
    // Same trap as media: a draft revision of a published product writes only
    // to _products_versions, so the main-collection query cannot see it.
    const db = P({
      findVersions: vi.fn(async (a: { collection: string }) =>
        a.collection === "products"
          ? { totalDocs: 1, docs: [{ version: { name: "Ferrous Sulphate" } }] }
          : { totalDocs: 0, docs: [] },
      ),
    });
    const { usages } = await collectDocumentUsages(db as unknown as DocumentRefLookup, "d1");
    const msg = documentDeleteBlocker({ title: "sds.pdf", usages }) ?? "";
    expect(msg).toMatch(/unpublished/i);
    expect(msg).toContain("Ferrous Sulphate");
  });

  it("only the two drafted collections are asked for versions", async () => {
    const db = P();
    await collectDocumentUsages(db as unknown as DocumentRefLookup, "d1");
    const asked = (db.findVersions as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { collection: string }).collection,
    );
    expect(asked.sort()).toEqual(["posts", "products"]);
  });

  it("the version search asks for the latest DRAFT head only", async () => {
    const db = P();
    await collectDocumentUsages(db as unknown as DocumentRefLookup, "d1");
    const where = JSON.stringify(
      (db.findVersions as ReturnType<typeof vi.fn>).mock.calls[0]?.[0],
    );
    expect(where).toContain('"latest"');
    expect(where).toContain("version._status");
    expect(where).toContain("draft");
  });

  it("a lookup that cannot answer must not read as 'unused'", async () => {
    // Deleting removes the PDF from storage; refusing is recoverable.
    const db = P({
      find: vi.fn(async () => {
        throw new Error("documents unavailable");
      }),
    });
    await expect(
      collectDocumentUsages(db as unknown as DocumentRefLookup, "d1"),
    ).rejects.toThrow(/unavailable/);
  });
});

describe("the hook itself", () => {
  const req = (db: Record<string, unknown>) => ({ payload: db });

  it("refuses publicly, so the reason is not swallowed", async () => {
    const db = P({
      find: vi.fn(async (a: { collection: string }) =>
        a.collection === "invoices" ? { totalDocs: 1, docs: [{ invoiceNumber: "INV-1" }] } : { totalDocs: 0, docs: [] },
      ),
    });
    const err = await documentBeforeDelete({ req: req(db), id: "d1" } as never).catch((e) => e);
    expect((err as { status?: number }).status).toBe(400);
    expect((err as { isPublic?: boolean }).isPublic).toBe(true);
  });

  it("lets an unreferenced document through", async () => {
    const db = P();
    await expect(
      documentBeforeDelete({ req: req(db), id: "d1" } as never),
    ).resolves.toBeUndefined();
  });
});

describe("the collection is wired to it", () => {
  const src = readFileSync(
    join(__dirname, "..", "apps", "dashboard", "src", "collections", "Documents.ts"),
    "utf8",
  );

  it("Documents runs the guard before anything is removed", () => {
    expect(src).toMatch(/beforeDelete: \[documentBeforeDelete\]/);
  });

  it("delete access is unchanged — this adds a guard, not a policy", () => {
    // Narrowing canManageAssets would be an RBAC decision, which is not mine.
    expect(src).toMatch(/delete: canManageAssets/);
  });
});

describe("the rule this enforces is the repository's own", () => {
  const SRC = join(__dirname, "..", "apps", "dashboard", "src");

  it("Invoices already declares itself a statutory, non-deletable record", () => {
    // If this ever stops being true, the justification for the guard changes
    // and someone should revisit it deliberately.
    const src = readFileSync(join(SRC, "collections", "Invoices.ts"), "utf8");
    expect(src).toMatch(/[Ss]tatutory/);
    expect(src).toMatch(/delete: isSuperAdmin/);
  });

  it("Documents delete is genuinely wider than Invoices delete", () => {
    // The whole reason the back door existed.
    const docs = readFileSync(join(SRC, "collections", "Documents.ts"), "utf8");
    expect(docs).toMatch(/delete: canManageAssets/);
    const access = readFileSync(join(SRC, "access", "index.ts"), "utf8");
    const at = access.indexOf("export const canManageAssets");
    expect(access.slice(at, at + 260)).toMatch(/marketing/);
  });
});
