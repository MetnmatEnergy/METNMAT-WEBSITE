import { describe, it, expect } from "vitest";
import { MAX_LATEX_LENGTH, renderLatex } from "../apps/website/src/frontend/lib/widgets/latex";

/**
 * Blog equations are the one place the article renderer injects HTML, so the
 * HTML must be KaTeX's own and nothing a LaTeX source can smuggle through.
 * KaTeX's `trust: false` is what refuses links, images and attribute
 * commands; these tests fail if anyone loosens it.
 */
const html = (src: string, display = false) => {
  const r = renderLatex(src, display);
  return r.ok ? r.html : "";
};

describe("blog equations (KaTeX, server-side)", () => {
  it("renders display and inline equations with MathML for screen readers", () => {
    const d = renderLatex("\\Delta G^\\circ = \\Delta H^\\circ - T\\,\\Delta S^\\circ", true);
    expect(d.ok).toBe(true);
    expect(html("\\Delta G^\\circ = A + BT", true)).toContain("katex-display");
    expect(html("i_p = 0.4463\\,nFAC\\sqrt{\\frac{nFvD}{RT}}")).toContain("<math");
    expect(html("x^2")).not.toContain("katex-display");
  });

  it("reports invalid LaTeX instead of rendering a broken formula", () => {
    const r = renderLatex("\\frac{1}{", false);
    expect(r.ok).toBe(false);
    expect(renderLatex("", true).ok).toBe(false);
    expect(renderLatex(42, true).ok).toBe(false);
    expect(renderLatex("x".repeat(MAX_LATEX_LENGTH + 1), true).ok).toBe(false);
  });

  it("never emits a link, image, script or caller-chosen attribute", () => {
    const attacks = [
      "\\href{javascript:alert(1)}{click}",
      "\\url{https://evil.example}",
      "\\includegraphics{https://evil.example/x.png}",
      "\\htmlClass{evil}{x}",
      "\\htmlId{evil}{x}",
      "\\htmlStyle{background:url(https://evil.example)}{x}",
      "\\htmlData{onclick=alert(1)}{x}",
      "<script>alert(1)</script>",
      "\\text{<img src=x onerror=alert(1)>}",
    ];
    for (const a of attacks) {
      // The source may appear as escaped TEXT (MathML annotation, \text{}); what
      // must never appear is a tag or attribute it chose. Check the tags alone.
      const tags = (html(a).match(/<[^>]*>/g) ?? []).join(" ");
      expect(tags.length, a).toBeGreaterThan(0);
      expect(tags, a).not.toMatch(/<a\b|<img|<script|<iframe|href=|src=|javascript:|\bon\w+=|evil|data-/i);
      expect(tags, a).toMatch(/^(<\/?(span|math|semantics|mrow|mi|mo|mn|ms|mtext|mstyle|annotation|mspace|svg|path|line)\b[^>]*>\s?)+$/);
    }
    // Refused commands show as plain red source text, which is what the editor sees in preview.
    expect(html("\\href{https://evil.example}{x}")).toContain("\\href");
  });

  it("stops a macro bomb instead of hanging the render", () => {
    const t0 = performance.now();
    const r = renderLatex("\\def\\a{\\a\\a}\\a", true);
    expect(r.ok).toBe(false);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
