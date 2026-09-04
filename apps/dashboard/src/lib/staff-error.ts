import { APIError } from "payload";

/**
 * A refusal the person in the admin is meant to read.
 *
 * THE BUG THIS FIXES. Every guard in this CMS threw a bare `Error` carrying a
 * carefully written explanation — "Attach the quotation PDF before marking it
 * Sent", "That PIN is already in use", the category-delete refusal naming how
 * many products still point at it. None of them ever reached a screen. Payload
 * replaces the message of any error it does not consider public, and a plain
 * Error is never public. Verified in the installed payload@3.85.1:
 *
 *   utilities/routeError.js:50
 *     if (!isErrorPublic(err, config)) {
 *       response = formatErrors(new APIError('Something went wrong.'))
 *     }
 *
 *   utilities/isErrorPublic.js
 *     config.debug           → public
 *     err.isPublic === true  → public
 *     err.isPublic === false → not public
 *     err.status && err.status !== 500 → public
 *     otherwise              → NOT public
 *
 * A bare Error has neither `status` nor `isPublic`, so it falls to the last
 * line every time. Twenty-two staff-facing messages were being written and
 * discarded — order transition gates, quotation and RFQ gates, the PIN rules,
 * the image resolution floor, the delete guards. The person who hit one saw
 * "Something went wrong." and had no way to find out what.
 *
 * WHY 400 AND isPublic BOTH. At status 400 the fourth argument is redundant —
 * APIError derives it, errors/APIError.js:34:
 *
 *   super(message, status, data,
 *     typeof isPublic === 'boolean' ? isPublic : status !== INTERNAL_SERVER_ERROR)
 *
 * It is passed anyway because it is the half that keeps holding if someone later
 * changes the status to 500: derived, the message would go silent again; stated,
 * it stays visible. The 400 earns its place separately — it keeps a staff member
 * mistyping a PIN out of the 5xx logs, where it is not a server fault.
 *
 * WHAT NOT TO USE THIS FOR. Internal failures — a counter that would not
 * allocate, a malformed payload on a public ingest endpoint. Those should stay
 * opaque to the caller and loud in the logs. This is for the case where someone
 * did something reasonable, the system said no, and they need to know why.
 */
export function staffError(message: string) {
  // Return type inferred: APIError is generic over its `data` payload, and
  // naming it here pins a generic argument this helper deliberately never uses.
  return new APIError(message, 400, undefined, true);
}
