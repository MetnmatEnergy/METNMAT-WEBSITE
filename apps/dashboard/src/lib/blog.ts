/**
 * Pure blog helpers — no Payload imports so the root test runner can exercise
 * them directly (same pattern as lib/internal-key.ts + test/internal-key.test.ts).
 */

/** Lowercase URL-safe slug from a title. "Fuel-Cell MEAs: 2026 review" → "fuel-cell-meas-2026-review". */
export function slugify(input: string): string {
  return (input || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
}

type LexicalNode = { text?: string; children?: LexicalNode[] };

/** All human-readable text inside a Lexical rich-text document. */
export function lexicalToText(content: unknown): string {
  const root = (content as { root?: LexicalNode } | null | undefined)?.root;
  if (!root) return "";
  const parts: string[] = [];
  const walk = (n: LexicalNode) => {
    if (typeof n.text === "string") parts.push(n.text);
    (n.children ?? []).forEach(walk);
  };
  walk(root);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** "5 min read" from a Lexical body (200 wpm, ≥1 min). Empty body → "". */
export function readingTimeFromLexical(content: unknown): string {
  const words = lexicalToText(content).split(/\s+/).filter(Boolean).length;
  if (!words) return "";
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/**
 * Field validator for profile / reference links: empty is fine, otherwise it
 * must parse as an absolute http(s) URL — never javascript:/data: etc.
 */
export function validateHttpUrl(value: unknown): true | string {
  if (value === undefined || value === null || value === "") return true;
  try {
    const u = new URL(String(value));
    if (u.protocol === "https:" || u.protocol === "http:") return true;
  } catch {
    /* fall through */
  }
  return "Must be a full http(s):// URL";
}

/** Minimal HTML escape for user-supplied strings interpolated into emails. */
export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const lexText = (text: string): Record<string, unknown> => ({
  type: "text",
  version: 1,
  text,
  format: 0,
  detail: 0,
  mode: "normal",
  style: "",
});

/**
 * Convert plain text (contributor manuscript) into a minimal Lexical document —
 * one paragraph per blank-line-separated block — so a converted submission
 * opens as editable rich text in the article editor. A block that is a single
 * line beginning with `## ` (or `### `) becomes an h2 (or h3) heading, so
 * seeded articles can carry real section headings (which drive the on-page
 * table of contents). Existing manuscripts have no such lines, so this stays
 * backward-compatible.
 */
export function plainTextToLexical(text: string): unknown {
  const blocks = (text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const children = (blocks.length ? blocks : [""]).map((block) => {
    const heading = /^(#{2,3})\s+(.+)$/.exec(block);
    if (heading && !block.includes("\n")) {
      return {
        type: "heading",
        tag: heading[1] === "##" ? "h2" : "h3",
        version: 1,
        format: "",
        indent: 0,
        direction: null,
        children: [lexText(heading[2].trim())],
      };
    }
    return {
      type: "paragraph",
      version: 1,
      format: "",
      indent: 0,
      direction: null,
      children: block
        .split(/\n/)
        .flatMap((line, i): Record<string, unknown>[] =>
          i === 0 ? [lexText(line)] : [{ type: "linebreak", version: 1 }, lexText(line)],
        ),
    };
  });
  return {
    root: { type: "root", version: 1, format: "", indent: 0, direction: null, children },
  };
}

/** Human-facing submission reference number, e.g. "BPR-2026-8F3KQ2". Crockford-ish alphabet (no 0/O/1/I/L). */
export function makeSubmissionReference(year: number, random: () => number = Math.random): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(random() * alphabet.length)];
  return `BPR-${year}-${code}`;
}
