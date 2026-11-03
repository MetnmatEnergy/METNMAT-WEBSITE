/**
 * Publish the 15 metnmat.in posts prepared in docs/blog/articles/metnmat-in-2023
 * (see its README) — WITHOUT a single email.
 *
 * On 2026-10-29, 14 of them were filed as drafts through /api/posts/ingest, which
 * mails BLOG_NOTIFY_EMAIL a "Draft: …" notice per article. For this move the owner
 * wants no mail at all (2026-11-03), so this script never goes near the ingest
 * endpoint: it writes the `posts` collection directly, whose hooks only audit and
 * revalidate the website. Email is switched off twice over: the Resend key and
 * BLOG_NOTIFY_EMAIL are removed before the config loads (the adapter then only
 * logs), and payload.sendEmail is replaced by a stub that counts and refuses.
 *
 * Each article is built the way the ingest builds it (same Markdown → Lexical
 * conversion, same field mapping), from the corrected article.md, and published
 * with the original 2023 date from meta.json → republishedFrom.datePublished. A
 * post without a cover gets one drawn from its title, as the pipeline does.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/publish-legacy-posts.ts --target=prod --dry-run
 *   npx tsx scripts/publish-legacy-posts.ts --target=prod --confirm
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { loadEnv, assertTarget, APP_DIR } from "./_bootstrap";
loadEnv();
// After loadEnv, which would otherwise put a key from .env back.
for (const k of ["RESEND_API_KEY", "BLOG_NOTIFY_EMAIL", "SALES_NOTIFY_EMAIL", "NOTIFY_EMAIL"]) delete process.env[k];

import { getPayload } from "payload";
import { convertMarkdownToLexical, editorConfigFactory } from "@payloadcms/richtext-lexical";
import { injectBlocks, prepareMarkdown, type IngestWidget, type LexicalNode } from "../src/lib/blog-ingest";
import { coverWebp, renderCoverSvg } from "../../../scripts/blog/cover";

const DIR = path.join(APP_DIR, "../../docs/blog/articles/metnmat-in-2023");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const CONFIRMED = argv.includes("--confirm");

type Meta = {
  title: string;
  slug: string;
  excerpt: string;
  metaDescription?: string;
  seoTitle?: string;
  primaryCategory?: string;
  secondaryCategories?: string[];
  contentType?: string;
  keywords?: string;
  tags?: string[];
  author?: string;
  references?: unknown[];
  republishedFrom: { url: string; datePublished: string };
};

function articles() {
  return fs
    .readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(DIR, d.name, "meta.json")))
    .map((d) => {
      const dir = path.join(DIR, d.name);
      const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")) as Meta;
      const markdown = fs.readFileSync(path.join(dir, "article.md"), "utf8").split("\r\n").join("\n");
      const widgets = JSON.parse(fs.readFileSync(path.join(dir, "widgets.json"), "utf8")) as Record<string, IngestWidget>;
      if (meta.slug !== d.name) throw new Error(`${d.name}: meta.slug is "${meta.slug}"`);
      if (markdown.length < 2000 || markdown.length > 120_000) throw new Error(`${d.name}: article.md is ${markdown.length} characters`);
      const date = new Date(meta.republishedFrom?.datePublished ?? "");
      if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== 2023) throw new Error(`${d.name}: no 2023 datePublished`);
      return { meta, markdown, widgets, date };
    });
}

async function main() {
  if (DRY === CONFIRMED) {
    console.error("Pass exactly one of --dry-run or --confirm.");
    process.exit(2);
  }
  const { target, dbName } = assertTarget(argv);
  const list = articles();
  console.log(`${list.length} articles in docs/blog/articles/metnmat-in-2023 → ${target} (${dbName})${DRY ? " — DRY RUN, nothing is written" : ""}`);

  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });
  const blocked: string[] = [];
  (payload as unknown as { sendEmail: (m: { subject?: string }) => Promise<unknown> }).sendEmail = async (m) => {
    blocked.push(m.subject ?? "(no subject)");
    return { skipped: true };
  };

  const bySlug = async (collection: "blog-categories" | "blog-content-types") => {
    const r = await payload.find({ collection, limit: 200, depth: 0, overrideAccess: true });
    return new Map(r.docs.map((d) => [String((d as { slug?: string }).slug), d as { id: string | number; name?: string; title?: string }]));
  };
  const [cats, types] = await Promise.all([bySlug("blog-categories"), bySlug("blog-content-types")]);
  const field = payload.collections.posts.config.flattenedFields.find((f) => "name" in f && f.name === "body");
  if (!field || field.type !== "richText") throw new Error("Posts.body is not a rich-text field");
  const editorConfig = editorConfigFactory.fromField({ field });

  // Pass 1 builds and checks every article; nothing is written unless all 15 pass.
  const problems: string[] = [];
  const plans: { slug: string; existing?: { id: string | number }; data: Record<string, unknown>; cover?: { webp: Buffer; filename: string; alt: string } }[] = [];
  for (const { meta, markdown, widgets, date } of list) {
    const prepared = prepareMarkdown(markdown, widgets);
    const state = convertMarkdownToLexical({ editorConfig, markdown: prepared.markdown }) as unknown as { root: { children: LexicalNode[] } };
    const body = injectBlocks(state, prepared);

    const primary = cats.get(meta.primaryCategory ?? "") ?? cats.get("insights");
    if (!primary) problems.push(`${meta.slug}: category "${meta.primaryCategory}" not found, and no "insights" fallback`);
    const secondary = (meta.secondaryCategories ?? []).map((s) => cats.get(s)).filter((c): c is NonNullable<typeof c> => !!c);
    const contentType = types.get(meta.contentType ?? "");
    // As the ingest does: a missing content type is left blank, not fatal.
    if (meta.contentType && !contentType) console.warn(`  (${meta.slug}: content type "${meta.contentType}" not found, left blank)`);

    const found = await payload.find({ collection: "posts", where: { slug: { equals: meta.slug } }, draft: true, limit: 1, depth: 0, overrideAccess: true });
    const existing = found.docs[0] as { id: string | number; _status?: string; coverImage?: unknown; title?: string } | undefined;

    const data: Record<string, unknown> = {
      title: meta.title,
      slug: meta.slug,
      excerpt: meta.excerpt,
      body,
      keywords: meta.keywords || undefined,
      tags: (meta.tags ?? []).slice(0, 10).map((tag) => ({ tag })),
      author: meta.author || "METNMAT Research Team",
      seoTitle: meta.seoTitle || undefined,
      metaDescription: meta.metaDescription || undefined,
      primaryCategory: primary?.id,
      secondaryCategories: secondary.map((c) => c.id),
      contentType: contentType?.id,
      workflowStatus: "approved",
      _status: "published",
      publishedDate: date.toISOString(),
    };

    let cover: (typeof plans)[number]["cover"];
    if (!existing?.coverImage) {
      const kicker = [primary, ...secondary].map((c) => c?.name ?? c?.title).filter(Boolean).join(" · ");
      const webp = await coverWebp(renderCoverSvg({ title: meta.title, kicker, widgets: [] }));
      cover = { webp, filename: `blog-${meta.slug}-${crypto.createHash("sha1").update(webp).digest("hex").slice(0, 8)}`, alt: meta.title };
    }
    plans.push({ slug: meta.slug, existing, data, cover });

    const action = existing ? `update ${existing._status ?? "?"} ${existing.id}` : "create";
    const coverNote = cover ? `new cover ${cover.filename} (${(cover.webp.length / 1024).toFixed(0)} KB)` : "keeps its cover";
    console.log(`  ${meta.slug}\n      ${action} → published ${date.toISOString().slice(0, 10)}, ${markdown.split(/\s+/).length} words, ${coverNote}`);
  }

  if (problems.length) {
    console.error(`\nREFUSED, nothing written — fix these first:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }

  // Pass 2: write.
  let written = 0;
  for (const p of CONFIRMED ? plans : []) {
    if (p.cover) {
      const same = await payload.find({ collection: "media", where: { filename: { equals: p.cover.filename } }, limit: 1, depth: 0, overrideAccess: true });
      const media =
        same.docs[0] ??
        (await payload.create({
          collection: "media",
          data: { alt: p.cover.alt, category: "other" } as never,
          file: { data: p.cover.webp, mimetype: "image/webp", name: p.cover.filename, size: p.cover.webp.length },
          overrideAccess: true,
        }));
      p.data.coverImage = media.id;
      p.data.coverImageAlt = p.cover.alt;
    }
    if (p.existing) await payload.update({ collection: "posts", id: p.existing.id, data: p.data as never, overrideAccess: true });
    else await payload.create({ collection: "posts", data: p.data as never, overrideAccess: true });
    written++;
    console.log(`  published /blog/${p.slug}`);
  }
  console.log(`\nEmails: ${blocked.length ? `${blocked.length} BLOCKED (${blocked.join(" | ")})` : "none attempted"}. None were sent.`);
  console.log(CONFIRMED ? `Published ${written} of ${list.length}.` : `Dry run OK: ${list.length} would be published.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
