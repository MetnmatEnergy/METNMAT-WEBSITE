import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  internalOwnEmailOrManageSales,
  canManageSales,
  isAdmin,
} from "../apps/dashboard/src/access";
import { singleEmailFromQuery, ownEmailConstraint } from "../apps/dashboard/src/lib/own-email-scope";
import { PLACEHOLDER_SECRET } from "../apps/dashboard/src/lib/internal-key";
import { Enquiries } from "../apps/dashboard/src/collections/Enquiries";

/**
 * The bug these guard against.
 *
 * The website account page read a customer's RFQ history with
 *   GET /api/enquiries?where[email][equals]=<address>   +  x-internal-key
 * but the collection's read gate was canManageSales, which checks the logged-in
 * staff user's role and never looks at the header. Every request was a 403,
 * the website returned [] on !res.ok, and customers saw an empty history.
 * Verified on production 2026-09-17.
 *
 * The fix must NOT be "the key may read enquiries". The shared key has leaked
 * before (the 2026-09 host compromise), and a key that can list a collection of
 * customer specs, quantities and contact details is a data breach waiting for
 * the next leak. So the key path returns a WHERE constraint on the one address
 * the query names, and false for every other query shape. The negative cases
 * are the ones that matter.
 */

const KEY = "test-internal-key-0123456789abcdef";
const EMAIL = "jane@lab.example";

type CallOpts = { key?: string | null; user?: unknown; query?: unknown; id?: string };

/** Drive the access function the way Payload does: headers, user and the parsed query. */
const read = ({ key = null, user = null, query = {}, id }: CallOpts = {}) =>
  (internalOwnEmailOrManageSales as unknown as (a: unknown) => unknown)({
    id,
    req: {
      headers: new Headers(key ? { "x-internal-key": key } : {}),
      user,
      query,
    },
  });

/** What Payload's qs parse of `?where[email][equals]=<v>` looks like in req.query. */
const own = (value: unknown) => ({ where: { email: { equals: value } } });

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.INTERNAL_API_KEY;
  process.env.INTERNAL_API_KEY = KEY;
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.INTERNAL_API_KEY;
  else process.env.INTERNAL_API_KEY = savedKey;
});

describe("singleEmailFromQuery (the one honoured query shape)", () => {
  it("returns the address for exactly where[email][equals]=<string>", () => {
    expect(singleEmailFromQuery(own(EMAIL))).toBe(EMAIL);
  });

  it("returns null when there is no where at all (a bare list or a findByID)", () => {
    expect(singleEmailFromQuery(undefined)).toBeNull();
    expect(singleEmailFromQuery(null)).toBeNull();
    expect(singleEmailFromQuery({})).toBeNull();
    expect(singleEmailFromQuery({ where: {} })).toBeNull();
    expect(singleEmailFromQuery({ where: "email" })).toBeNull();
    expect(singleEmailFromQuery({ where: [] })).toBeNull();
  });

  it("refuses every operator that can match more than one mailbox", () => {
    for (const op of ["like", "contains", "in", "not_equals", "exists", "greater_than"]) {
      expect(singleEmailFromQuery({ where: { email: { [op]: "@" } } }), op).toBeNull();
    }
    // equals plus anything else is still not the one shape.
    expect(singleEmailFromQuery({ where: { email: { equals: EMAIL, like: "@" } } })).toBeNull();
  });

  it("refuses non-string values, which is what qs makes of [] and [$ne] suffixes", () => {
    expect(singleEmailFromQuery(own([EMAIL, "victim@lab.example"]))).toBeNull();
    expect(singleEmailFromQuery(own({ $ne: null }))).toBeNull();
    expect(singleEmailFromQuery(own({ $regex: ".*" }))).toBeNull();
    expect(singleEmailFromQuery(own(42))).toBeNull();
    expect(singleEmailFromQuery(own(true))).toBeNull();
    expect(singleEmailFromQuery(own(null))).toBeNull();
  });

  it("refuses an empty, non-address or oversized value", () => {
    expect(singleEmailFromQuery(own(""))).toBeNull();
    expect(singleEmailFromQuery(own("not-an-address"))).toBeNull();
    expect(singleEmailFromQuery(own(`${"a".repeat(250)}@x.example`))).toBeNull();
  });

  it("refuses an address that is only reachable through an or/and clause", () => {
    expect(singleEmailFromQuery({ where: { or: [own(EMAIL).where] } })).toBeNull();
    expect(singleEmailFromQuery({ where: { and: [own(EMAIL).where] } })).toBeNull();
  });

  it("ignores sibling filters: they are ANDed by Payload and can only narrow", () => {
    expect(
      singleEmailFromQuery({ where: { email: { equals: EMAIL }, status: { equals: "won" } } })
    ).toBe(EMAIL);
  });

  it("builds the constraint Payload ANDs with the caller's where", () => {
    expect(ownEmailConstraint(EMAIL)).toEqual({ email: { equals: EMAIL } });
  });
});

describe("internalOwnEmailOrManageSales: the website server path", () => {
  it("grants a CONSTRAINT on the named address, never true", () => {
    const result = read({ key: KEY, query: own(EMAIL) });
    expect(result).toEqual({ email: { equals: EMAIL } });
    expect(result).not.toBe(true);
  });

  it("refuses to list the collection: the key with no address reads nothing", () => {
    expect(read({ key: KEY })).toBe(false);
    expect(read({ key: KEY, query: { where: {} } })).toBe(false);
    expect(read({ key: KEY, query: { limit: 1000, depth: 0 } })).toBe(false);
  });

  it("refuses a fetch by id, which names a row but not an owner", () => {
    expect(read({ key: KEY, id: "507f1f77bcf86cd799439011" })).toBe(false);
  });

  it("refuses widening operators and multi-address values", () => {
    expect(read({ key: KEY, query: { where: { email: { like: "@" } } } })).toBe(false);
    expect(read({ key: KEY, query: own([EMAIL, "victim@lab.example"]) })).toBe(false);
    expect(read({ key: KEY, query: own({ $ne: null }) })).toBe(false);
    expect(read({ key: KEY, query: { where: { or: [own(EMAIL).where] } } })).toBe(false);
  });

  it("refuses a wrong key even with a well-formed query", () => {
    expect(read({ key: "not-the-key", query: own(EMAIL) })).toBe(false);
    // Near misses: one character off, one character extra, a prefix.
    expect(read({ key: `${KEY.slice(0, -1)}X`, query: own(EMAIL) })).toBe(false);
    expect(read({ key: `${KEY}0`, query: own(EMAIL) })).toBe(false);
    expect(read({ key: KEY.slice(0, -1), query: own(EMAIL) })).toBe(false);
    expect(read({ key: null, query: own(EMAIL) })).toBe(false);
  });

  it("refuses the committed placeholder on either side (fail closed, not open)", () => {
    process.env.INTERNAL_API_KEY = PLACEHOLDER_SECRET;
    expect(read({ key: PLACEHOLDER_SECRET, query: own(EMAIL) })).toBe(false);
    delete process.env.INTERNAL_API_KEY;
    expect(read({ key: PLACEHOLDER_SECRET, query: own(EMAIL) })).toBe(false);
  });

  it("refuses everything when the server has no key configured", () => {
    delete process.env.INTERNAL_API_KEY;
    expect(read({ key: KEY, query: own(EMAIL) })).toBe(false);
    expect(read({ key: "", query: own(EMAIL) })).toBe(false);
  });

  it("gives a storefront customer nothing, key or not", () => {
    const shopper = { collection: "customers", id: "c1", role: "researcher", email: EMAIL };
    expect(read({ user: shopper, query: own(EMAIL) })).toBe(false);
    expect(read({ user: shopper })).toBe(false);
  });
});

describe("internalOwnEmailOrManageSales: the staff path is unchanged", () => {
  const staff = (...roles: string[]) => ({ collection: "users", id: "u1", roles });

  it("every canManageSales role still reads everything, with no key and no where", () => {
    for (const role of ["super-admin", "admin", "operations-manager", "marketing", "sales"]) {
      expect(read({ user: staff(role) }), role).toBe(true);
    }
    expect(read({ user: { collection: "users", roles: [], customRoles: [{ isActive: true, areas: ["sales"] }] } })).toBe(true);
  });

  it("staff outside the sales family are refused, exactly as before", () => {
    for (const role of ["accounts", "support", "inventory", "technical", "read-only-auditor"]) {
      expect(read({ user: staff(role) }), role).toBe(false);
    }
    expect(read({ user: null })).toBe(false);
  });

  it("a staff read is not narrowed by a where the admin list view happens to send", () => {
    expect(read({ user: staff("sales"), query: own(EMAIL) })).toBe(true);
  });
});

/**
 * A helper existing is not the same as a collection using it. These run against
 * the real collection config so that a least-privilege sweep cannot quietly
 * restore canManageSales as the reader (and re-open the 403), and so that the
 * fix cannot drift into widening create/update/delete.
 */
describe("the enquiries collection is wired to the scoped gate and nothing else moved", () => {
  const access = Enquiries.access as Record<string, unknown>;
  const call = (fn: unknown, user: unknown) =>
    (fn as (a: { req: { user: unknown; headers: Headers; query: unknown } }) => unknown)({
      req: { user, headers: new Headers(), query: {} },
    });

  it("read goes through internalOwnEmailOrManageSales", () => {
    expect(access.read).toBe(internalOwnEmailOrManageSales);
  });

  it("create stays public: the website form submits anonymously", () => {
    expect(call(access.create, null)).toBe(true);
  });

  it("update stays with the sales family and delete with admins", () => {
    expect(access.update).toBe(canManageSales);
    expect(access.delete).toBe(isAdmin);
  });
});
