import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetVerificationOnEmailChange } from "../apps/dashboard/src/hooks/customer-email-change";
import { protectPrivilegedStaff } from "../apps/dashboard/src/hooks/staff-account-guard";
import { stripInternalOnPublicCreate, STAFF_ONLY_ENQUIRY_FIELDS } from "../apps/dashboard/src/hooks/enquiry-public-create";
import { internalOnly } from "../apps/dashboard/src/access";
import { Customers } from "../apps/dashboard/src/collections/Customers";
import { Users } from "../apps/dashboard/src/collections/Users";
import { Enquiries } from "../apps/dashboard/src/collections/Enquiries";
import { EnquiryUploads } from "../apps/dashboard/src/collections/EnquiryUploads";

/**
 * Regression tests for the 2026-09-17 security audit's CMS fixes. Each block
 * names the attack it closes; the negative cases are the ones that matter.
 */

type Hook = (a: Record<string, unknown>) => unknown;
const run = (hook: unknown, args: Record<string, unknown>) => (hook as Hook)(args);

const customerReq = { user: { id: "c1", collection: "customers" } };
const staffReq = (roles: string[], id = "u1") => ({ user: { id, collection: "users", roles } });

describe("a customer who changes their email is no longer verified", () => {
  // register -> reset own password (verified) -> PATCH email to a guest buyer's
  // address -> the account page lists the victim's orders and invoices.
  it("resets emailVerified and signs every device out when a customer changes their own email", () => {
    const out = run(resetVerificationOnEmailChange, {
      operation: "update",
      req: customerReq,
      originalDoc: { id: "c1", email: "me@example.com", emailVerified: true },
      data: { email: "victim@example.com" },
    }) as Record<string, unknown>;
    expect(out.emailVerified).toBe(false);
    expect(typeof out.sessionsValidFrom).toBe("number");
  });

  it("treats a case-only change as the same address", () => {
    const data = { email: "Me@Example.com" };
    const out = run(resetVerificationOnEmailChange, {
      operation: "update",
      req: customerReq,
      originalDoc: { email: "me@example.com", emailVerified: true },
      data,
    });
    expect(out).toBe(data);
    expect((out as Record<string, unknown>).emailVerified).toBeUndefined();
  });

  it("leaves staff corrections, creates and unrelated updates alone", () => {
    const staffPatch = { email: "fixed@example.com" };
    expect(
      run(resetVerificationOnEmailChange, {
        operation: "update",
        req: staffReq(["admin"]),
        originalDoc: { email: "typo@example.com" },
        data: staffPatch,
      })
    ).toBe(staffPatch);
    const create = { email: "new@example.com" };
    expect(run(resetVerificationOnEmailChange, { operation: "create", req: customerReq, data: create })).toBe(create);
    const noEmail = { name: "Jane" };
    expect(
      run(resetVerificationOnEmailChange, { operation: "update", req: customerReq, originalDoc: { email: "me@example.com" }, data: noEmail })
    ).toBe(noEmail);
  });

  it("is wired into the customers collection", () => {
    expect(Customers.hooks?.beforeChange).toContain(resetVerificationOnEmailChange);
  });
});

describe("an admin cannot take over the super-admin", () => {
  const superAdmin = { id: "sa", email: "director@example.com", roles: ["super-admin"] };
  const colleague = { id: "u2", email: "sales@example.com", roles: ["sales"] };

  it("refuses any edit of a super-admin by a non-super-admin", () => {
    expect(() =>
      run(protectPrivilegedStaff, { operation: "update", req: staffReq(["admin"]), originalDoc: superAdmin, data: { password: "x" } })
    ).toThrow(/super-admin/);
    expect(() =>
      run(protectPrivilegedStaff, { operation: "update", req: staffReq(["admin"]), originalDoc: superAdmin, data: { name: "Renamed" } })
    ).toThrow(/super-admin/);
  });

  it("refuses an admin changing a colleague's password or email, but allows other edits", () => {
    expect(() =>
      run(protectPrivilegedStaff, { operation: "update", req: staffReq(["admin"]), originalDoc: colleague, data: { password: "x" } })
    ).toThrow(/email or password/);
    expect(() =>
      run(protectPrivilegedStaff, { operation: "update", req: staffReq(["admin"]), originalDoc: colleague, data: { email: "hijack@example.com" } })
    ).toThrow(/email or password/);
    const roleChange = { customRoles: ["r1"] };
    expect(run(protectPrivilegedStaff, { operation: "update", req: staffReq(["admin"]), originalDoc: colleague, data: roleChange })).toBe(roleChange);
  });

  it("lets a staff member change their own credentials and a super-admin change anyone's", () => {
    const own = { password: "new-one" };
    expect(run(protectPrivilegedStaff, { operation: "update", req: staffReq(["sales"], "u2"), originalDoc: colleague, data: own })).toBe(own);
    const bySuper = { password: "reset-by-director" };
    expect(run(protectPrivilegedStaff, { operation: "update", req: staffReq(["super-admin"]), originalDoc: colleague, data: bySuper })).toBe(bySuper);
  });

  it("ignores creates and system (no-user) paths, and runs first in the users chain", () => {
    const create = { email: "n@example.com", password: "x" };
    expect(run(protectPrivilegedStaff, { operation: "create", req: staffReq(["admin"]), data: create })).toBe(create);
    const system = { password: "x" };
    expect(run(protectPrivilegedStaff, { operation: "update", req: {}, originalDoc: superAdmin, data: system })).toBe(system);
    expect(Users.hooks?.beforeChange?.[0]).toBe(protectPrivilegedStaff);
  });
});

describe("a public enquiry cannot arrive pre-won", () => {
  it("drops every staff-only field and starts the RFQ as new / normal", () => {
    const hostile: Record<string, unknown> = {
      name: "Mallory",
      email: "m@example.com",
      message: "hi",
      status: "won",
      priority: "urgent",
      quoteAmount: 999999,
      internalNotes: "approved by the director",
      assignedSalesOwner: "u1",
      quotation: "q1",
      referenceId: "RFQ-20260917-CHOSEN",
    };
    const out = run(stripInternalOnPublicCreate, { operation: "create", req: {}, data: hostile }) as Record<string, unknown>;
    for (const key of STAFF_ONLY_ENQUIRY_FIELDS) {
      if (key === "status") expect(out.status).toBe("new");
      else if (key === "priority") expect(out.priority).toBe("normal");
      else expect(out).not.toHaveProperty(key);
    }
    expect(out.name).toBe("Mallory");
    expect(out.message).toBe("hi");
  });

  it("leaves staff creates and every update alone", () => {
    const byStaff = { name: "x", status: "quoted", quoteAmount: 5 };
    expect(run(stripInternalOnPublicCreate, { operation: "create", req: staffReq(["sales"]), data: byStaff })).toBe(byStaff);
    const update = { status: "won" };
    expect(run(stripInternalOnPublicCreate, { operation: "update", req: {}, data: update })).toBe(update);
  });

  it("runs first in the enquiries chain, before the reference is minted", () => {
    expect(Enquiries.hooks?.beforeChange?.[0]).toBe(stripInternalOnPublicCreate);
  });
});

describe("enquiry uploads are created by the website server only", () => {
  const KEY = "test-internal-key-abcdef";
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.INTERNAL_API_KEY;
    process.env.INTERNAL_API_KEY = KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = saved;
  });
  const call = (fn: unknown, key: string | null, user: unknown = null) =>
    (fn as (a: unknown) => unknown)({ req: { user, headers: new Headers(key ? { "x-internal-key": key } : {}), query: {} } });

  it("the collection's create is the internal-key-only gate", () => {
    expect((EnquiryUploads.access as Record<string, unknown>).create).toBe(internalOnly);
  });

  it("accepts the website's key and nothing else, not even staff", () => {
    expect(call(internalOnly, KEY)).toBe(true);
    expect(call(internalOnly, null)).toBe(false);
    expect(call(internalOnly, "wrong")).toBe(false);
    expect(call(internalOnly, null, { collection: "users", roles: ["super-admin"] })).toBe(false);
    delete process.env.INTERNAL_API_KEY;
    expect(call(internalOnly, KEY)).toBe(false);
  });
});
