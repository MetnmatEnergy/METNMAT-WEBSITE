import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { formatDateIST, formatDateTimeIST } from "../apps/website/src/frontend/lib/ist-date";

/**
 * Customer-facing dates are IST, whatever zone the server runs in (2026-10-27).
 *
 * Order MM-20261027-28CC0E was paid by UPI at 4:36 pm IST, and its tracking
 * timeline said "11:07 am": the prod host's clock is UTC and the formatter
 * never named a zone. A developer laptop in India hides this completely, since
 * its local zone already is IST, so the first block pins the output against
 * fixed instants and the second checks the source for the call that caused it.
 */

// ICU separates "04:35" and "pm" with a narrow no-break space on some versions.
const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();

describe("IST formatting", () => {
  it("renders the instant the order was placed in IST, not UTC", () => {
    expect(norm(formatDateTimeIST("2026-10-27T11:05:40.000Z"))).toBe("27 oct 2026, 04:35 pm");
  });

  it("puts a just-after-midnight IST payment on the IST date (the invoice date)", () => {
    // 01:30 IST on 27 Oct is still 26 Oct in UTC.
    expect(formatDateIST("2026-10-26T20:00:00.000Z")).toBe("27 Oct 2026");
    expect(norm(formatDateTimeIST("2026-10-26T20:00:00.000Z"))).toBe("27 oct 2026, 01:30 am");
  });

  it("returns an empty string for missing or unparseable values, so callers pick the fallback", () => {
    for (const v of [undefined, null, "", "not a date"]) {
      expect(formatDateIST(v)).toBe("");
      expect(formatDateTimeIST(v)).toBe("");
    }
  });
});

describe("no website date is formatted in the server's own zone", () => {
  const SRC = join(__dirname, "..", "apps", "website", "src");
  const HELPER = join(SRC, "frontend", "lib", "ist-date.ts");

  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return files(p);
      return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });

  /** The argument list of the call whose "(" sits at `open`. */
  const argsAt = (src: string, open: number): string => {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) return src.slice(open, i + 1);
    }
    return src.slice(open);
  };

  it("every toLocaleDateString / toLocaleTimeString / Date#toLocaleString names a timeZone", () => {
    // Number#toLocaleString (prices) is not a date, so only Date receivers count
    // for toLocaleString: `new Date(…).toLocaleString(`.
    const CALL = /\.toLocale(?:Date|Time)String\(|new Date\([^)]*\)\.toLocaleString\(/g;
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      if (file === HELPER) continue; // its zone lives in shared options, asserted above
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(CALL)) {
        const open = (m.index ?? 0) + m[0].length - 1;
        if (!/timeZone/.test(argsAt(src, open))) {
          const line = src.slice(0, m.index).split("\n").length;
          offenders.push(`${relative(SRC, file)}:${line}`);
        }
      }
    }
    expect(offenders, "format through frontend/lib/ist-date.ts, or pass timeZone").toEqual([]);
  });
});
