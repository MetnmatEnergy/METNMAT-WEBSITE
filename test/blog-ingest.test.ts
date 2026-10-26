import { describe, it, expect, afterEach } from "vitest";
import {
  ingestAuthorized,
  ingestEmailHtml,
  injectBlocks,
  prepareMarkdown,
  publishTime,
  type LexicalNode,
} from "../apps/dashboard/src/lib/blog-ingest";
import { Posts } from "../apps/dashboard/src/collections/Posts";

/**
 * The CMS half of the weekly article pipeline: Markdown with maths and widget
 * placeholders becomes Lexical with equation / inlineEquation / interactive
 * blocks, and only the purpose key may write.
 */

const WIDGETS = {
  main: { widget: "ellingham", title: "Ellingham", caption: "Cap.", config: { temperatureRangeC: [25, 1500], lines: [] } },
};

describe("prepareMarkdown", () => {
  it("turns display maths and widgets into paragraph placeholders, inline maths into tokens", () => {
    const p = prepareMarkdown("Intro with $E = mc^2$ inline.\n\n$$\\Delta G = -nFE$$\n\n{{widget:main}}\n\nEnd.", WIDGETS);
    expect(p.blocks).toEqual([
      { blockType: "equation", latex: "\\Delta G = -nFE" },
      { blockType: "interactive", widget: "ellingham", title: "Ellingham", caption: "Cap.", config: WIDGETS.main.config },
    ]);
    expect(p.inlines).toEqual([{ blockType: "inlineEquation", latex: "E = mc^2" }]);
    expect(p.markdown).toContain("Intro with @@INLINE0@@ inline.");
    expect(p.markdown).toMatch(/\n\n@@BLOCK0@@\n\n/);
    expect(p.markdown).toMatch(/\n\n@@BLOCK1@@\n\n/);
  });

  it("drops editor notes and figure placeholders, which have no place on the public site", () => {
    const p = prepareMarkdown("Para.\n\n[EDITOR: real METNMAT lab story about X]\n\n{{figure:cv-shape}}\n\nNext.", {});
    expect(p.markdown).not.toMatch(/EDITOR|figure/);
    expect(p.markdown).toContain("Para.");
    expect(p.markdown).toContain("Next.");
  });

  it("leaves an escaped dollar sign alone", () => {
    const p = prepareMarkdown("It costs \\$5 and \\$10.", {});
    expect(p.inlines).toHaveLength(0);
  });

  it("refuses a widget placeholder without a config", () => {
    expect(() => prepareMarkdown("{{widget:missing}}", {})).toThrow(/missing/);
  });
});

describe("injectBlocks", () => {
  const text = (t: string, format = 0): LexicalNode => ({ type: "text", text: t, format, detail: 0, mode: "normal", style: "", version: 1 });
  const para = (...children: LexicalNode[]): LexicalNode => ({ type: "paragraph", children, version: 1 });
  let n = 0;
  const id = () => `id${++n}`;

  it("replaces placeholder paragraphs with blocks and splits inline tokens, keeping the text's format", () => {
    const p = prepareMarkdown("A $x$ b.\n\n$$y$$\n", {});
    const state = { root: { type: "root", children: [para(text("A @@INLINE0@@ b.", 1)), para(text("@@BLOCK0@@"))] } };
    const out = injectBlocks(state, p, id);
    const [first, second] = out.root.children;
    expect(first!.children!.map((c) => c.type)).toEqual(["text", "inlineBlock", "text"]);
    expect(first!.children![0]).toMatchObject({ text: "A ", format: 1 });
    expect(first!.children![1]).toEqual({ type: "inlineBlock", version: 1, fields: { id: "id1", blockName: "", blockType: "inlineEquation", latex: "x" } });
    expect(second).toEqual({ type: "block", version: 2, format: "", fields: { id: "id2", blockName: "", blockType: "equation", latex: "y" } });
  });

  it("refuses to return a tree that still contains a placeholder", () => {
    const p = prepareMarkdown("$$y$$", {});
    // the converter merged the placeholder into a longer paragraph: it must not leak to the site
    const state = { root: { type: "root", children: [para(text("see @@BLOCK0@@ here"))] } };
    expect(() => injectBlocks(state, p, id)).toThrow(/unresolved/);
  });
});

describe("ingest authorisation", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("accepts only the purpose key, never the shared internal key, and fails closed when unset", () => {
    delete process.env.CMS_BLOG_INGEST_KEY;
    process.env.INTERNAL_API_KEY = "shared-key-shared-key";
    expect(ingestAuthorized("shared-key-shared-key")).toBe(false);
    expect(ingestAuthorized("")).toBe(false);

    process.env.CMS_BLOG_INGEST_KEY = "ingest-key-ingest-key";
    expect(ingestAuthorized("ingest-key-ingest-key")).toBe(true);
    expect(ingestAuthorized("shared-key-shared-key")).toBe(false);
    expect(ingestAuthorized("ingest-key-ingest-kez")).toBe(false);

    process.env.CMS_BLOG_INGEST_KEY = "PLACEHOLDER_SET_ME";
    expect(ingestAuthorized("PLACEHOLDER_SET_ME")).toBe(false);
  });

  it("is wired into the Posts collection", () => {
    const paths = (Posts.endpoints || []).map((e) => `${e.method} ${e.path}`);
    expect(paths).toContain("post /ingest");
    expect(paths).toContain("get /ingest-state");
  });
});

describe("publish timing", () => {
  const now = new Date("2026-10-26T09:00:00Z");
  it("drafts have no date, immediate is now, a schedule must be future and within 30 days", () => {
    expect(publishTime("draft", undefined, now)).toEqual({ ok: true, date: null });
    expect(publishTime("immediate", undefined, now)).toEqual({ ok: true, date: now });
    expect(publishTime("scheduled", "2026-10-29T04:30:00Z", now)).toEqual({ ok: true, date: new Date("2026-10-29T04:30:00Z") });
    expect(publishTime("scheduled", "2026-10-25T04:30:00Z", now).ok).toBe(false);
    expect(publishTime("scheduled", "2026-12-29T04:30:00Z", now).ok).toBe(false);
    expect(publishTime("scheduled", "not a date", now).ok).toBe(false);
  });
});

describe("notification email", () => {
  it("escapes everything the model wrote", () => {
    const html = ingestEmailHtml({
      title: "<script>x</script>",
      status: "scheduled",
      when: "2026-10-29 04:30 UTC",
      liveUrl: "https://www.metnmat.com/blog/a",
      adminUrl: "https://admin.metnmat.com/admin/collections/posts/1",
      notes: ["<b>n</b>"],
      linkedin: "<img src=x onerror=1>",
    });
    expect(html).not.toMatch(/<script>|<b>n<\/b>|<img/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Publishes automatically at");
  });
});
