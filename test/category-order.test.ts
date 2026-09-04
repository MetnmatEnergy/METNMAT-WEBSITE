import { describe, it, expect } from "vitest";
import type { PayloadRequest } from "payload";
import { Categories } from "../apps/dashboard/src/collections/Categories";
import {
  FALLBACK_ORDER,
  FIRST_ORDER,
  nextCategoryOrder,
  nextOrderAfter,
} from "../apps/dashboard/src/lib/category-order";

/**
 * A staff-created category must land at the END of the shop menu.
 *
 * `order` defaulted to 0 while the seeded departments run 1-11, and the website
 * renders `/api/categories?sort=order` verbatim (mapCategory drops the number,
 * so nothing downstream re-sorts). Creating a category therefore pushed it to
 * the top of the shop grid and the header dropdown, silently.
 *
 * These assert the REAL collection config and the REAL default resolver — not
 * the source text — so the guard survives a reformat and fails on a behaviour
 * change.
 */

/** The highest order among the seeded departments (SHOP_DEPARTMENTS in seed.ts). */
const SEEDED_MAX = 11;

type FindArgs = { collection: string; sort?: unknown; limit?: unknown; depth?: unknown };

function fakeReq(find: (args: FindArgs) => Promise<{ docs: unknown[] }>) {
  const calls: FindArgs[] = [];
  const req = {
    payload: {
      find: (args: FindArgs) => {
        calls.push(args);
        return find(args);
      },
    },
  } as unknown as PayloadRequest;
  return { req, calls };
}

const orderField = (Categories.fields as Array<Record<string, unknown>>).find(
  (f) => f.name === "order"
) as Record<string, unknown>;

/** Resolve whatever the config declares, literal or function, the way Payload does. */
async function resolveConfiguredDefault(req: PayloadRequest): Promise<unknown> {
  const dv = orderField.defaultValue;
  return typeof dv === "function"
    ? await (dv as (a: { req: PayloadRequest; user: unknown; locale?: string }) => unknown)({
        req,
        user: null,
        locale: undefined,
      })
    : dv;
}

describe("a new category's Sort order", () => {
  it("is computed per-create, not a fixed literal", () => {
    expect(orderField).toBeTruthy();
    expect(typeof orderField.defaultValue).toBe("function");
  });

  it("lands AFTER every seeded department instead of ahead of them", async () => {
    const { req } = fakeReq(async () => ({ docs: [{ order: SEEDED_MAX }] }));
    const value = await resolveConfiguredDefault(req);
    // The whole bug in one assertion: 0 is not greater than 11.
    expect(value).toBeGreaterThan(SEEDED_MAX);
    expect(value).toBe(SEEDED_MAX + 1);
  });

  it("asks for the single highest row, not the whole collection", async () => {
    const { req, calls } = fakeReq(async () => ({ docs: [{ order: 4 }] }));
    await nextCategoryOrder(req);
    expect(calls).toHaveLength(1);
    expect(calls[0].collection).toBe("categories");
    expect(calls[0].sort).toBe("-order");
    expect(calls[0].limit).toBe(1);
    expect(calls[0].depth).toBe(0);
  });

  it("starts at 1 when there are no categories at all", async () => {
    const { req } = fakeReq(async () => ({ docs: [] }));
    await expect(nextCategoryOrder(req)).resolves.toBe(FIRST_ORDER);
  });

  it("starts at 1 when every existing row has no order", async () => {
    // Descending sort puts null last, so a null at docs[0] means all are null.
    const { req } = fakeReq(async () => ({ docs: [{ order: null }] }));
    await expect(nextCategoryOrder(req)).resolves.toBe(FIRST_ORDER);
  });

  it("still points at the END when the lookup fails, and never throws", async () => {
    // getFallbackValue does not catch — a throw here would fail the staff save.
    const { req } = fakeReq(async () => {
      throw new Error("mongo unreachable");
    });
    await expect(nextCategoryOrder(req)).resolves.toBe(FALLBACK_ORDER);
    expect(FALLBACK_ORDER).toBeGreaterThan(SEEDED_MAX);
  });

  it("does not fall back to the front when there is no request", async () => {
    await expect(nextCategoryOrder(undefined)).resolves.toBeGreaterThan(SEEDED_MAX);
  });

  it("follows the maximum, whatever it is", () => {
    expect(nextOrderAfter(11)).toBe(12);
    expect(nextOrderAfter(0)).toBe(1);
    expect(nextOrderAfter(-3)).toBe(-2);
    expect(nextOrderAfter(2.4)).toBe(3);
    expect(nextOrderAfter(undefined)).toBe(FIRST_ORDER);
    expect(nextOrderAfter("7")).toBe(FIRST_ORDER);
    expect(nextOrderAfter(Number.NaN)).toBe(FIRST_ORDER);
  });

  it("cannot be cleared back to an empty value", () => {
    expect(orderField.required).toBe(true);
  });
});

describe("the Categories list view shows menu order", () => {
  it("sorts by order", () => {
    // Top-level, not under `admin`. Payload 3.85 declares defaultSort on the
    // collection config itself (collections/config/types.d.ts:490); the plan for
    // this change put it in `admin`, where it type-errors and does nothing.
    expect(Categories.defaultSort).toBe("order");
    expect((Categories.admin as Record<string, unknown>)?.defaultSort).toBeUndefined();
  });

  it("shows the number that decides the menu", () => {
    expect(Categories.admin?.defaultColumns).toContain("order");
  });
});
