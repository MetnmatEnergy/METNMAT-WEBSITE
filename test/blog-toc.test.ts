import { describe, it, expect } from "vitest";
import { extractToc, headingId } from "../apps/website/src/frontend/lib/blog-toc";

const heading = (tag: string, text: string) => ({
  type: "heading",
  tag,
  children: [{ type: "text", text }],
});

const doc = (children: unknown[]) => ({ root: { children } });

describe("headingId", () => {
  it("slugs and deduplicates against the taken set", () => {
    const taken = new Set<string>();
    expect(headingId("Results & Discussion", taken)).toBe("results-discussion");
    expect(headingId("Results & Discussion", taken)).toBe("results-discussion-2");
    expect(headingId("Results & Discussion", taken)).toBe("results-discussion-3");
  });
  it("falls back for symbol-only headings", () => {
    expect(headingId("!!!", new Set())).toBe("section");
  });
});

describe("extractToc", () => {
  it("collects h2/h3 in order with levels", () => {
    const toc = extractToc(
      doc([
        heading("h2", "Introduction"),
        { type: "paragraph", children: [{ type: "text", text: "…" }] },
        heading("h3", "Background"),
        heading("h2", "Methods"),
      ]),
    );
    expect(toc.map((t) => t.text)).toEqual(["Introduction", "Background", "Methods"]);
    expect(toc.map((t) => t.level)).toEqual([2, 3, 2]);
  });
  it("downgrades h1 to level 2 and skips h4+", () => {
    const toc = extractToc(doc([heading("h1", "Top"), heading("h4", "Deep")]));
    expect(toc).toHaveLength(1);
    expect(toc[0].level).toBe(2);
  });
  it("ids match the renderer's dedupe order for duplicate headings", () => {
    const toc = extractToc(doc([heading("h2", "Setup"), heading("h2", "Setup")]));
    expect(toc.map((t) => t.id)).toEqual(["setup", "setup-2"]);
  });
  it("handles empty/invalid documents", () => {
    expect(extractToc(null)).toEqual([]);
    expect(extractToc({})).toEqual([]);
  });
});
