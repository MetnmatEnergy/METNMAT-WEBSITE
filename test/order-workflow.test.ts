import { describe, it, expect } from "vitest";
import { orderBeforeChange } from "../apps/dashboard/src/hooks/order-workflow";

const call = (args: Record<string, unknown>) =>
  (orderBeforeChange as unknown as (a: unknown) => Promise<unknown>)({
    operation: "update",
    req: { headers: new Headers(), user: { roles: ["sales"] } },
    ...args,
  });

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

  it("allows accounts to mark a pending order paid", async () => {
    await expect(
      call({
        req: { headers: new Headers(), user: { roles: ["accounts"] } },
        data: { status: "paid" },
        originalDoc: { status: "pending" },
      }),
    ).resolves.toBeTruthy();
  });

  it("blocks a sales user from changing the order total", async () => {
    await expect(
      call({ data: { status: "pending", total: 999 }, originalDoc: { status: "pending", total: 100 } }),
    ).rejects.toThrow(/total/i);
  });

  it("lets the internal-key server transition freely (verified payment)", async () => {
    process.env.INTERNAL_API_KEY = "test-internal-key";
    const headers = new Headers([["x-internal-key", "test-internal-key"]]);
    await expect(
      call({ req: { headers, user: null }, data: { status: "paid" }, originalDoc: { status: "pending" } }),
    ).resolves.toBeTruthy();
  });
});
