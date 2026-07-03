/**
 * Table-of-contents extraction from Payload's Lexical rich-text JSON.
 * Pure — shared by the RichText renderer (which stamps matching ids on the
 * rendered headings) and the sticky TOC component, and covered by unit tests.
 */

type LexicalNode = {
  type?: string;
  tag?: string;
  text?: string;
  children?: LexicalNode[];
};

export type TocEntry = { id: string; text: string; level: 2 | 3 };

/** Anchor id for a heading — stable, URL-safe, unique via the taken set. */
export function headingId(text: string, taken: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "section";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

const nodeText = (n: LexicalNode): string => {
  const parts: string[] = [];
  const walk = (x: LexicalNode) => {
    if (typeof x.text === "string") parts.push(x.text);
    (x.children ?? []).forEach(walk);
  };
  walk(n);
  return parts.join("").trim();
};

/**
 * All H2/H3 headings in document order with their anchor ids. H1s (discouraged
 * in article bodies — the page renders the title as the only H1) are treated
 * as H2, matching the renderer's downgrade.
 */
export function extractToc(content: unknown): TocEntry[] {
  const root = (content as { root?: LexicalNode } | null | undefined)?.root;
  if (!root?.children?.length) return [];
  const taken = new Set<string>();
  const entries: TocEntry[] = [];
  const walk = (n: LexicalNode) => {
    if (n.type === "heading") {
      const text = nodeText(n);
      if (text) {
        const level: 2 | 3 = n.tag === "h3" ? 3 : 2; // h1/h2 → 2, h3+ → 3-ish
        if (n.tag === "h1" || n.tag === "h2" || n.tag === "h3") {
          entries.push({ id: headingId(text, taken), text, level });
        }
      }
      return; // headings don't nest headings
    }
    (n.children ?? []).forEach(walk);
  };
  root.children.forEach(walk);
  return entries;
}
