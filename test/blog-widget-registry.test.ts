import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WIDGET_IDS } from "../apps/website/src/frontend/lib/widgets/schemas";
import { BLOG_WIDGETS, EquationBlock, InlineEquationBlock, InteractiveBlock } from "../apps/dashboard/src/blocks/blog-blocks";
import { Posts } from "../apps/dashboard/src/collections/Posts";
import { seedBlogCategories } from "../apps/dashboard/src/content-data";

/**
 * Interactive articles span both apps: the CMS offers block types and widget
 * ids, the website renders them. Each list below is maintained by hand in two
 * places, and a mismatch fails quietly (a block that renders nothing, a widget
 * the editor can pick that the site cannot draw), so the lists are compared
 * here.
 */
const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const WEB = "apps/website/src/frontend/components/blog";

describe("blog widgets: CMS and website agree", () => {
  it("the CMS widget select offers exactly the widgets the website validates", () => {
    expect(BLOG_WIDGETS.map((w) => w.value).sort()).toEqual([...WIDGET_IDS].sort());
  });

  it("the website mounts a component for every widget id", () => {
    const registry = read(`${WEB}/widgets/registry.tsx`);
    for (const id of WIDGET_IDS) expect(registry, id).toContain(`case "${id}":`);
    // one next/dynamic chunk per widget, so articles only download what they use
    expect(registry.match(/dynamic\(\(\) => import\(/g)?.length).toBe(WIDGET_IDS.length);
  });

  it("the website renders every block slug the Posts editor offers", () => {
    const blocks = read(`${WEB}/blog-blocks.tsx`);
    for (const b of [EquationBlock, InlineEquationBlock, InteractiveBlock]) {
      expect(blocks, b.slug).toMatch(new RegExp(`\\b${b.slug}: \\(`));
    }
    const posts = read("apps/dashboard/src/collections/Posts.ts");
    expect(posts).toMatch(/BlocksFeature\(\{ blocks: \[EquationBlock, InteractiveBlock\], inlineBlocks: \[InlineEquationBlock\] \}\)/);
  });

  it("the interactive block carries widget, config, title and caption", () => {
    const names = InteractiveBlock.fields.map((f) => ("name" in f ? f.name : ""));
    expect(names).toEqual(["widget", "title", "config", "caption"]);
    const config = InteractiveBlock.fields.find((f) => "name" in f && f.name === "config") as { type: string; validate: (v: unknown) => unknown };
    expect(config.type).toBe("json");
    expect(config.validate({ a: 1 })).toBe(true);
    expect(config.validate([1, 2])).toMatch(/JSON object/);
    expect(config.validate("x")).toMatch(/JSON object/);
  });

  it("the admin import map registers the blocks feature's client component", () => {
    const map = read("apps/dashboard/src/app/(payload)/admin/importMap.js");
    expect(map).toContain('"@payloadcms/richtext-lexical/client#BlocksFeatureClient": BlocksFeatureClient_');
    expect(map).toMatch(/import \{ BlocksFeatureClient as BlocksFeatureClient_\w+ \} from '@payloadcms\/richtext-lexical\/client'/);
  });
});

describe("blog storage and taxonomy", () => {
  it("keeps at most 10 versions per article", () => {
    expect(Posts.versions).toMatchObject({ drafts: true, maxPerDoc: 10 });
  });

  it("seeds a Metallurgy category through the create-if-missing path", () => {
    expect(seedBlogCategories.find((c) => c.slug === "metallurgy")?.name).toBe("Metallurgy");
    const seed = read("apps/dashboard/src/seed.ts");
    // seedPlain only runs on an empty collection, so an existing database
    // needs the per-slug top-up; it must count first and never update.
    const block = /const ensureBlogCategorySlugs = \[([^\]]*)\];([\s\S]*?)ensure blog categories failed/.exec(seed);
    expect(block?.[1]).toContain('"metallurgy"');
    expect(block?.[2]).toMatch(/payload\.count\(\{\s*collection: "blog-categories",\s*where: \{ slug: \{ equals: slug \} \}/);
    expect(block?.[2]).toMatch(/if \(totalDocs === 0\)/);
    expect(block?.[2]).not.toMatch(/payload\.update|payload\.delete/);
  });
});

describe("the blog renderer's bundle boundary", () => {
  it("keeps KaTeX and the schemas out of rich-text.tsx, which a client component imports", () => {
    const imports = (p: string) => (read(p).match(/^import [^;]*;$/gm) ?? []).join("\n");
    expect(imports(`${WEB}/rich-text.tsx`)).not.toMatch(/katex|widgets\/|blog-blocks|equation|interactive-block|zod/);
    expect(imports("apps/website/src/frontend/components/commerce/product-tabs.tsx")).not.toMatch(/blog-blocks/);
  });

  it("marks the block map server-only, and the client registry imports schema TYPES only", () => {
    expect(read(`${WEB}/blog-blocks.tsx`)).toMatch(/^import "server-only";$/m);
    const registry = read(`${WEB}/widgets/registry.tsx`);
    expect(registry).toMatch(/^"use client";/);
    expect(registry).toMatch(/import type \{ ValidWidget \} from "@\/frontend\/lib\/widgets\/schemas"/);
    for (const w of ["ellingham", "cyclic-voltammetry", "function-plot"]) {
      expect(read(`${WEB}/widgets/${w}.tsx`), w).not.toMatch(/^import \{[^}]*\} from "@\/frontend\/lib\/widgets\/schemas"/m);
    }
  });

  it("never evaluates widget expressions as code", () => {
    const expr = read("apps/website/src/frontend/lib/widgets/expr.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(expr).not.toMatch(/\beval\s*\(|new Function|Function\s*\(/);
  });
});
