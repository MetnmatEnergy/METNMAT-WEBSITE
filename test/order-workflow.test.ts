import { describe, it, expect } from "vitest";
import { orderBeforeChange } from "../apps/dashboard/src/hooks/order-workflow";

/**
 * Minimal stand-in for `req.payload.db` — Payload always provides this inside a
 * real collection hook. The transition into "paid" mints a sequential invoice
 * number via an atomic counter (`db.collections.counters.findOneAndUpdate` with
 * `$inc`), so the mock returns an incrementing `seq`.
 */
const dbStub = () => {
  let seq = 0;
  return {
    collections: {
      counters: {
        findOneAndUpdate: async () => ({ seq: ++seq }),
      },
    },
  };
};

const call = (args: Record<string, unknown>) => {
  const provided = (args.req as Record<string, unknown> | undefined) ?? {
    headers: new Headers(),
    user: { roles: ["sales"] },
  };
  // A real Payload hook always has req.payload; inject a db stub so the
  // invoice-minting path has the counter model it needs.
  const req = { payload: { db: dbStub() }, ...provided };
  return (orderBeforeChange as unknown as (a: unknown) => Promise<unknown>)({
    operation: "update",
    ...args,
    req,
  });
};

describe("orderBeforeChange (payment integrity)", () => {
  it("blocks a sales user from marking an order paid", async () => {
    await expect(
      call({ data: { status: "paid" }, originalDoc: { status: "pending" } }),
    ).rejects.toThrow(/Accounts\/Admin/i);
  });

  it("blocks an illegal status transition (pending → delivered)", async () => {
    await expect(
      call({ data: { status: "delivered" }, originalDoc: { status: "pending" } }),
    ).rejects.toThrow(/Invalid order status/i);
  });

  it("allows accounts to mark a pending order paid (and mints an invoice number)", async () => {
    const result = (await call({
      req: { headers: new Headers(), user: { roles: ["accounts"] } },
      data: { status: "paid" },
      originalDoc: { status: "pending" },
    })) as { invoiceNumber?: string; invoiceDate?: string };
    expect(result).toBeTruthy();
    // First transition into "paid" assigns the sequential GST invoice serial.
    expect(result.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(result.invoiceDate).toBeTruthy();
  });

  it("reuses an already-minted invoice number (idempotency — no burned GST serial)", async () => {
    // Simulate a concurrent paid-transition: originalDoc is stale (no invoice),
    // but a re-read finds the order was already minted by the racing write.
    const db = dbStub();
    const result = (await call({
      req: {
        headers: new Headers(),
        user: { roles: ["accounts"] },
        payload: { db, findByID: async () => ({ invoiceNumber: "INV-2526-000042" }) },
      },
      data: { status: "paid" },
      originalDoc: { id: "order-1", status: "pending" },
    })) as { invoiceNumber?: string };
    // Reuses the existing serial rather than bumping the counter for a new one.
    expect(result.invoiceNumber).toBe("INV-2526-000042");
  });

  it("blocks a sales user from changing the order total", async () => {
    await expect(
      call({ data: { status: "pending", total: 999 }, originalDoc: { status: "pending", total: 100 } }),
    ).rejects.toThrow(/total/i);
  });

  it("lets the internal-key server transition freely (verified payment) and mints an invoice", async () => {
    process.env.INTERNAL_API_KEY = "test-internal-key";
    const headers = new Headers([["x-internal-key", "test-internal-key"]]);
    const result = (await call({
      req: { headers, user: null },
      data: { status: "paid" },
      originalDoc: { status: "pending" },
    })) as { invoiceNumber?: string };
    expect(result).toBeTruthy();
    expect(result.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
  });
});
