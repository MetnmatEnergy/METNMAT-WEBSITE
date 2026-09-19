import type { CollectionBeforeOperationHook } from "payload";
import { derivePassword, PIN_REGEX } from "../lib/pin";

/**
 * Make a PIN change actually change the login credential — and ONLY a PIN
 * change the caller actually sent.
 *
 * THE FIRST BUG (2026-09-04). Staff sign in with a 4-digit PIN, and the
 * account's real Payload password is an HMAC of that PIN (see lib/pin.ts).
 * `Users.beforeChange` set `data.password` from the PIN — which works on
 * CREATE and is dead code on UPDATE. Verified against the installed Payload,
 * in `collections/operations/utilities/update.js`:
 *
 *     line  26   const password = data?.password           // snapshot AT ENTRY
 *     line  30   const shouldSavePassword = Boolean(password && ...)
 *     line 125   collection beforeChange hooks run          // 99 lines later
 *     line 239   if (shouldSavePassword && ...) → hashes the ENTRY SNAPSHOT
 *
 * So the value a beforeChange hook assigns is never read. `create.js` reads the
 * password AFTER its hooks (registerLocalStrategy), which is exactly why
 * creating an account with a PIN worked and changing one never did.
 *
 * THE FIX for that: `beforeOperation` runs BEFORE the entry snapshot, and its
 * return value replaces the operation's arguments (`buildBeforeOperation`
 * assigns `newArgs = hookResult`), so the derived password is injected here.
 *
 * THE SECOND BUG (2026-09-19). Accounts migrated from the days when the PIN
 * was stored in the clear still carry that column in MongoDB. `pin` is a
 * virtual field now, but Payload's field-level beforeValidate pass back-fills
 * any field absent from an update with the STORED value (getFallbackValue
 * prefers siblingDoc) — and the mongoose adapter's lean reads hand it the raw
 * document, stale column included. Every update that omitted `pin` — the
 * director bootstrap's "preserve" save on each boot, an admin editing the
 * name — therefore arrived at Users.beforeChange with `data.pin` set to the
 * OLD cleartext PIN, which rewrote the lookup to it. The director's PIN
 * reverted to its June value on every restart; the 2026-09-04 lockout was this
 * too, misread at the time as the unconditional write alone.
 *
 * THE FIX for that: this hook sees the caller's data BEFORE the back-fill and
 * records on the request context whether a PIN was genuinely supplied.
 * Users' beforeValidate/beforeChange act on `pin` only when it was. Belt and
 * braces: the seed also purges the stale column (migratePinsOutOfCleartext).
 *
 * WHY NOT JUST PASS `password` AT EVERY CALL SITE. Because the admin UI is a
 * call site too, and it sends whatever the PIN field contains. A hook is the
 * only place that covers the editor, the seed bootstrap and the REST API alike.
 */

/** Context flag: the caller of this operation sent a well-formed PIN. */
export const PIN_PROVIDED = "pinProvided";

/**
 * The password to inject for a given update payload, or null when the payload
 * does not set a PIN. Pure, so the rule is testable without a running CMS.
 *
 * A blank or malformed PIN yields null rather than throwing: `beforeValidate`
 * already rejects those with a message aimed at the person typing, and this
 * hook runs first. Deriving from a bad value here would be worse than doing
 * nothing — it would set a credential nobody could reproduce.
 */
export function pinPasswordInjection(data: unknown): { password: string } | null {
  if (!data || typeof data !== "object") return null;
  const pin = (data as { pin?: unknown }).pin;
  if (pin == null || pin === "") return null;
  const candidate = String(pin);
  if (!PIN_REGEX.test(candidate)) return null;
  return { password: derivePassword(candidate) };
}

/** Whether the request that is running this hook chain supplied a PIN. */
export function pinWasProvided(req: { context?: Record<string, unknown> } | undefined): boolean {
  return req?.context?.[PIN_PROVIDED] === true;
}

/**
 * Record whether a PIN was supplied, and on update inject the derived password
 * early enough for Payload to hash it.
 *
 * Creates get the flag but not the injection — `create.js` reads the password
 * after its own hooks, and re-deriving here would duplicate that path for no
 * gain.
 */
export const syncPinPassword: CollectionBeforeOperationHook = ({ args, context, operation, req }) => {
  if (operation !== "update" && operation !== "create") return args;
  const injection = pinPasswordInjection((args as { data?: unknown })?.data);
  const ctx = context ?? req?.context ?? (args as { req?: { context?: Record<string, unknown> } })?.req?.context;
  if (ctx) (ctx as Record<string, unknown>)[PIN_PROVIDED] = injection !== null;
  if (operation !== "update" || !injection) return args;
  return {
    ...args,
    data: { ...((args as { data?: Record<string, unknown> }).data ?? {}), ...injection },
  };
};
