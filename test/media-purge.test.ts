import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyProbe, purgeMode, purgeSummary } from "../apps/dashboard/src/lib/media-purge";

/**
 * Deleting production records, so the interesting tests are the ones about NOT
 * deleting.
 *
 * 59 media rows were inherited from the Cloud Run deployment and point at
 * objects that did not survive the move to S3. They 404, cannot be repaired —
 * there is no source image left — and clutter the library staff pick from.
 *
 * THE TRAP THIS AVOIDS. The obvious discriminator is "created before the S3
 * cutover". That is wrong and would have been destructive: 91 rows predate it,
 * only 59 are dead, and 29 of the 32 survivors are the department banners
 * currently on the storefront. Measured against production before writing this.
 */

const CMS = join(__dirname, "..", "apps", "dashboard", "src");
const read = (p: string) => readFileSync(join(CMS, p), "utf8");
const withoutComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("only a definitive 404 counts as gone", () => {
  it("404 is dead", () => {
    expect(classifyProbe(404)).toEqual({ verdict: "dead", status: 404 });
  });

  it.each([200, 206, 301, 302, 304])("%i means the file is there — keep it", (status) => {
    expect(classifyProbe(status).verdict).toBe("alive");
  });

  it.each([
    [
      403,
      "S3 returns this for a missing key when ListBucket is denied — indistinguishable from a real permissions problem",
    ],
    [500, "the server broke; that says nothing about the object"],
    [502, "a proxy failed in front of it"],
    [429, "throttled"],
  ])("%i is UNKNOWN, never dead (%s)", (status) => {
    expect(classifyProbe(status).verdict).toBe("unknown");
  });

  it("no response at all is unknown — the server may still be starting", () => {
    // This runs from the BACKGROUND seed, which begins while the HTTP server is
    // still coming up. Reading a connection refusal as "the file is gone" would
    // delete the entire media library on a slow boot.
    const p = classifyProbe(null, "fetch failed");
    expect(p.verdict).toBe("unknown");
    expect(p).toMatchObject({ status: null });
  });

  it("carries a reason on every unknown, so the log says why a row was spared", () => {
    expect(classifyProbe(403).verdict === "unknown" && classifyProbe(403)).toMatchObject({
      reason: expect.stringContaining("403"),
    });
  });
});

describe("the switch is off unless someone means it", () => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["false", "false"],
    ["0", "0"],
    ["yes", "yes"],
    ["TRUE", "TRUE"],
    ["1", "1"],
  ])("%s means off", (_l, v) => {
    expect(purgeMode({ MEDIA_PURGE_DANGLING: v })).toBe("off");
  });

  it("'report' lists without deleting — the mode to run first", () => {
    expect(purgeMode({ MEDIA_PURGE_DANGLING: "report" })).toBe("report");
  });

  it("only the exact string 'true' deletes", () => {
    expect(purgeMode({ MEDIA_PURGE_DANGLING: "true" })).toBe("delete");
  });

  it("tolerates surrounding whitespace, which a console paste adds", () => {
    expect(purgeMode({ MEDIA_PURGE_DANGLING: "  true  " })).toBe("delete");
  });
});

describe("the summary is auditable from the log alone", () => {
  it("says nothing was deleted in report mode", () => {
    const s = purgeSummary({
      probed: 91,
      dead: 59,
      alive: 32,
      unknown: 0,
      deleted: 0,
      refused: 0,
      mode: "report",
    });
    expect(s).toMatch(/REPORT ONLY/);
    expect(s).toMatch(/nothing deleted/);
  });

  it("accounts for every probed row", () => {
    const s = purgeSummary({
      probed: 91,
      dead: 59,
      alive: 32,
      unknown: 0,
      deleted: 59,
      refused: 0,
      mode: "delete",
    });
    expect(s).toMatch(/probed 91/);
    expect(s).toMatch(/59 dead/);
    expect(s).toMatch(/32 alive/);
  });

  it("names refusals as the guard working, not as an error", () => {
    const s = purgeSummary({
      probed: 91,
      dead: 59,
      alive: 32,
      unknown: 0,
      deleted: 58,
      refused: 1,
      mode: "delete",
    });
    expect(s).toMatch(/refused 1/);
    expect(s).toMatch(/still referenced/);
  });

  it("reports unverifiable rows as left alone", () => {
    const s = purgeSummary({
      probed: 91,
      dead: 0,
      alive: 0,
      unknown: 91,
      deleted: 0,
      refused: 0,
      mode: "delete",
    });
    expect(s).toMatch(/91 unverifiable \(left alone\)/);
  });
});

describe("the migration is wired the way the destructive switches here are", () => {
  const seed = withoutComments(read("seed.ts"));

  it("is gated, and does nothing when the flag is off", () => {
    expect(seed).toMatch(/const mode = purgeMode\(process\.env\);\s*if \(mode === "off"\) return;/);
  });

  it("deletes through payload.delete, so the media guard still refuses referenced files", () => {
    // Not the native driver. deleteByID skips ACCESS under overrideAccess but
    // runs beforeDelete hooks unconditionally, so mediaBeforeDelete is the
    // backstop for any reference this missed.
    expect(seed).toMatch(
      /await payload\.delete\(\{ collection: "media", id: doc\.id, overrideAccess: true \}\)/
    );
    expect(seed).not.toMatch(/purgeDanglingMedia[\s\S]*?deleteMany/);
  });

  it("runs AFTER the banners are attached", () => {
    // Otherwise it could remove a row ensureCategoryImages was about to reuse.
    const banners = seed.indexOf("await ensureCategoryImages(payload)");
    const purge = seed.indexOf("await purgeDanglingMedia(payload)");
    expect(banners).toBeGreaterThan(-1);
    expect(purge).toBeGreaterThan(banners);
  });

  it("never fails boot", () => {
    const fn = /async function purgeDanglingMedia[\s\S]*?\n\}/.exec(seed);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/continuing boot/);
  });

  it("report mode short-circuits BEFORE the delete, not after", () => {
    // The mutation that motivated this assertion: change `if (mode === "report")`
    // to `if (false)` and report mode silently becomes delete mode. Every other
    // test in this file still passed. Report is the safety valve someone runs
    // first on the real database, so it failing open is the worst outcome here.
    const fn = /async function purgeDanglingMedia[\s\S]*?\n\}/.exec(seed)![0];
    const guard = fn.indexOf('if (mode === "report")');
    const del = fn.indexOf("await payload.delete(");
    expect(guard).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(del);
    // and it must `continue`, not fall through
    expect(fn.slice(guard, del)).toMatch(/continue;/);
  });

  it("only ever deletes on the dead verdict", () => {
    const fn = /async function purgeDanglingMedia[\s\S]*?\n\}/.exec(seed)![0];
    // alive and unknown both `continue` before the delete can be reached.
    expect(fn).toMatch(/if \(probe\.verdict === "alive"\) \{ counts\.alive \+= 1; continue; \}/);
    expect(fn).toMatch(/if \(probe\.verdict === "unknown"\) \{/);
  });
});
