import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The Payload admin import map, which is the thing that white-screens the CMS
 * when it is wrong.
 *
 * Payload resolves every custom admin component through this map. A key that is
 * referenced but missing, or an identifier that is used but never imported,
 * makes the admin provider unresolvable and BOTH the admin root and its login
 * page render blank — not a broken widget, a white page.
 *
 * Two ways to get there, and this repository has met both:
 *
 *  1. The generator strips the storage client-upload handlers. A running
 *     `next dev` reduces them to zero, which is why the count is pinned here.
 *  2. A component is added to a collection but never registered — or is
 *     registered by hand with an identifier that does not match its import.
 *     `payload generate:importmap` currently fails in this repo with
 *     ERR_REQUIRE_ASYNC_MODULE, so entries are hand-written, which makes (2)
 *     easy to do and impossible to notice until the admin is opened.
 */

const CMS = join(__dirname, "..", "apps", "dashboard", "src");
const MAP = join(CMS, "app", "(payload)", "admin", "importMap.js");
const map = readFileSync(MAP, "utf8");

/** `import { default as X } from '...'` / `import { Y as Z } from '...'` */
function importedIdentifiers(src: string): Set<string> {
  const out = new Set<string>();
  const re = /import\s*\{\s*[\w$]+\s+as\s+([\w$]+)\s*\}\s*from/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[1]!);
  return out;
}

/** `"some/key#export": identifier,` inside the map object */
function mapEntries(src: string): { key: string; identifier: string }[] {
  const out: { key: string; identifier: string }[] = [];
  const re = /"([^"]+)"\s*:\s*([\w$]+)\s*,?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ key: m[1]!, identifier: m[2]! });
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

describe("the admin import map resolves", () => {
  const imported = importedIdentifiers(map);
  const entries = mapEntries(map);

  it("finds the map it is meant to police", () => {
    expect(entries.length).toBeGreaterThan(10);
    expect(imported.size).toBeGreaterThan(10);
  });

  it("every identifier the map uses is actually imported", () => {
    // The exact mistake made while hand-adding an entry: the import bound
    // `default_abc…abc` while the map referenced `default_abc`. That is a
    // ReferenceError at module load, and the whole admin goes white.
    const dangling = entries.filter((e) => !imported.has(e.identifier));
    expect(
      dangling.map((d) => `${d.key} -> ${d.identifier}`),
      "map entries referencing an identifier that is never imported",
    ).toEqual([]);
  });

  it("every import is used by the map", () => {
    const used = new Set(entries.map((e) => e.identifier));
    const unused = [...imported].filter((i) => !used.has(i));
    expect(unused, "imports with no map entry — dead, and a sign of a half-finished edit").toEqual([]);
  });

  it("keeps BOTH storage client upload handlers", () => {
    // Whichever storage plugin is active registers a ROOT admin provider
    // referencing its handler key; a missing key renders the whole admin blank.
    // A running `next dev` strips these to zero.
    // Counted as LINES, which is the check CLAUDE.md documents: two imports and
    // two map entries. Each line names the handler twice, so counting
    // occurrences gives 8 and would not match the documented invariant.
    const handlerLines = map.split("\n").filter((l) => l.includes("ClientUploadHandler"));
    expect(handlerLines.length).toBe(4);
    expect(map).toContain("GcsClientUploadHandler");
    expect(map).toContain("S3ClientUploadHandler");
  });
});

describe("every custom admin component is registered", () => {
  // Collect every "/admin/Something" the CMS source asks Payload to resolve.
  const referenced = new Set<string>();
  for (const file of walk(CMS)) {
    if (file.includes(`(payload)`)) continue; // the map itself
    const src = readFileSync(file, "utf8");
    // Components only. Payload component paths are PascalCase by convention;
    // lowercase "/admin/..." strings are ROUTES (the analytics view URL, the
    // login redirect) and correctly have no map entry.
    const re = /["'](\/admin\/[A-Z][A-Za-z0-9_]*)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) referenced.add(m[1]!);
  }

  it("finds the references it is meant to check", () => {
    expect(referenced.size).toBeGreaterThan(3);
  });

  it("has a map entry for each one", () => {
    // Adding a component to a collection and forgetting the map is the other
    // route to a blank admin — and `generate:importmap` currently fails in this
    // repo, so nothing regenerates it for you.
    const missing = [...referenced].filter((path) => !map.includes(`"${path}#`));
    expect(missing, "components referenced in the CMS but absent from the import map").toEqual([]);
  });

  it("the stock adjustment panel in particular is wired", () => {
    expect(map).toContain('"/admin/StockAdjust#default"');
  });
});
