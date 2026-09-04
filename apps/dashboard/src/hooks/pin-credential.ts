import type { CollectionBeforeOperationHook } from "payload";
import { derivePassword, PIN_REGEX } from "../lib/pin";

/**
 * Make a PIN change actually change the login credential.
 *
 * THE BUG. Staff sign in with a 4-digit PIN, and the account's real Payload
 * password is an HMAC of that PIN (see lib/pin.ts). `Users.beforeChange` set
 * `data.password` from the PIN — which works on CREATE and is dead code on
 * UPDATE. Verified against the installed Payload 3.85.1, in
 * `collections/operations/utilities/update.js`:
 *
 *     line  26   const password = data?.password           // snapshot AT ENTRY
 *     line  30   const shouldSavePassword = Boolean(password && ...)
 *     line 125   collection beforeChange hooks run          // 99 lines later
 *     line 239   if (shouldSavePassword && ...) → hashes the ENTRY SNAPSHOT
 *
 * So the value a beforeChange hook assigns is never read. `create.js` reads the
 * password AFTER its hooks (registerLocalStrategy, line 186), which is exactly
 * why creating an account with a PIN worked and changing one never did.
 *
 * The consequence in production: every PIN in this CMS was frozen at the value
 * it was created with. Editing a PIN in the admin UI updated the stored lookup
 * and reported success while the credential stayed exactly as it was — the new
 * PIN could not sign in, and the old one still could. Nothing surfaced an error,
 * because from Payload's point of view nothing failed.
 *
 * THE FIX. `beforeOperation` runs BEFORE the entry snapshot, and its return
 * value replaces the operation's arguments:
 *
 *     updateByID.js:25   args = await buildBeforeOperation({ ... })
 *     updateByID.js:38   const { data } = args        // ← what we just returned
 *     updateByID.js:114  updateDocument({ data: ... }) // ← the snapshot at :26
 *
 * `buildBeforeOperation` assigns `newArgs = hookResult` whenever a hook returns
 * anything, so returning a new args object is the supported way to do this.
 *
 * Payload strips the injected password before it reaches the database
 * (`utilities/update.js:247-248` deletes it from both the write payload and the
 * document once hashed), so nothing new is persisted by this hook.
 *
 * WHY NOT JUST PASS `password` AT EVERY CALL SITE. Because the admin UI is a
 * call site too, and it sends whatever the PIN field contains. A hook is the
 * only place that covers the editor, the seed bootstrap and the REST API alike.
 */

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

/**
 * Inject the derived password early enough for Payload to hash it.
 *
 * Update only. Creates already work — `create.js` reads the password after its
 * hooks — and re-deriving here would duplicate that path for no gain.
 */
export const syncPinPassword: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation !== "update") return args;
  const injection = pinPasswordInjection((args as { data?: unknown })?.data);
  if (!injection) return args;
  return {
    ...args,
    data: { ...((args as { data?: Record<string, unknown> }).data ?? {}), ...injection },
  };
};
