import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  uploadLimitMessage,
} from "../apps/dashboard/src/lib/upload-limit";

/**
 * An oversized image was SAVED, cut in half, with nothing said about it.
 *
 * This is not "the error was not surfaced well". There was no error. Payload's
 * multipart parser defaults `abortOnLimit` to false:
 *
 *   uploads/fetchAPI-multipart/index.js:6            abortOnLimit: false
 *   uploads/fetchAPI-multipart/processMultipart.js:67  file.on('limit', () => {
 *                                                       ...debugLog (off by default)
 *                                                       ...limitHandler (false by default)
 *   processMultipart.js:77                             if (options.abortOnLimit) { ...abort... }
 *
 * With that flag false the handler reaches the end of its body and does nothing.
 * The stream keeps going, `file.on('end')` builds the file from the partial
 * buffer, and the result is flagged `truncated: true`
 * (processMultipart.js:110). Payload's own type documents the outcome at
 * config/types.d.ts:452 — "Otherwise, it will add a `truncated = true` to the
 * resulting file structure."
 *
 * And nothing anywhere reads that flag. A grep for `truncated` across
 * payload/dist outside the parser returns nothing, so the half-file goes on to
 * sharp, to the imageSizes ladder, and into S3 as a corrupt asset that looks
 * like a successful upload.
 *
 * THE FIX IS NOT A BIGGER LIMIT. The limit is left exactly where it was; what
 * changes is that exceeding it now fails loudly instead of quietly succeeding.
 * `abortOnLimit: true` makes processMultipart.js:80 throw an APIError with
 * status 413, and APIError derives `isPublic` from `status !== 500`
 * (errors/APIError.js:34), so the message reaches the employee rather than being
 * replaced with "Something went wrong."
 */

describe("the limit itself is unchanged", () => {
  it("is still 25 MB — the fix is the failure mode, not the ceiling", () => {
    expect(MAX_UPLOAD_BYTES).toBe(25_000_000);
    expect(MAX_UPLOAD_MB).toBe(25);
  });
});

describe("what the employee is told", () => {
  const msg = uploadLimitMessage();

  it("names the limit, so the number is not a mystery", () => {
    expect(msg).toMatch(/25\s?MB/);
  });

  it("says the file was NOT saved", () => {
    // The whole defect was that it looked saved. Silence here would repeat it.
    expect(msg).toMatch(/not (been )?(saved|uploaded)/i);
  });

  it("says what to do next, in terms of the catalogue's own master size", () => {
    expect(msg).toMatch(/2400/);
  });

  it("reads as a sentence to a colleague, not an error code", () => {
    expect(msg).not.toMatch(/error|failed|invalid|E\d{3}|413/i);
    expect(msg.length).toBeGreaterThan(40);
  });
});

describe("the config actually turns the failure on", () => {
  const src = readFileSync(
    join(__dirname, "..", "apps", "dashboard", "src", "payload.config.ts"),
    "utf8",
  );

  it("aborts instead of truncating", () => {
    // Without this the limit is advisory and the half-file is kept.
    expect(src).toMatch(/abortOnLimit:\s*true/);
  });

  it("sends the written message rather than Payload's default string", () => {
    // The default is "File size limit has been reached", which tells an
    // employee neither the limit nor what to do about it.
    expect(src).toMatch(/responseOnLimit:\s*uploadLimitMessage\(\)/);
    expect(src).not.toMatch(/File size limit has been reached/);
  });

  it("takes the ceiling from the shared constant, not a second magic number", () => {
    expect(src).toMatch(/fileSize:\s*MAX_UPLOAD_BYTES/);
  });
});

describe("the Payload behaviour this depends on", () => {
  const ROOT = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(ROOT, "apps/dashboard/node_modules", p), "utf8");

  it("abortOnLimit really does default to false", () => {
    expect(read("payload/dist/uploads/fetchAPI-multipart/index.js")).toMatch(
      /abortOnLimit:\s*false/,
    );
  });

  it("nothing is thrown on limit unless abortOnLimit is set", () => {
    const src = read("payload/dist/uploads/fetchAPI-multipart/processMultipart.js");
    expect(src).toMatch(/if \(options\.abortOnLimit\) \{[\s\S]{0,400}?abortAndDestroyFile/);
  });

  it("the partial file is otherwise kept and merely flagged", () => {
    expect(read("payload/dist/uploads/fetchAPI-multipart/processMultipart.js")).toMatch(
      /truncated: Boolean\('truncated' in file && file\.truncated\)/,
    );
  });

  it("no code outside the parser ever reads that flag", () => {
    // Which is why flagging it was not protection. If Payload ever starts
    // checking it, this test says so and the reasoning above can be revisited.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const hits = execSync(
      'grep -rl "truncated" apps/dashboard/node_modules/payload/dist --include=*.js || true',
      { cwd: ROOT, encoding: "utf8" },
    )
      .split("\n")
      .filter((l) => l.trim() && !l.includes("fetchAPI-multipart"));
    expect(hits, `unexpected readers: ${hits.join(", ")}`).toEqual([]);
  });

  it("a 413 is public, so the message is not swallowed", () => {
    // routeError replaces the body of a non-public error with a generic string.
    expect(read("payload/dist/errors/APIError.js")).toMatch(
      /status !== httpStatus\.INTERNAL_SERVER_ERROR/,
    );
  });

  it("the limit is reported with REQUEST_ENTITY_TOO_LARGE, not a 500", () => {
    expect(read("payload/dist/uploads/fetchAPI-multipart/processMultipart.js")).toMatch(
      /httpStatus\.REQUEST_ENTITY_TOO_LARGE/,
    );
  });
});
