/**
 * Lexical block renderers for blog articles, keyed by the CMS block slugs in
 * apps/dashboard/src/blocks/blog-blocks.ts:
 *   equation        display LaTeX, its own line
 *   inlineEquation  LaTeX inside a paragraph
 *   interactive     a reviewed widget from ./widgets, driven by JSON config
 *
 * Server-only: KaTeX and the zod schemas run here and never ship to the
 * browser. The KaTeX stylesheet is bundled by Next and served from this
 * origin with its fonts, so the existing CSP (style-src/font-src 'self')
 * already covers it; nothing is fetched from a CDN.
 */
import "server-only";
import "katex/dist/katex.min.css";
import type { RichTextBlocks } from "./rich-text";
import { Equation } from "./equation";
import { InteractiveBlock } from "./interactive-block";

export const BLOG_BLOCKS: RichTextBlocks = {
  equation: ({ fields }) => <Equation latex={fields.latex} display />,
  inlineEquation: ({ fields }) => <Equation latex={fields.latex} display={false} />,
  interactive: ({ fields, seq }) => <InteractiveBlock fields={fields} seq={seq} />,
};
