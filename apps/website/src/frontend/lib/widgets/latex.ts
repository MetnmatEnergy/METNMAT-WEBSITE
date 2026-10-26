/**
 * LaTeX → HTML for blog equations, rendered on the server so the reader
 * downloads KaTeX's stylesheet and fonts but none of its JavaScript.
 *
 * This is the one place the blog renderer accepts HTML, and the HTML is
 * KaTeX's own output, never the CMS's. The source is treated as untrusted:
 *  - trust: false refuses \href, \url, \includegraphics and the \html*
 *    commands, so a formula cannot carry a link, an attribute or a class;
 *  - maxExpand bounds macro expansion (a \def bomb cannot hang the render);
 *  - maxSize caps user-set dimensions in em;
 *  - the source length is capped before KaTeX sees it.
 * test/blog-equation.test.ts asserts each of these.
 */
import katex from "katex";

export const MAX_LATEX_LENGTH = 2000;

export type LatexResult = { ok: true; html: string } | { ok: false; error: string };

export function renderLatex(latex: unknown, displayMode: boolean): LatexResult {
  const src = typeof latex === "string" ? latex.trim() : "";
  if (!src) return { ok: false, error: "empty equation" };
  if (src.length > MAX_LATEX_LENGTH) return { ok: false, error: `equation longer than ${MAX_LATEX_LENGTH} characters` };
  try {
    const html = katex.renderToString(src, {
      displayMode,
      output: "htmlAndMathml", // MathML for screen readers, HTML for everyone else
      throwOnError: true,
      trust: false,
      strict: "ignore",
      maxExpand: 1000,
      maxSize: 20,
    });
    return { ok: true, html };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.replace(/^KaTeX parse error: /, "") : "invalid LaTeX" };
  }
}
