import { describe, it, expect } from "vitest";
import {
  quotationBeforeChange,
  taskBeforeChange,
  returnBeforeChange,
  enquiryBeforeChange,
} from "../apps/dashboard/src/hooks/workflow-gates";

// Hooks are typed for Payload; in tests we pass minimal mock args.
const call = (fn: unknown, args: Record<string, unknown>) =>
  (fn as (a: unknown) => Promise<unknown>)({ operation: "update", req: { user: { roles: ["sales"] } }, ...args });

describe("quotationBeforeChange", () => {
  it("blocks sending a quotation that isn't approved", async () => {
    await expect(
      call(quotationBeforeChange, { data: { status: "sent" }, originalDoc: { status: "draft" } }),
    ).rejects.toThrow(/approved/i);
  });

  it("blocks sending an approved quotation with no PDF", async () => {
    await expect(
      call(quotationBeforeChange, { data: { status: "sent" }, originalDoc: { status: "approved" } }),
    ).rejects.toThrow(/PDF/i);
  });

  it("allows sending an approved quotation with a PDF and stamps sentAt", async () => {
    const r = (await call(quotationBeforeChange, {
      data: { status: "sent", quotationFile: "doc1" },
      originalDoc: { status: "approved" },
    })) as { sentAt?: string };
    expect(r.sentAt).toBeTruthy();
  });

  it("blocks approval by a non-accounts user", async () => {
    await expect(
      call(quotationBeforeChange, {
        req: { user: { roles: ["sales"] } },
        data: { status: "approved" },
        originalDoc: { status: "internal-review" },
      }),
    ).rejects.toThrow(/Accounts\/Admin/i);
  });

  it("allows approval by accounts", async () => {
    await expect(
      call(quotationBeforeChange, {
        req: { user: { roles: ["accounts"] } },
        data: { status: "approved" },
        originalDoc: { status: "internal-review" },
      }),
    ).resolves.toBeTruthy();
  });
});

describe("taskBeforeChange", () => {
  it("blocks marking Done with no completion note", async () => {
    await expect(
      call(taskBeforeChange, { data: { status: "done" }, originalDoc: { status: "pending" } }),
    ).rejects.toThrow(/completion note/i);
  });

  it("allows Done with a completion note", async () => {
    await expect(
      call(taskBeforeChange, { data: { status: "done", completionNote: "shipped" }, originalDoc: { status: "pending" } }),
    ).resolves.toBeTruthy();
  });

  it("blocks a quotation task Done without a linked quotation", async () => {
    await expect(
      call(taskBeforeChange, {
        data: { status: "done", completionNote: "x", taskType: "quotation" },
        originalDoc: { status: "pending" },
      }),
    ).rejects.toThrow(/quotation/i);
  });
});

describe("returnBeforeChange", () => {
  it("blocks resolving a return with no resolution note", async () => {
    await expect(
      call(returnBeforeChange, { data: { status: "resolved" }, originalDoc: { status: "in-progress" } }),
    ).rejects.toThrow(/resolution/i);
  });

  it("allows resolving with a resolution note", async () => {
    await expect(
      call(returnBeforeChange, { data: { status: "resolved", resolution: "refunded" }, originalDoc: { status: "in-progress" } }),
    ).resolves.toBeTruthy();
  });
});

describe("enquiryBeforeChange (RFQ gates)", () => {
  it("blocks 'quotation-sent' without a quotation", async () => {
    await expect(
      call(enquiryBeforeChange, { data: { status: "quotation-sent" }, originalDoc: { status: "pricing-pending" } }),
    ).rejects.toThrow(/quotation/i);
  });

  it("allows 'quotation-sent' with a quotation reference", async () => {
    await expect(
      call(enquiryBeforeChange, {
        data: { status: "quotation-sent", quotationRef: "Q-123" },
        originalDoc: { status: "pricing-pending" },
      }),
    ).resolves.toBeTruthy();
  });

  it("blocks 'not-feasible' without a technical note", async () => {
    await expect(
      call(enquiryBeforeChange, { data: { status: "not-feasible" }, originalDoc: { status: "technical-review" } }),
    ).rejects.toThrow(/technical note/i);
  });

  it("blocks 'closed' without a reason", async () => {
    await expect(
      call(enquiryBeforeChange, { data: { status: "closed" }, originalDoc: { status: "follow-up-due" } }),
    ).rejects.toThrow(/reason/i);
  });
});
