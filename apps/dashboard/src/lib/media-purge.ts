/**
 * Removing media rows whose file no longer exists.
 *
 * WHAT THESE ARE. 59 rows in `media` were inherited from the Cloud Run era and
 * point at objects that did not survive the move to S3. Every one of them
 * returns 404 through `/api/media/file/<filename>`. They cannot be repaired —
 * there is no source image to re-derive anything from — so they are not a
 * pipeline defect to fix but dead records to clear.
 *
 * WHY DATE IS NOT THE TEST. The obvious discriminator, "created before the S3
 * cutover", is wrong: 91 rows predate it and only 59 are dead. The other 32 are
 * live, and 29 of those are the department banners currently on the storefront.
 * Deleting by date would have taken the shop's banners with it. The only honest
 * test is whether the file is actually there.
 *
 * FAIL SAFE, NOT FAIL CLEVER. A row is removed ONLY on a definitive 404 from
 * the CMS's own serving path. A timeout, a connection refusal, a 500, a 403 —
 * anything else at all — leaves the row alone. The purge runs from the
 * background seed, which starts while the HTTP server is still coming up, so
 * "cannot reach it yet" is an expected outcome and must never be read as
 * "the file is gone".
 */

/** What the existence probe concluded about one media row. */
export type MediaProbe =
  | { verdict: "dead"; status: 404 }
  | { verdict: "alive"; status: number }
  | { verdict: "unknown"; status: number | null; reason: string };

/**
 * Only a 404 means the object is gone.
 *
 * Anything else — including 403, which an S3 bucket returns for a missing key
 * when ListBucket is denied — is treated as unknown rather than dead. A wrong
 * "dead" here destroys a real image, and there is no undo: the row carries the
 * only record of which filename a product pointed at.
 */
export function classifyProbe(status: number | null, reason?: string): MediaProbe {
  if (status === 404) return { verdict: "dead", status: 404 };
  if (status === null) return { verdict: "unknown", status: null, reason: reason ?? "no response" };
  if (status >= 200 && status < 400) return { verdict: "alive", status };
  return { verdict: "unknown", status, reason: reason ?? `unexpected status ${status}` };
}

/** The three modes of the purge flag. Anything unset or unrecognised is "off". */
export type PurgeMode = "off" | "report" | "delete";

/**
 * Read the flag. Explicit string compare, never truthiness — the same rule the
 * other destructive switches in this codebase follow.
 *
 * "report" exists so the list can be inspected on the real database before
 * anything is removed. That is the mode to run first.
 */
export function purgeMode(env: Record<string, string | undefined>): PurgeMode {
  const v = (env.MEDIA_PURGE_DANGLING ?? "").trim();
  if (v === "true") return "delete";
  if (v === "report") return "report";
  return "off";
}

/** One-line summary for the log, so a run is auditable from PM2 output alone. */
export function purgeSummary(counts: {
  probed: number;
  dead: number;
  alive: number;
  unknown: number;
  deleted: number;
  refused: number;
  mode: PurgeMode;
}): string {
  const { probed, dead, alive, unknown, deleted, refused, mode } = counts;
  const head =
    mode === "report"
      ? `[seed] media purge REPORT ONLY — nothing deleted.`
      : `[seed] media purge complete.`;
  return (
    `${head} probed ${probed}: ${dead} dead, ${alive} alive, ${unknown} unverifiable (left alone). ` +
    `deleted ${deleted}, refused ${refused} (still referenced — clear the reference first).`
  );
}
