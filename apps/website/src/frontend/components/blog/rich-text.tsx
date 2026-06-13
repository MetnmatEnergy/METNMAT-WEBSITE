/**
 * Minimal renderer for Payload's Lexical rich-text JSON (paragraphs, headings,
 * lists, quotes, links and inline bold/italic/underline/code). Defensive: any
 * unknown node renders its children so content never hard-fails.
 */
import React from "react";

type LexicalNode = {
  type?: string;
  tag?: string;
  text?: string;
  format?: number | string;
  listType?: string;
  url?: string;
  fields?: { url?: string; newTab?: boolean };
  children?: LexicalNode[];
};

const BOLD = 1;
const ITALIC = 2;
const STRIKETHROUGH = 4;
const UNDERLINE = 8;
const CODE = 16;

function renderText(node: LexicalNode, key: number): React.ReactNode {
  let el: React.ReactNode = node.text ?? "";
  const f = typeof node.format === "number" ? node.format : 0;
  if (f & CODE) el = <code key={key} className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">{el}</code>;
  if (f & BOLD) el = <strong key={key}>{el}</strong>;
  if (f & ITALIC) el = <em key={key}>{el}</em>;
  if (f & UNDERLINE) el = <u key={key}>{el}</u>;
  if (f & STRIKETHROUGH) el = <s key={key}>{el}</s>;
  return <React.Fragment key={key}>{el}</React.Fragment>;
}

function renderNodes(nodes: LexicalNode[] | undefined): React.ReactNode {
  if (!nodes?.length) return null;
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return renderText(node, i);
      case "paragraph":
        return (
          <p key={i} className="leading-relaxed">
            {renderNodes(node.children)}
          </p>
        );
      case "heading": {
        const Tag = (node.tag === "h1" ? "h2" : node.tag || "h2") as "h2" | "h3" | "h4";
        return (
          <Tag key={i} className="mt-8 font-display font-semibold text-foreground first:mt-0">
            {renderNodes(node.children)}
          </Tag>
        );
      }
      case "list": {
        const ListTag = node.listType === "number" ? "ol" : "ul";
        return (
          <ListTag
            key={i}
            className={`ml-5 space-y-1 ${ListTag === "ol" ? "list-decimal" : "list-disc"}`}
          >
            {renderNodes(node.children)}
          </ListTag>
        );
      }
      case "listitem":
        return <li key={i}>{renderNodes(node.children)}</li>;
      case "quote":
        return (
          <blockquote key={i} className="border-l-2 border-brand pl-4 italic text-foreground/80">
            {renderNodes(node.children)}
          </blockquote>
        );
      case "link": {
        const href = node.fields?.url || node.url || "#";
        return (
          <a key={i} href={href} className="text-brand underline underline-offset-4 hover:text-brand-soft">
            {renderNodes(node.children)}
          </a>
        );
      }
      case "linebreak":
        return <br key={i} />;
      case "horizontalrule":
        return <hr key={i} className="my-8 border-border" />;
      default:
        return <React.Fragment key={i}>{renderNodes(node.children)}</React.Fragment>;
    }
  });
}

export function RichText({ content }: { content: unknown }) {
  const root = (content as { root?: LexicalNode } | null)?.root;
  if (!root?.children?.length) return null;
  return <div className="space-y-4 text-muted-foreground">{renderNodes(root.children)}</div>;
}

/** True when the Lexical document has at least one non-empty node. */
export function hasRichText(content: unknown): boolean {
  const root = (content as { root?: LexicalNode } | null)?.root;
  if (!root?.children?.length) return false;
  const hasText = (n: LexicalNode): boolean =>
    Boolean(n.text && n.text.trim()) || (n.children ?? []).some(hasText);
  return root.children.some(hasText);
}
