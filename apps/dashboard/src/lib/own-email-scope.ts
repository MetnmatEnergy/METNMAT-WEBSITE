import type { Where } from "payload";

/**
 * Longest address the scope will honour. RFC 5321 caps a mailbox at 254 octets
 * and the website's validator refuses anything longer, so a value past this is
 * not a customer address and there is nothing to scope a read to.
 */
const MAX_EMAIL_LENGTH = 254;

/**
 * The ONE query shape through which the website's internal key may read a
 * customer-keyed collection:
 *
 *   GET /api/<collection>?where[email][equals]=<one address>
 *
 * Payload parses that query string into `req.query`, which arrives here as
 * `{ where: { email: { equals: "<address>" } } }`. This returns the address when
 * the query has exactly that shape and null for anything else, so that:
 *
 *   - no `where` at all (a bare list, or a findByID) reads nothing;
 *   - `like` / `in` / `not_equals` / any other operator reads nothing, since
 *     each of them can match more than one mailbox;
 *   - a non-string value reads nothing. qs turns `equals[]=a&equals[]=b` into
 *     an array and `equals[$ne]=x` into an object; both must be refused before
 *     they are handed to the database as a constraint.
 *
 * Anything ELSE the caller adds to `where` (a status filter, an `or` clause) is
 * safe to ignore: the access layer ANDs the constraint built from this address
 * with the caller's own `where`, so extra clauses can only narrow the result.
 */
export function singleEmailFromQuery(query: unknown): string | null {
  const where = (query as { where?: unknown } | null | undefined)?.where;
  if (!isPlainObject(where)) return null;
  const email = where.email;
  if (!isPlainObject(email)) return null;
  const operators = Object.keys(email);
  if (operators.length !== 1 || operators[0] !== "equals") return null;
  const value = email.equals;
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_EMAIL_LENGTH) return null;
  if (!value.includes("@")) return null;
  return value;
}

/**
 * The read constraint for one address. Returned from an access function in
 * place of `true`, which is Payload's convention for "allowed, but only these
 * rows": the operation ANDs it with the request's own `where`.
 */
export function ownEmailConstraint(email: string): Where {
  return { email: { equals: email } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
