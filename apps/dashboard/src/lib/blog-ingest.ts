import crypto from "node:crypto";
import { safeKeyEqual } from "./internal-key";

/**
 * The pure half of POST /api/posts/ingest: how a generated article (Markdown
 * plus widget configs) becomes a Posts body with equation, inline-equation and
 * interactive blocks. The weekly article pipeline (scripts/blog/weekly.ts) is
 * the only intended caller.
 *
 * Markdown cannot express Lexical blocks, so they travel as placeholders that
 * survive Payload's own markdown converter unchanged and are swapped for block
 * nodes afterwards:
 *   $$…$$          → a paragraph "@@BLOCK<n>@@" → `equation` block
 *   {{widget:id}}  → a paragraph "@@BLOCK<n>@@" → `interactive` block
 *   $…$            → a token "@@INLINE<n>@@" inside the text → `inlineEquation` inline block
 */

export type IngestWidget = { widget: string; title?: string; caption?: string; config: Record<string, unknown> };
export type BlockFields = Record<string, unknown> & { blockType: string };
export type Prepared = { markdown: string; blocks: BlockFields[]; inlines: BlockFields[] };

/**
 * Only the purpose key opens the ingest endpoint. Unlike inboundKeyMatches(),
 * the shared INTERNAL_API_KEY is deliberately NOT accepted: this endpoint
 * publishes to the public site, and a key leaked from any other integration
 * must not be able to.
 */
export function ingestAuthorized(provided: string | null | undefined): boolean {
  return safeKeyEqual(provided, process.env.CMS_BLOG_INGEST_KEY);
}

export function prepareMarkdown(md: string, widgets: Record<string, IngestWidget>): Prepared {
  const blocks: BlockFields[] = [];
  const inlines: BlockFields[] = [];
  const para = (b: BlockFields) => `\n\n@@BLOCK${blocks.push(b) - 1}@@\n\n`;

  let out = md
    // Nothing reaches the public site carrying a note meant for an editor.
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[EDITOR:/i.test(line))
    .join("\n")
    // Figures need images, which the pipeline does not produce.
    .replace(/^\s*\{\{figure:[^}]*\}\}\s*$/gm, "")
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, latex: string) => para({ blockType: "equation", latex: latex.trim() }))
    .replace(/\{\{widget:([A-Za-z0-9_-]+)\}\}/g, (_, id: string) => {
      const w = widgets[id];
      if (!w) throw new Error(`the article places {{widget:${id}}} but no widget "${id}" was sent`);
      return para({
        blockType: "interactive",
        widget: w.widget,
        ...(w.title ? { title: w.title } : {}),
        ...(w.caption ? { caption: w.caption } : {}),
        config: w.config,
      });
    })
    // A $ preceded by a backslash is a literal dollar sign, not maths.
    .replace(/(^|[^\\$])\$([^\n$]+?)\$/g, (_, pre: string, latex: string) => `${pre}@@INLINE${inlines.push({ blockType: "inlineEquation", latex: latex.trim() }) - 1}@@`);
  out = out.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return { markdown: out, blocks, inlines };
}

export type LexicalNode = { type: string; text?: string; children?: LexicalNode[]; [k: string]: unknown };

export const newBlockId = (): string => crypto.randomBytes(12).toString("hex");

/** Replaces the placeholders in a converted Lexical tree with Payload block nodes. Throws if any survive. */
export function injectBlocks<T extends { root: { children: LexicalNode[] } }>(state: T, prepared: Prepared, id = newBlockId): T {
  const block = (f: BlockFields): LexicalNode => ({ type: "block", version: 2, format: "", fields: { id: id(), blockName: "", ...f } });
  const inline = (f: BlockFields): LexicalNode => ({ type: "inlineBlock", version: 1, fields: { id: id(), blockName: "", ...f } });

  const walk = (nodes: LexicalNode[]): LexicalNode[] => {
    const out: LexicalNode[] = [];
    for (const n of nodes) {
      if (n.type === "paragraph" && n.children?.length === 1 && n.children[0]!.type === "text") {
        const m = /^@@BLOCK(\d+)@@$/.exec((n.children[0]!.text ?? "").trim());
        if (m && prepared.blocks[Number(m[1])]) {
          out.push(block(prepared.blocks[Number(m[1])]!));
          continue;
        }
      }
      if (n.type === "text" && typeof n.text === "string" && n.text.includes("@@INLINE")) {
        for (const part of n.text.split(/(@@INLINE\d+@@)/)) {
          if (!part) continue;
          const m = /^@@INLINE(\d+)@@$/.exec(part);
          const f = m ? prepared.inlines[Number(m[1])] : undefined;
          out.push(f ? inline(f) : { ...n, text: part });
        }
        continue;
      }
      out.push(n.children ? { ...n, children: walk(n.children) } : n);
    }
    return out;
  };

  const next = { ...state, root: { ...state.root, children: walk(state.root.children) } };
  const left = JSON.stringify(next).match(/@@(BLOCK|INLINE)\d+@@/g);
  if (left) throw new Error(`unresolved placeholders: ${[...new Set(left)].join(", ")}`);
  return next;
}

export type PublishMode = "draft" | "immediate" | "scheduled";

/** When the post becomes public, or null for a draft. A schedule must be in the future and within 30 days. */
export function publishTime(mode: PublishMode, at: string | undefined, now = new Date()): { ok: true; date: Date | null } | { ok: false; error: string } {
  if (mode === "draft") return { ok: true, date: null };
  if (mode === "immediate") return { ok: true, date: now };
  const t = at ? new Date(at) : null;
  if (!t || Number.isNaN(t.getTime())) return { ok: false, error: "scheduled mode needs a valid publish.at" };
  if (t.getTime() <= now.getTime()) return { ok: false, error: "publish.at is in the past" };
  if (t.getTime() - now.getTime() > 30 * 24 * 3600 * 1000) return { ok: false, error: "publish.at is more than 30 days away" };
  return { ok: true, date: t };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The email staff get for every article the pipeline files. */
export function ingestEmailHtml(a: {
  title: string;
  status: string;
  when: string | null;
  liveUrl: string;
  adminUrl: string;
  notes: string[];
  linkedin?: string;
}): string {
  const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;
  return [
    p(`<strong>${escapeHtml(a.title)}</strong>`),
    p(
      a.status === "draft"
        ? "Saved as a <strong>draft</strong>. It is not on the website until someone publishes it."
        : a.when
          ? `Publishes automatically at <strong>${escapeHtml(a.when)}</strong>. To stop it, open the article and click Unpublish, or edit it before then.`
          : "Published.",
    ),
    p(`<a href="${escapeHtml(a.liveUrl)}">${escapeHtml(a.liveUrl)}</a> · <a href="${escapeHtml(a.adminUrl)}">Edit in the CMS</a>`),
    a.notes.length ? `<p style="margin:0 0 6px"><strong>Pipeline notes</strong></p><ul>${a.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : "",
    a.linkedin ? `<p style="margin:12px 0 6px"><strong>LinkedIn post</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(a.linkedin)}</pre>` : "",
  ].join("");
}
