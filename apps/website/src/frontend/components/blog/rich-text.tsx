/**
 * Renderer for Payload's Lexical rich-text JSON — publication-grade subset:
 * paragraphs, headings (anchor ids matching the TOC), ordered/unordered/check
 * lists, quotes, links (safe rel/target), inline bold/italic/underline/strike/
 * code/sub/superscript, tables, code blocks, uploaded images with captions,
 * and horizontal rules. Defensive: unknown nodes render their children so
 * content never hard-fails; no raw HTML from the CMS is ever injected.
 */
import React from "react";
import Image from "next/image";
import { headingId } from "@/frontend/lib/blog-toc";
import { mediaUrl } from "@/frontend/lib/cms";

type LexicalNode = {
  type?: string;
  tag?: string;
  text?: string;
  format?: number | string;
  listType?: string;
  checked?: boolean;
  url?: string;
  fields?: { url?: string; newTab?: boolean };
  language?: string;
  value?: unknown; // upload node: populated media doc
  children?: LexicalNode[];
};

const BOLD = 1;
const ITALIC = 2;
const STRIKETHROUGH = 4;
const UNDERLINE = 8;
const CODE = 16;
const SUBSCRIPT = 32;
const SUPERSCRIPT = 64;

function renderText(node: LexicalNode, key: number): React.ReactNode {
  let el: React.ReactNode = node.text ?? "";
  const f = typeof node.format === "number" ? node.format : 0;
  if (f & CODE) el = <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">{el}</code>;
  if (f & BOLD) el = <strong>{el}</strong>;
  if (f & ITALIC) el = <em>{el}</em>;
  if (f & UNDERLINE) el = <u>{el}</u>;
  if (f & STRIKETHROUGH) el = <s>{el}</s>;
  if (f & SUBSCRIPT) el = <sub>{el}</sub>;
  if (f & SUPERSCRIPT) el = <sup>{el}</sup>;
  return <React.Fragment key={key}>{el}</React.Fragment>;
}

const nodePlainText = (n: LexicalNode): string => {
  const parts: string[] = [];
  const walk = (x: LexicalNode) => {
    if (typeof x.text === "string") parts.push(x.text);
    (x.children ?? []).forEach(walk);
  };
  walk(n);
  return parts.join("");
};

/** Only http(s), mailto, tel or same-site relative links survive. */
function safeHref(href: string | undefined): string | null {
  const h = (href ?? "").trim();
  if (!h) return null;
  // Protocol-relative ("//evil.com") and backslash variants are NOT same-site.
  if (h.startsWith("//") || h.startsWith("/\\")) return null;
  if (h.startsWith("/") || h.startsWith("#")) return h;
  try {
    const u = new URL(h);
    if (["https:", "http:", "mailto:", "tel:"].includes(u.protocol)) return h;
  } catch {
    /* invalid */
  }
  return null;
}

type Ctx = { headingIds: Set<string>; figureCount: { n: number }; tableCount: { n: number } };

function renderNodes(nodes: LexicalNode[] | undefined, ctx: Ctx): React.ReactNode {
  if (!nodes?.length) return null;
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return renderText(node, i);
      case "paragraph":
        return (
          <p key={i} className="leading-relaxed">
            {renderNodes(node.children, ctx)}
          </p>
        );
      case "heading": {
        const Tag = (node.tag === "h1" ? "h2" : node.tag || "h2") as "h2" | "h3" | "h4" | "h5" | "h6";
        const text = nodePlainText(node);
        // Blank headings get no id — mirrors extractToc, keeping renderer and
        // TOC anchor sequences in lockstep for duplicate heading titles.
        const id =
          (Tag === "h2" || Tag === "h3") && text.trim() ? headingId(text, ctx.headingIds) : undefined;
        return (
          <Tag
            key={i}
            id={id}
            className="mt-10 scroll-mt-28 font-display font-semibold text-foreground first:mt-0"
          >
            {renderNodes(node.children, ctx)}
          </Tag>
        );
      }
      case "list": {
        if (node.listType === "check") {
          return (
            <ul key={i} className="ml-1 space-y-1">
              {(node.children ?? []).map((li, j) => (
                <li key={j} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 text-brand">{li.checked ? "☑" : "☐"}</span>
                  <span className="sr-only">{li.checked ? "Checked:" : "Unchecked:"}</span>
                  <span>{renderNodes(li.children, ctx)}</span>
                </li>
              ))}
            </ul>
          );
        }
        const ListTag = node.listType === "number" ? "ol" : "ul";
        return (
          <ListTag
            key={i}
            className={`ml-5 space-y-1 ${ListTag === "ol" ? "list-decimal" : "list-disc"}`}
          >
            {renderNodes(node.children, ctx)}
          </ListTag>
        );
      }
      case "listitem":
        return <li key={i}>{renderNodes(node.children, ctx)}</li>;
      case "quote":
        return (
          <blockquote key={i} className="border-l-2 border-brand pl-4 italic text-foreground/80">
            {renderNodes(node.children, ctx)}
          </blockquote>
        );
      case "link":
      case "autolink": {
        const href = safeHref(node.fields?.url || node.url);
        if (!href) return <React.Fragment key={i}>{renderNodes(node.children, ctx)}</React.Fragment>;
        const external = href.startsWith("http");
        return (
          <a
            key={i}
            href={href}
            className="text-brand underline underline-offset-4 hover:text-brand-soft"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {renderNodes(node.children, ctx)}
          </a>
        );
      }
      case "code": {
        const code = nodePlainText(node);
        return (
          <pre
            key={i}
            className="overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 text-sm leading-relaxed"
          >
            <code>{code}</code>
          </pre>
        );
      }
      case "table":
        ctx.tableCount.n += 1;
        return (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>{renderNodes(node.children, ctx)}</tbody>
            </table>
          </div>
        );
      case "tablerow":
        return <tr key={i}>{renderNodes(node.children, ctx)}</tr>;
      case "tablecell": {
        const isHeader = (node as { headerState?: number }).headerState === 3 ||
          (node as { headerState?: number }).headerState === 1;
        const Cell = isHeader ? "th" : "td";
        return (
          <Cell
            key={i}
            className={`border border-border px-3 py-2 text-left align-top ${isHeader ? "bg-muted/60 font-semibold text-foreground" : ""}`}
          >
            {renderNodes(node.children, ctx)}
          </Cell>
        );
      }
      case "upload": {
        const media = node.value as { url?: string; alt?: string; width?: number; height?: number } | undefined;
        const src = mediaUrl(media as { url?: string } | null);
        if (!src) return null;
        ctx.figureCount.n += 1;
        const caption = (node.fields as { caption?: string } | undefined)?.caption;
        return (
          <figure key={i} className="my-8">
            <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
              <Image
                src={src}
                alt={media?.alt || caption || `Figure ${ctx.figureCount.n}`}
                width={media?.width || 1200}
                height={media?.height || 675}
                className="h-auto w-full object-contain"
                sizes="(max-width: 768px) 100vw, 720px"
              />
            </div>
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">Figure {ctx.figureCount.n}.</span>{" "}
              {caption || media?.alt || ""}
            </figcaption>
          </figure>
        );
      }
      case "linebreak":
        return <br key={i} />;
      case "horizontalrule":
        return <hr key={i} className="my-8 border-border" />;
      default:
        return <React.Fragment key={i}>{renderNodes(node.children, ctx)}</React.Fragment>;
    }
  });
}

export function RichText({ content }: { content: unknown }) {
  const root = (content as { root?: LexicalNode } | null)?.root;
  if (!root?.children?.length) return null;
  const ctx: Ctx = { headingIds: new Set(), figureCount: { n: 0 }, tableCount: { n: 0 } };
  return (
    <div className="space-y-4 break-words text-base leading-relaxed text-muted-foreground [&_a]:break-words [&_code]:break-all [&_h2]:text-2xl [&_h3]:text-xl [&_h4]:text-lg">
      {renderNodes(root.children, ctx)}
    </div>
  );
}

/** True when the Lexical document has at least one non-empty node. */
export function hasRichText(content: unknown): boolean {
  const root = (content as { root?: LexicalNode } | null)?.root;
  if (!root?.children?.length) return false;
  const hasContent = (n: LexicalNode): boolean =>
    Boolean(n.text && n.text.trim()) ||
    n.type === "upload" ||
    n.type === "horizontalrule" ||
    (n.children ?? []).some(hasContent);
  return root.children.some(hasContent);
}
