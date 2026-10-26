import type { PayloadRequest } from "payload";
import { convertMarkdownToLexical, editorConfigFactory } from "@payloadcms/richtext-lexical";
import {
  decodeCover,
  isPipelineTag,
  ingestAuthorized,
  ingestEmailHtml,
  injectBlocks,
  prepareMarkdown,
  publishTime,
  type CoverInput,
  type IngestWidget,
  type LexicalNode,
  type PublishMode,
} from "./blog-ingest";

/**
 * POST /api/posts/ingest and GET /api/posts/ingest-state: the weekly article
 * pipeline's way into the CMS (scripts/blog/weekly.ts, run by
 * .github/workflows/blog-weekly.yml).
 *
 * Authenticated by `x-ingest-key` = CMS_BLOG_INGEST_KEY and nothing else (see
 * ingestAuthorized). Without that variable the endpoints answer 503, so a CMS
 * that was never given a key cannot be written to this way.
 */

const WEBSITE = () => (process.env.WEBSITE_URL || "https://www.metnmat.com").replace(/\/+$/, "");
const CMS = () => (process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || "https://admin.metnmat.com").replace(/\/+$/, "");
// Article JSON is well under 200 KB; the rest is room for a base64 cover (≤ 2 MB raw).
const MAX_BODY_BYTES = 3_000_000;

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const json = (body: unknown, status = 200) => Response.json(body, { status });

function gate(req: PayloadRequest): Response | null {
  if (!process.env.CMS_BLOG_INGEST_KEY) return json({ error: "Article ingest is not configured on this CMS" }, 503);
  if (!ingestAuthorized(req.headers.get("x-ingest-key"))) return json({ error: "Unauthorized" }, 401);
  return null;
}

async function idsBySlug(req: PayloadRequest, collection: "blog-categories" | "blog-content-types", slugs: string[]) {
  if (!slugs.length) return new Map<string, string>();
  const r = await req.payload.find({ collection, where: { slug: { in: slugs } }, limit: 50, depth: 0, overrideAccess: true });
  return new Map(r.docs.map((d) => [String((d as { slug?: string }).slug), String(d.id)]));
}

/** GET /api/posts/ingest-state: what the pipeline needs to choose a topic and fill the brief. */
export async function ingestState(req: PayloadRequest): Promise<Response> {
  const denied = gate(req);
  if (denied) return denied;
  const [posts, cats, types] = await Promise.all([
    req.payload.find({
      collection: "posts",
      draft: true,
      limit: 500,
      depth: 0,
      sort: "-createdAt",
      overrideAccess: true,
      select: { title: true, slug: true, excerpt: true, referenceNumber: true, pipelineTopics: true, _status: true, publishedDate: true },
    }),
    req.payload.find({ collection: "blog-categories", limit: 100, depth: 0, overrideAccess: true }),
    req.payload.find({ collection: "blog-content-types", limit: 100, depth: 0, overrideAccess: true }),
  ]);
  const pick = (d: Record<string, unknown>) => ({ slug: d.slug, name: d.name ?? d.title ?? d.label ?? d.slug });
  return json({
    posts: posts.docs.map((d) => {
      const p = d as Record<string, unknown>;
      return {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        pipelineTopics: p.pipelineTopics ?? null,
        referenceNumber: p.referenceNumber ?? null, // older pipeline articles kept their tag here
        status: p._status,
        publishedDate: p.publishedDate ?? null,
      };
    }),
    categories: cats.docs.map((d) => pick(d as Record<string, unknown>)),
    contentTypes: types.docs.map((d) => pick(d as Record<string, unknown>)),
  });
}

type IngestBody = {
  article?: Record<string, unknown>;
  widgets?: Record<string, IngestWidget>;
  publish?: { mode?: PublishMode; at?: string };
  notes?: string[];
  linkedin?: string;
  cover?: CoverInput;
};

/**
 * Puts the cover in the media library (S3 in production) and returns its id.
 * A file of the same name is reused, so re-running the pipeline on an
 * unchanged article does not pile up copies; the pipeline names covers by a
 * hash of their content, so a changed cover gets a new file.
 */
async function uploadCover(req: PayloadRequest, cover: NonNullable<Extract<ReturnType<typeof decodeCover>, { ok: true }>["cover"]>): Promise<string> {
  const existing = await req.payload.find({ collection: "media", where: { filename: { equals: cover.filename } }, limit: 1, depth: 0, overrideAccess: true });
  if (existing.docs[0]) return String(existing.docs[0].id);
  const media = await req.payload.create({
    collection: "media",
    data: { alt: cover.alt, category: "other" },
    file: { data: cover.buffer, mimetype: cover.mimeType, name: cover.filename, size: cover.buffer.length },
    overrideAccess: true,
  });
  return String(media.id);
}

/** POST /api/posts/ingest: creates the article, or updates the one with the same slug. */
export async function ingestArticle(req: PayloadRequest): Promise<Response> {
  const denied = gate(req);
  if (denied) return denied;

  let raw = "";
  try {
    raw = (await req.text?.()) ?? "";
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);
  let body: IngestBody;
  try {
    body = JSON.parse(raw) as IngestBody;
  } catch {
    return json({ error: "Body is not JSON" }, 400);
  }

  const a = body.article ?? {};
  const title = str(a.title, 200);
  const slug = str(a.slug, 120);
  const excerpt = str(a.excerpt, 400);
  const markdown = typeof a.body_markdown === "string" ? a.body_markdown : "";
  const problems: string[] = [];
  if (!title) problems.push("article.title is required");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) problems.push("article.slug must be kebab-case");
  if (!excerpt) problems.push("article.excerpt is required");
  if (markdown.length < 2000 || markdown.length > 120_000) problems.push("article.body_markdown must be 2,000–120,000 characters");
  const widgets = body.widgets ?? {};
  if (Object.keys(widgets).length > 4) problems.push("at most 4 widgets");
  const mode: PublishMode = body.publish?.mode ?? "draft";
  if (!["draft", "immediate", "scheduled"].includes(mode)) problems.push("publish.mode must be draft, immediate or scheduled");
  if (problems.length) return json({ error: "Invalid article", problems }, 400);

  const when = publishTime(mode, body.publish?.at);
  if (!when.ok) return json({ error: when.error }, 400);

  // Markdown → the Posts editor's own Lexical shapes, then the block placeholders → blocks.
  let content: { root: { children: LexicalNode[] } };
  try {
    const prepared = prepareMarkdown(markdown, widgets);
    const field = req.payload.collections.posts.config.flattenedFields.find((f) => "name" in f && f.name === "body");
    if (!field || field.type !== "richText") throw new Error("Posts.body is not a rich-text field");
    const editorConfig = editorConfigFactory.fromField({ field });
    const state = convertMarkdownToLexical({ editorConfig, markdown: prepared.markdown }) as unknown as { root: { children: LexicalNode[] } };
    content = injectBlocks(state, prepared);
  } catch (e) {
    return json({ error: `Could not convert the article: ${(e as Error).message}` }, 400);
  }

  const catSlugs = [str(a.primaryCategory, 60), ...(Array.isArray(a.secondaryCategories) ? a.secondaryCategories.map((s) => str(s, 60)) : [])].filter(Boolean);
  const [cats, types] = await Promise.all([idsBySlug(req, "blog-categories", catSlugs), idsBySlug(req, "blog-content-types", [str(a.contentType, 60)].filter(Boolean))]);
  const primaryCategory = cats.get(str(a.primaryCategory, 60)) ?? cats.get("insights");
  const secondaryCategories = catSlugs.slice(1).map((s) => cats.get(s)).filter((v): v is string => !!v);

  const refs = Array.isArray(a.references) ? (a.references as Record<string, unknown>[]).slice(0, 30) : [];
  const data: Record<string, unknown> = {
    title,
    slug,
    subtitle: str(a.subtitle, 300) || undefined,
    excerpt,
    abstract: str(a.abstract, 2000) || undefined,
    body: content,
    researchArea: str(a.researchArea, 120) || undefined,
    keywords: str(a.keywords, 600) || undefined,
    tags: (Array.isArray(a.tags) ? a.tags : []).slice(0, 10).map((t) => ({ tag: str(t, 60) })).filter((t) => t.tag),
    author: str(a.author, 120) || "METNMAT Research Team",
    // The topic tag is bookkeeping and goes in the hidden field; a tag sent the old way
    // (as referenceNumber) is moved there too. A real report number stays visible.
    pipelineTopics: str(a.pipelineTopics, 120) || (isPipelineTag(a.referenceNumber) ? str(a.referenceNumber, 120) : undefined),
    referenceNumber: isPipelineTag(a.referenceNumber) ? undefined : str(a.referenceNumber, 60) || undefined,
    seoTitle: str(a.seoTitle, 70) || undefined,
    metaDescription: str(a.metaDescription, 170) || undefined,
    primaryCategory,
    secondaryCategories,
    contentType: types.get(str(a.contentType, 60)),
    references: refs
      .map((r) => ({
        authors: str(r.authors, 300) || undefined,
        title: str(r.title, 400),
        source: str(r.source, 200) || undefined,
        year: typeof r.year === "number" && r.year > 1500 && r.year < 2100 ? r.year : undefined,
        volume: str(r.volume, 30) || undefined,
        issue: str(r.issue, 30) || undefined,
        pages: str(r.pages, 40) || undefined,
        doi: str(r.doi, 200) || undefined,
        url: /^https?:\/\//.test(str(r.url, 500)) ? str(r.url, 500) : undefined,
      }))
      .filter((r) => r.title),
    workflowStatus: mode === "draft" ? "in-review" : "approved",
    _status: mode === "draft" ? "draft" : "published",
    ...(when.date ? { publishedDate: when.date.toISOString() } : {}),
  };

  // The cover never blocks the article: a bad or failed one is reported, and the post goes out without it.
  const warnings: string[] = [];
  const cover = decodeCover(body.cover);
  if (!cover.ok) warnings.push(`cover ignored: ${cover.error}`);
  else if (cover.cover) {
    try {
      data.coverImage = await uploadCover(req, cover.cover);
      data.coverImageAlt = cover.cover.alt;
    } catch (e) {
      warnings.push(`cover upload failed: ${(e as Error).message}`);
      req.payload.logger.error(`[posts/ingest] cover upload failed for ${slug}: ${(e as Error).message}`);
    }
  }

  let doc: { id: string | number; slug?: string };
  let created = false;
  try {
    const existing = await req.payload.find({ collection: "posts", where: { slug: { equals: slug } }, draft: true, limit: 1, depth: 0, overrideAccess: true });
    if (existing.docs[0]) {
      // An article filed before pipelineTopics existed shows its tag to readers as "Reference": clear it.
      if (isPipelineTag((existing.docs[0] as { referenceNumber?: unknown }).referenceNumber) && data.referenceNumber === undefined) {
        data.referenceNumber = null;
      }
      doc = (await req.payload.update({ collection: "posts", id: existing.docs[0].id, data, draft: mode === "draft", overrideAccess: true, req })) as typeof doc;
    } else {
      doc = (await req.payload.create({ collection: "posts", data, draft: mode === "draft", overrideAccess: true, req })) as typeof doc;
      created = true;
    }
  } catch (e) {
    req.payload.logger.error(`[posts/ingest] save failed for ${slug}: ${(e as Error).message}`);
    return json({ error: `Could not save the article: ${(e as Error).message}` }, 500);
  }

  const liveUrl = `${WEBSITE()}/blog/${slug}`;
  const adminUrl = `${CMS()}/admin/collections/posts/${doc.id}`;
  const whenText = when.date && mode === "scheduled" ? `${when.date.toISOString().replace("T", " ").slice(0, 16)} UTC` : null;
  const to = (process.env.BLOG_NOTIFY_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (to.length) {
    try {
      await req.payload.sendEmail({
        to,
        subject: `${mode === "draft" ? "Draft" : mode === "scheduled" ? "Scheduled" : "Published"}: ${title}`,
        html: ingestEmailHtml({
          title,
          status: mode,
          when: whenText,
          liveUrl,
          adminUrl,
          notes: [...warnings, ...(Array.isArray(body.notes) ? body.notes : []).slice(0, 20).map((n) => str(n, 400))],
          linkedin: str(body.linkedin, 3000) || undefined,
        }),
      });
    } catch (e) {
      req.payload.logger.error(`[posts/ingest] notification failed for ${slug}: ${(e as Error).message}`);
    }
  }
  req.payload.logger.info(`[posts/ingest] ${created ? "created" : "updated"} ${slug} (${mode})`);
  return json(
    { ok: true, id: doc.id, slug, created, mode, publishedDate: when.date?.toISOString() ?? null, liveUrl, adminUrl, cover: data.coverImage ?? null, warnings },
    created ? 201 : 200,
  );
}
