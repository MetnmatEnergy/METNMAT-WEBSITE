/**
 * One LaTeX equation, typeset by KaTeX on the server (see lib/widgets/latex.ts
 * for why the HTML it injects is safe). Display equations scroll sideways on
 * a narrow screen instead of overflowing the column.
 *
 * A formula KaTeX cannot parse shows its source in a marked box, so a typo is
 * visible in the editor's preview rather than silently missing.
 */
import { renderLatex } from "@/frontend/lib/widgets/latex";

export function Equation({ latex, display }: { latex: unknown; display: boolean }) {
  const r = renderLatex(latex, display);
  if (!r.ok) {
    const src = typeof latex === "string" ? latex : "";
    const box = (
      <code
        className="rounded border border-dashed border-brand/60 bg-muted px-1.5 py-0.5 text-[0.85em] text-foreground"
        title={`Equation error: ${r.error}`}
      >
        {src || "(empty equation)"}
      </code>
    );
    return display ? <div className="my-6 overflow-x-auto text-center">{box}</div> : box;
  }
  return display ? (
    <div
      className="blog-equation my-6 overflow-x-auto overflow-y-hidden py-1 text-foreground"
      dangerouslySetInnerHTML={{ __html: r.html }}
    />
  ) : (
    <span className="blog-equation text-foreground" dangerouslySetInnerHTML={{ __html: r.html }} />
  );
}
