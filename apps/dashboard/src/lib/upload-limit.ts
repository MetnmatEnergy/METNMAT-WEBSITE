/**
 * The upload ceiling, and what an employee is told when they hit it.
 *
 * WHAT WAS BROKEN. An image over the limit was SAVED, cut in half, with nothing
 * said about it. Not a badly-worded error — no error at all. Payload's multipart
 * parser defaults `abortOnLimit` to false
 * (`uploads/fetchAPI-multipart/index.js:6`), and its limit handler
 * (`processMultipart.js:67`) only aborts inside `if (options.abortOnLimit)`.
 * With the flag off it logs to a debug channel that is also off, calls a
 * `limitHandler` that defaults to false, and falls out of the callback. The
 * stream keeps going, `file.on('end')` builds the file from the partial buffer,
 * and the result carries `truncated: true` — which Payload's own type documents
 * at `config/types.d.ts:452` and which nothing in `payload/dist` ever reads.
 *
 * So the half-file went on to sharp, through the imageSizes ladder, and into S3
 * as a corrupt asset that looked like a successful upload.
 *
 * THE FIX IS NOT A BIGGER LIMIT. The ceiling is unchanged. What changes is that
 * exceeding it fails loudly: `abortOnLimit` makes the parser throw a 413, and
 * `APIError` derives `isPublic` from `status !== 500` (`errors/APIError.js:34`),
 * so the sentence below reaches the person uploading instead of being replaced
 * with "Something went wrong."
 */

/** 25 MB, unchanged. Bytes, because that is what the parser compares against. */
export const MAX_UPLOAD_BYTES = 25_000_000;

/** The same ceiling as a round number, for saying out loud. */
export const MAX_UPLOAD_MB = 25;

/**
 * What the employee reads when a file is too big.
 *
 * Says the limit, says plainly that nothing was saved — the previous behaviour
 * looked like success, so silence on that point would repeat the defect — and
 * gives a next step in the terms the catalogue already uses: the product master
 * is 2400 px on the long edge, so anything larger is detail no page displays.
 */
export function uploadLimitMessage(): string {
  return (
    `That image is larger than the ${MAX_UPLOAD_MB} MB limit, so it has not been saved. ` +
    `Export it at a smaller size — 2400 px on the long edge is the full-quality ` +
    `size the product gallery uses — and upload it again.`
  );
}
