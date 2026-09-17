import { describe, it, expect, vi } from "vitest";
import { normalizeEnquiryEmail } from "../apps/dashboard/src/hooks/enquiry-email";
import { Enquiries } from "../apps/dashboard/src/collections/Enquiries";
import { lowercaseEnquiryEmails } from "../apps/dashboard/src/seed";

/**
 * The account page reads a customer's RFQ history by EXACT email equality (the
 * CMS read gate for the website key allows only that operator) against the
 * lower-cased account address. So the stored address must be lower-case on
 * every path that writes it: the website form (its validator), staff edits (this
 * hook) and the rows that predate both (the one-shot in seed.ts).
 */

const hook = (data: unknown, operation: "create" | "update" = "create") =>
  (normalizeEnquiryEmail as unknown as (a: unknown) => unknown)({ data, operation, req: {} });

describe("normalizeEnquiryEmail (beforeChange)", () => {
  it("lower-cases and trims on create and on update", () => {
    expect(hook({ email: "  Jane@Lab.Example " })).toEqual({ email: "jane@lab.example" });
    expect(hook({ email: "JANE@LAB.EXAMPLE", name: "Jane" }, "update")).toEqual({
      email: "jane@lab.example",
      name: "Jane",
    });
  });

  it("hands back the same object when there is nothing to change", () => {
    const already = { email: "jane@lab.example" };
    expect(hook(already)).toBe(already);
    const partial = { status: "won" }; // an update that does not touch email
    expect(hook(partial, "update")).toBe(partial);
    expect(hook(undefined)).toBeUndefined();
    const junk = { email: 42 };
    expect(hook(junk)).toBe(junk);
  });

  it("runs right after the public-create strip, before the reference and the gates", () => {
    expect(Enquiries.hooks?.beforeChange?.[1]).toBe(normalizeEnquiryEmail);
    expect(Enquiries.hooks?.beforeChange).toHaveLength(4);
  });
});

/** A fake Payload exposing only what the migration touches. */
function fakePayload(rows: Array<{ _id: string; email?: string }>, opts: { failFind?: boolean; modified?: (id: string) => number } = {}) {
  const updates: Array<{ filter: Record<string, unknown>; update: Record<string, unknown> }> = [];
  const logs: string[] = [];
  const Enquiries = {
    find: (filter: Record<string, unknown>) => ({
      lean: async () => {
        if (opts.failFind) throw new Error("boom");
        // Emulate Mongo's case-sensitive [A-Z] regex on the fake rows.
        expect(filter).toEqual({ email: { $regex: "[A-Z]" } });
        return rows.filter((r) => typeof r.email === "string" && /[A-Z]/.test(r.email));
      },
    }),
    updateOne: async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      updates.push({ filter, update });
      return { modifiedCount: opts.modified ? opts.modified(String(filter._id)) : 1 };
    },
  };
  const payload = {
    db: { collections: { enquiries: Enquiries } },
    logger: { info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m) },
  };
  return { payload: payload as never, updates, logs };
}

describe("lowercaseEnquiryEmails (one-shot in seed.ts)", () => {
  it("lower-cases only rows with upper-case letters, conditionally on the value it read", async () => {
    const { payload, updates, logs } = fakePayload([
      { _id: "a", email: "Jane@Lab.Example" },
      { _id: "b", email: "already@lower.example" },
      { _id: "c", email: "  MIXED@Case.Example " },
    ]);
    await lowercaseEnquiryEmails(payload);
    expect(updates).toEqual([
      { filter: { _id: "a", email: "Jane@Lab.Example" }, update: { $set: { email: "jane@lab.example" } } },
      { filter: { _id: "c", email: "  MIXED@Case.Example " }, update: { $set: { email: "mixed@case.example" } } },
    ]);
    expect(logs.join("\n")).toMatch(/Lower-cased 2\/2/);
  });

  it("is a silent no-op once every row is lower-case", async () => {
    const { payload, updates, logs } = fakePayload([{ _id: "b", email: "already@lower.example" }]);
    await lowercaseEnquiryEmails(payload);
    expect(updates).toEqual([]);
    expect(logs).toEqual([]);
  });

  it("counts a lost race (modifiedCount 0) as not fixed and leaves it for the next boot", async () => {
    const { payload, logs } = fakePayload([{ _id: "a", email: "Jane@Lab.Example" }], { modified: () => 0 });
    await lowercaseEnquiryEmails(payload);
    expect(logs.join("\n")).toMatch(/Lower-cased 0\/1/);
  });

  it("skips with a warning, never throws, when the query fails", async () => {
    const { payload, updates, logs } = fakePayload([{ _id: "a", email: "Jane@Lab.Example" }], { failFind: true });
    await expect(lowercaseEnquiryEmails(payload)).resolves.toBeUndefined();
    expect(updates).toEqual([]);
    expect(logs.join("\n")).toMatch(/skipped/);
  });

  it("does nothing without the enquiries collection (fresh database, wrong adapter)", async () => {
    const info = vi.fn();
    await lowercaseEnquiryEmails({ db: { collections: {} }, logger: { info, warn: info } } as never);
    expect(info).not.toHaveBeenCalled();
  });
});
