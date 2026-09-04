import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TICKET_NUMBER_PATTERN,
  formatTicketNumber,
  ticketNumberValidator,
} from "../apps/dashboard/src/lib/ticket-number";
import { ticketNumberBeforeValidate } from "../apps/dashboard/src/hooks/ticket-number";

/**
 * Staff could not raise a support ticket at all.
 *
 * `ticketNumber` was declared `required: true` with `admin.readOnly: true`, and
 * nothing on the server filled it in. That is unsatisfiable from the admin:
 * read-only means the box cannot be typed into, required means an empty box is
 * refused, and the refusal happens in the BROWSER —
 *
 *   payload/dist/fields/validations.js  (text)
 *     if (required) { if (!value || value.length === 0) return t('validation:required') }
 *   @payloadcms/ui/dist/forms/Form/index.js:285
 *     if (!isValid_2) { errorToast(t('error:correctInvalidFields')); ... return }
 *
 * — so the request never reached the server and no hook could have rescued it.
 *
 * This is the same defect already fixed for slugs on five collections, and
 * Tickets is the severe form of it. A collection with `versions.drafts` has an
 * escape hatch: Save draft submits with `skipValidation: true`, so staff can
 * save, watch the value appear, and publish. Tickets has NO versions key, so it
 * renders a plain Save button that validates. Every attempt refused, with no
 * other button to press.
 *
 * The public flow never hit this because the website supplies its own number
 * (`apps/website/src/app/api/support/route.ts:79`) over the internal key. Only
 * the admin path was dead, which is why it stayed hidden.
 *
 * THE FIX, in the shape the slug fix established. A custom `validate` REPLACES
 * the built-in text validator rather than running beside it, so `required: true`
 * stays declared and truthful while a blank is accepted on create and filled in
 * by the server. The number is then immutable: it is printed on the customer's
 * confirmation email and is how they look the ticket up, so it must not drift
 * after the fact.
 */

const RE_FROM_WEBSITE = /TKT-\$\{ymd\}-\$\{crypto\.randomUUID\(\)\.slice\(0, 4\)\.toUpperCase\(\)\}/;

describe("the generated number matches the one customers already receive", () => {
  it("has the canonical shape", () => {
    expect(formatTicketNumber(new Date(2026, 8, 5), "a1b2")).toBe("TKT-20260905-A1B2");
  });

  it("pads single-digit months and days, as the website does", () => {
    expect(formatTicketNumber(new Date(2026, 0, 7), "00ff")).toBe("TKT-20260107-00FF");
  });

  it("uppercases and truncates the random suffix to four characters", () => {
    expect(formatTicketNumber(new Date(2026, 8, 5), "abcdef12")).toBe("TKT-20260905-ABCD");
  });

  it("the pattern accepts what the formatter produces", () => {
    expect(TICKET_NUMBER_PATTERN.test(formatTicketNumber(new Date(2026, 8, 5), "a1b2"))).toBe(true);
  });

  it("the website still builds the number this pattern describes", () => {
    // The two apps cannot share a module, so they share a shape instead. If the
    // website's format ever changes, this fails here rather than quietly
    // producing two kinds of ticket number that staff have to tell apart.
    const src = readFileSync(
      join(__dirname, "..", "apps/website/src/app/api/support/route.ts"),
      "utf8",
    );
    expect(src).toMatch(RE_FROM_WEBSITE);
    expect(src).toMatch(/const ymd = `\$\{now\.getFullYear\(\)\}/);
  });
});

describe("the form can be submitted, and cannot be submitted with rubbish", () => {
  const validate = ticketNumberValidator();

  it("a blank is accepted on create — the server fills it in", () => {
    // The whole blocker in one assertion. Before the fix the built-in text
    // validator refused this in the browser and the save never happened.
    expect(validate("", { operation: "create" })).toBe(true);
    expect(validate(undefined, { operation: "create" })).toBe(true);
    expect(validate("   ", { operation: "create" })).toBe(true);
  });

  it("a number supplied by the website is accepted verbatim", () => {
    expect(validate("TKT-20260905-A1B2", { operation: "create" })).toBe(true);
  });

  it("a malformed number is refused, and the message says what is wanted", () => {
    const msg = validate("hello", { operation: "create" });
    expect(typeof msg).toBe("string");
    expect(String(msg)).toMatch(/TKT-/);
  });

  it("an existing ticket with a legacy number can still be edited", () => {
    // The trap in policing the shape: tickets raised before this existed must
    // stay workable. The number is pinned on update anyway, so validating it
    // again would only ever lock staff out of a ticket they need to answer.
    expect(validate("TICKET/2024/07/11", { operation: "update" })).toBe(true);
    expect(validate("", { operation: "update" })).toBe(true);
  });
});

type Ticket = { id?: string; ticketNumber?: string };

const fakeReq = (existing: string[] = []) => {
  const find = vi.fn(async (args: { where?: Record<string, unknown> }) => {
    const wanted = (args.where?.ticketNumber as { equals?: string } | undefined)?.equals;
    return { docs: existing.filter((n) => n === wanted).map((n) => ({ ticketNumber: n })) };
  });
  const warn = vi.fn();
  return {
    req: { payload: { find, logger: { warn, error: vi.fn() } } },
    find,
    warn,
  };
};

const run = async (
  data: Record<string, unknown>,
  operation: "create" | "update",
  req: unknown,
  originalDoc?: Ticket,
) => {
  const out = await ticketNumberBeforeValidate({ data, operation, originalDoc, req } as never);
  return (out ?? data) as Record<string, unknown>;
};

describe("creating a ticket from the admin", () => {
  it("fills in a number when the field was left empty", async () => {
    const { req } = fakeReq();
    const data = await run({ subject: "Damaged on arrival" }, "create", req);
    expect(TICKET_NUMBER_PATTERN.test(String(data.ticketNumber))).toBe(true);
  });

  it("keeps the number the website supplied — the public flow is untouched", async () => {
    const { req, find } = fakeReq();
    const data = await run({ ticketNumber: "TKT-20260905-A1B2" }, "create", req);
    expect(data.ticketNumber).toBe("TKT-20260905-A1B2");
    expect(find, "a supplied number needs no collision search").not.toHaveBeenCalled();
  });

  it("treats a whitespace-only number as absent", async () => {
    const { req } = fakeReq();
    const data = await run({ ticketNumber: "   " }, "create", req);
    expect(TICKET_NUMBER_PATTERN.test(String(data.ticketNumber))).toBe(true);
  });

  it("draws again when the number it picked is already taken", async () => {
    // `unique: true` means a collision is a failed save, and for a customer
    // raising a ticket that is a lost request. Four hex characters is 65536 a
    // day, so collisions are rare rather than impossible — the retry is what
    // makes rare acceptable, and the unique index remains the backstop.
    //
    // The first search reports a hit and the second does not, so the retry is
    // exercised deterministically rather than left to the odds.
    let calls = 0;
    const find = vi.fn(async () => ({ docs: ++calls === 1 ? [{ ticketNumber: "taken" }] : [] }));
    const req = { payload: { find, logger: { warn: vi.fn(), error: vi.fn() } } };
    const data = await run({ subject: "x" }, "create", req);
    expect(find, "the first draw collided and must not have been kept").toHaveBeenCalledTimes(2);
    expect(TICKET_NUMBER_PATTERN.test(String(data.ticketNumber))).toBe(true);
  });

  it("gives up after a bounded number of attempts rather than looping forever", async () => {
    // If every draw collides something is wrong with the search, not with the
    // numbers. Issuing one and letting the unique index arbitrate is better
    // than hanging the request that is trying to raise a ticket.
    const find = vi.fn(async () => ({ docs: [{ ticketNumber: "taken" }] }));
    const req = { payload: { find, logger: { warn: vi.fn(), error: vi.fn() } } };
    const data = await run({ subject: "x" }, "create", req);
    expect(find.mock.calls.length).toBeLessThanOrEqual(10);
    expect(TICKET_NUMBER_PATTERN.test(String(data.ticketNumber))).toBe(true);
  });

  it("still produces a number if the collision search cannot run", async () => {
    // A ticket with a number the index may reject beats no ticket at all: the
    // customer's request is the thing being protected here.
    const { req, warn } = fakeReq();
    req.payload.find = vi.fn(async () => {
      throw new Error("tickets unavailable");
    });
    const data = await run({ subject: "x" }, "create", req);
    expect(TICKET_NUMBER_PATTERN.test(String(data.ticketNumber))).toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});

describe("the number cannot be changed once issued", () => {
  it("an attempt to overwrite it on update is discarded", async () => {
    // It is printed on the customer's confirmation email and is how they look
    // the ticket up. Editing it silently orphans them from their own ticket.
    const { req } = fakeReq();
    const data = await run({ ticketNumber: "TKT-19700101-0000", status: "resolved" }, "update", req, {
      id: "t1",
      ticketNumber: "TKT-20260905-A1B2",
    });
    expect(data.ticketNumber).toBe("TKT-20260905-A1B2");
  });

  it("an ordinary update that does not mention the number is left alone", async () => {
    const { req } = fakeReq();
    const data = await run({ status: "closed" }, "update", req, {
      id: "t1",
      ticketNumber: "TKT-20260905-A1B2",
    });
    expect(data.status).toBe("closed");
    expect("ticketNumber" in data).toBe(false);
  });

  it("a stored number is never replaced by a generated one on update", async () => {
    const { req } = fakeReq();
    const data = await run({ ticketNumber: "" }, "update", req, {
      id: "t1",
      ticketNumber: "TKT-20260905-A1B2",
    });
    expect(data.ticketNumber).toBe("TKT-20260905-A1B2");
  });
});

describe("the collection is wired to use all of this", () => {
  const src = readFileSync(
    join(__dirname, "..", "apps/dashboard/src/collections/Tickets.ts"),
    "utf8",
  );

  it("the hook runs before validation, where it can still fill the field", () => {
    expect(src).toMatch(/beforeValidate: \[ticketNumberBeforeValidate\]/);
  });

  it("the field carries the custom validator that replaces the built-in one", () => {
    expect(src).toMatch(/validate: ticketNumberValidator\(\)/);
  });

  it("the field is still required and still unique", () => {
    // The fix must not have bought a working form by weakening the guarantee.
    expect(src).toMatch(/name: "ticketNumber"[\s\S]{0,220}?required: true/);
    expect(src).toMatch(/name: "ticketNumber"[\s\S]{0,220}?unique: true/);
  });

  it("Tickets still has no versions, which is why validation had no escape hatch", () => {
    expect(src).not.toMatch(/\n {2}versions:/);
  });
});
