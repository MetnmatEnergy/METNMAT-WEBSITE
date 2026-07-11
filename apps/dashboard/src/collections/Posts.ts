import crypto from "crypto";
import type { Access, CollectionConfig, Where } from "payload";
import { canManageContent, hasRoleOrArea, type Role } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { inboundKeyMatches } from "../lib/internal-key";
import { readingTimeFromLexical, slugify, validateHttpUrl } from "../lib/blog";

const xKey = (args: { req?: { headers?: unknown } }) =>
  (args.req?.headers as Headers | undefined)?.get?.("x-internal-key");

/**
 * Public visibility gate. Anonymous readers (the website) only ever see
 * articles that are published AND not archived AND whose publish time has
 * passed — this is what makes drafts private and scheduling work with zero
 * cron infrastructure. Staff and the website server (internal key, used for
 * secure previews) see everything.
 */
const publishedOnlyRead: Access = (args) => {
  // Staff only — a logged-in storefront CUSTOMER must not see drafts, so check
  // the auth collection, not just "any user".
  if ((args.req.user as { collection?: string } | null)?.collection === "users") return true;
  if (inboundKeyMatches(xKey(args), "CMS_BLOG_KEY")) return true;
  const gate: Where = {
    and: [
      { _status: { equals: "published" } },
      { archived: { not_equals: true } },
      {
        or: [
          { publishedDate: { exists: false } },
          { publishedDate: { less_than_equal: new Date().toISOString() } },
        ],
      },
    ],
  };
  return gate;
};

const WEBSITE = (process.env.WEBSITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** Signed, expiring preview URL for the website's draft-preview route. */
function previewUrl(slug: string): string {
  const exp = Date.now() + 60 * 60 * 1000; // 1 hour
  const secret = process.env.CMS_BLOG_KEY || process.env.INTERNAL_API_KEY || "";
  const sig = crypto.createHmac("sha256", secret).update(`${slug}.${exp}`).digest("hex");
  return `${WEBSITE}/api/blog/preview?slug=${encodeURIComponent(slug)}&exp=${exp}&sig=${sig}`;
}

/**
 * Blog articles — the METNMAT Research & Engineering Insights platform.
 * Shown on /blog and /blog/[slug]; drafts + scheduled publishing supported.
 * Aggregate reaction/view counters are maintained atomically by the
 * blog-reactions /react and posts /track-view endpoints — admin saves can
 * never clobber them (see the counter guard in beforeChange).
 */
export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Blog Article", plural: "Blog Articles" },
  admin: {
    group: "Blog",
    useAsTitle: "title",
    defaultColumns: ["title", "workflowStatus", "publishedDate", "_status", "viewCount", "likeCount"],
    description:
      "Articles on the website's Research & Engineering Insights (/blog). Draft → review → publish; scheduling = publish with a future date.",
    preview: (doc) => (doc?.slug ? previewUrl(String(doc.slug)) : null),
  },
  access: {
    read: publishedOnlyRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    // ── Sidebar: editorial workflow, scheduling, flags, metrics ─────────────
    {
      name: "workflowStatus",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "In review", value: "in-review" },
        { label: "Approved", value: "approved" },
      ],
      admin: {
        position: "sidebar",
        description: "Editorial stage while unpublished. Publishing/unpublishing is the Publish button (top right).",
      },
      index: true,
    },
    {
      name: "publishedDate",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description:
          "Publication time. Set a FUTURE time + Publish to schedule — the article goes live on the website at that time automatically.",
      },
      index: true,
    },
    { name: "lastReviewedAt", type: "date", admin: { position: "sidebar", date: { pickerAppearance: "dayOnly" } } },
    { name: "isFeatured", type: "checkbox", defaultValue: false, admin: { position: "sidebar", description: "Show in the featured section on /blog." }, index: true },
    { name: "isEditorsPick", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
    { name: "isPinned", type: "checkbox", defaultValue: false, admin: { position: "sidebar", description: "Pin to the top of the listing." } },
    { name: "allowReactions", type: "checkbox", defaultValue: true, admin: { position: "sidebar", description: "Allow Like / Dislike on this article." } },
    { name: "archived", type: "checkbox", defaultValue: false, admin: { position: "sidebar", description: "Hide from the public site without unpublishing history." }, index: true },
    { name: "viewCount", type: "number", defaultValue: 0, admin: { position: "sidebar", readOnly: true, description: "Unique-ish reads (system-maintained)." } },
    { name: "likeCount", type: "number", defaultValue: 0, admin: { position: "sidebar", readOnly: true } },
    { name: "dislikeCount", type: "number", defaultValue: 0, admin: { position: "sidebar", readOnly: true } },
    {
      name: "sourceSubmission",
      type: "relationship",
      relationTo: "blog-submissions",
      admin: { position: "sidebar", readOnly: true, description: "Publication request this draft was converted from." },
    },

    // ── Main editor: tabbed ──────────────────────────────────────────────────
    {
      type: "tabs",
      tabs: [
        {
          label: "Content",
          fields: [
            { name: "title", type: "text", required: true },
            {
              name: "slug",
              type: "text",
              required: true,
              unique: true,
              index: true,
              admin: {
                description:
                  "URL segment (auto-generated from the title when blank). Changing it after publication creates an automatic redirect from the old URL.",
              },
            },
            { name: "subtitle", type: "text" },
            {
              name: "excerpt",
              type: "textarea",
              required: true,
              admin: { description: "Short summary shown on the article card and in search results." },
            },
            {
              name: "abstract",
              type: "textarea",
              admin: { description: "Technical abstract shown at the top of the article (optional)." },
            },
            { name: "body", type: "richText", admin: { description: "The article body." } },
            { name: "coverImage", type: "upload", relationTo: "media" },
            {
              type: "row",
              fields: [
                { name: "coverImageAlt", type: "text", admin: { width: "50%", description: "Accessibility alt text for the cover image." } },
                { name: "coverImageCaption", type: "text", admin: { width: "50%" } },
              ],
            },
            {
              name: "attachments",
              type: "relationship",
              relationTo: "documents",
              hasMany: true,
              admin: { description: "Downloadable supporting files (PDFs from the Documents library)." },
            },
          ],
        },
        {
          label: "Classification",
          fields: [
            {
              type: "row",
              fields: [
                { name: "contentType", type: "relationship", relationTo: "blog-content-types", admin: { width: "50%" }, index: true },
                { name: "primaryCategory", type: "relationship", relationTo: "blog-categories", admin: { width: "50%" }, index: true },
              ],
            },
            {
              name: "secondaryCategories",
              type: "relationship",
              relationTo: "blog-categories",
              hasMany: true,
            },
            { name: "researchArea", type: "text", admin: { description: "e.g. 'PEM electrolysis', 'Copper metallurgy'." } },
            { name: "keywords", type: "text", admin: { description: "Comma-separated keywords (search + SEO + related articles)." } },
            {
              name: "tags",
              type: "array",
              labels: { singular: "Tag", plural: "Tags" },
              fields: [{ name: "tag", type: "text", required: true }],
            },
            // Legacy plain-text category (pre-taxonomy articles). Hidden but preserved:
            // the website falls back to it when primaryCategory is unset.
            { name: "category", type: "text", admin: { hidden: true } },
          ],
        },
        {
          label: "Authors & References",
          fields: [
            {
              name: "authors",
              type: "relationship",
              relationTo: "blog-authors",
              hasMany: true,
              admin: { description: "In display order. Manage people under Blog Authors." },
            },
            {
              name: "correspondingAuthor",
              type: "relationship",
              relationTo: "blog-authors",
              admin: { description: "Shown as the corresponding author (optional)." },
            },
            // Legacy free-text author (pre-taxonomy + converted submissions).
            { name: "author", type: "text", admin: { description: "Fallback author line when no linked authors are set (e.g. external contributor)." } },
            {
              type: "row",
              fields: [
                { name: "doi", type: "text", admin: { width: "33%", description: "e.g. 10.1000/xyz123" } },
                { name: "referenceNumber", type: "text", admin: { width: "33%", description: "Internal report / article number." } },
                { name: "externalPublicationUrl", type: "text", validate: validateHttpUrl, admin: { width: "34%" } },
              ],
            },
            {
              name: "references",
              type: "array",
              labels: { singular: "Reference", plural: "References" },
              admin: { description: "Cited works, shown in a numbered References section." },
              fields: [
                { name: "authors", type: "text", admin: { description: "e.g. 'A. Sharma, B. Gupta'" } },
                { name: "title", type: "text", required: true },
                { name: "source", type: "text", admin: { description: "Journal / conference / publisher." } },
                {
                  type: "row",
                  fields: [
                    { name: "year", type: "number", admin: { width: "25%" } },
                    { name: "volume", type: "text", admin: { width: "25%" } },
                    { name: "issue", type: "text", admin: { width: "25%" } },
                    { name: "pages", type: "text", admin: { width: "25%" } },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "doi", type: "text", admin: { width: "50%" } },
                    { name: "url", type: "text", validate: validateHttpUrl, admin: { width: "50%" } },
                  ],
                },
              ],
            },
            { name: "readingTime", type: "text", admin: { description: "Auto-calculated from the body when left blank (e.g. '5 min read')." } },
          ],
        },
        {
          label: "SEO & Sharing",
          fields: [
            { name: "seoTitle", type: "text", admin: { description: "Overrides the page <title> (defaults to the article title)." } },
            { name: "metaDescription", type: "textarea", admin: { description: "Defaults to the excerpt." } },
            { name: "canonicalUrl", type: "text", validate: validateHttpUrl, admin: { description: "Only when this article canonically lives elsewhere." } },
            { name: "ogImage", type: "upload", relationTo: "media", admin: { description: "Social sharing image (defaults to the cover image)." } },
            { name: "noIndex", type: "checkbox", defaultValue: false, admin: { description: "Ask search engines not to index this article." } },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;
        // Slug: auto-generate from title, always normalised to URL-safe form.
        if (data.slug || data.title) data.slug = slugify(data.slug || data.title || "");
        return data;
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (!data) return data;
        // Counters are maintained atomically by the reaction/view endpoints —
        // an admin save must never overwrite them with stale form values.
        // IMPORTANT: with drafts enabled, `originalDoc` comes from the latest
        // VERSION snapshot, which never sees the raw $inc writes — so read the
        // live values from the MAIN collection, else every publish would reset
        // the counters to their snapshot (creation-time) values.
        if (operation === "update" && originalDoc?.id) {
          let fresh: { viewCount?: number; likeCount?: number; dislikeCount?: number } | null = null;
          try {
            const model = (req.payload.db as unknown as {
              collections: Record<string, { findById: (id: string, projection: string) => { lean: () => Promise<typeof fresh> } }>;
            }).collections["posts"];
            fresh = await model.findById(String(originalDoc.id), "viewCount likeCount dislikeCount").lean();
          } catch (e) {
            req.payload.logger.warn(`[posts] counter guard fresh read failed: ${(e as Error).message}`);
          }
          data.viewCount = fresh?.viewCount ?? originalDoc.viewCount ?? 0;
          data.likeCount = fresh?.likeCount ?? originalDoc.likeCount ?? 0;
          data.dislikeCount = fresh?.dislikeCount ?? originalDoc.dislikeCount ?? 0;
        }
        // Publishing without a date = "now" (a future date stays = scheduled).
        if (data._status === "published" && !data.publishedDate) {
          data.publishedDate = new Date().toISOString();
        }
        // Reading time: compute from the body when the editor left it blank.
        if (!data.readingTime && data.body) {
          data.readingTime = readingTimeFromLexical(data.body);
        }
        return data;
      },
    ],
    afterChange: [
      auditAfterChange,
      revalidateWebsiteAfterChange,
      /**
       * Slug-change redirects: when a previously-published article's slug
       * changes, record the old slug so /blog/<old> 301s to the new URL.
       * Also removes any redirect that would now shadow the new slug.
       */
      async ({ req, doc, previousDoc }) => {
        const oldSlug = (previousDoc as { slug?: string } | undefined)?.slug;
        const newSlug = (doc as { slug?: string }).slug;
        if (!oldSlug || !newSlug || oldSlug === newSlug) return doc;
        const wasPublic = (previousDoc as { _status?: string } | undefined)?._status === "published";
        try {
          await req.payload.db.deleteMany?.({
            collection: "blog-slug-redirects",
            where: { oldSlug: { equals: newSlug } },
            req,
          });
          if (wasPublic) {
            const existing = await req.payload.find({
              collection: "blog-slug-redirects",
              where: { oldSlug: { equals: oldSlug } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (existing.docs.length) {
              await req.payload.update({
                collection: "blog-slug-redirects",
                id: existing.docs[0].id,
                data: { article: doc.id },
                overrideAccess: true,
              });
            } else {
              await req.payload.create({
                collection: "blog-slug-redirects",
                data: { oldSlug, article: doc.id },
                overrideAccess: true,
              });
            }
          }
        } catch (e) {
          req.payload.logger.error(`[posts] slug redirect upkeep failed: ${(e as Error).message}`);
        }
        return doc;
      },
    ],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
  endpoints: [
    /**
     * POST /api/posts/track-view  { id }  (website server only — x-internal-key)
     * Atomic $inc of the read counter — the website dedupes per visitor first.
     */
    {
      path: "/track-view",
      method: "post",
      handler: async (req) => {
        if (!inboundKeyMatches(req.headers.get("x-internal-key"), "CMS_BLOG_KEY")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        let body: { id?: string };
        try {
          body = ((await req.json?.()) ?? {}) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const id = String(body.id ?? "").trim();
        if (!/^[a-f0-9]{24}$/i.test(id)) {
          return Response.json({ error: "Invalid id" }, { status: 400 });
        }
        try {
          const article = (await req.payload.findByID({
            collection: "posts",
            id,
            depth: 0,
            overrideAccess: true,
          })) as { _status?: string; archived?: boolean; publishedDate?: string } | null;
          const scheduled =
            article?.publishedDate && new Date(article.publishedDate).getTime() > Date.now();
          if (!article || article._status !== "published" || article.archived === true || scheduled) {
            return Response.json({ error: "Article not found" }, { status: 404 });
          }
          const Posts = (req.payload.db as unknown as {
            collections: Record<
              string,
              { updateOne: (f: Record<string, unknown>, u: Record<string, unknown>, o?: Record<string, unknown>) => Promise<unknown> }
            >;
          }).collections["posts"];
          // timestamps:false — a view must not bump updatedAt (it feeds the
          // public "Updated" label, JSON-LD dateModified and sitemap lastmod).
          await Posts.updateOne({ _id: id }, { $inc: { viewCount: 1 } }, { timestamps: false });
          return Response.json({ ok: true });
        } catch (e) {
          req.payload.logger.error(`[posts/track-view] failed: ${(e as Error).message}`);
          return Response.json({ error: "Could not record view" }, { status: 500 });
        }
      },
    },
    /**
     * GET /api/posts/blog-stats — admin dashboard metrics (staff only).
     */
    {
      path: "/blog-stats",
      method: "get",
      handler: async (req) => {
        const user = req.user as { roles?: Role[] } | null;
        if (
          !hasRoleOrArea(user, ["super-admin", "admin", "marketing", "read-only-auditor"], ["content", "administration"])
        ) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { payload } = req;
        const count = (where: Where) =>
          payload.count({ collection: "posts", where, overrideAccess: true }).then((r) => r.totalDocs);
        try {
          const now = new Date().toISOString();
          const [published, scheduled, drafts, archived, inReview, pendingSubs, totals] = await Promise.all([
            count({ and: [{ _status: { equals: "published" } }, { archived: { not_equals: true } }, { publishedDate: { less_than_equal: now } }] }),
            count({ and: [{ _status: { equals: "published" } }, { publishedDate: { greater_than: now } }] }),
            count({ _status: { equals: "draft" } }),
            count({ archived: { equals: true } }),
            count({ workflowStatus: { equals: "in-review" } }),
            payload
              .count({
                collection: "blog-submissions",
                where: { status: { in: ["new", "under-review"] } },
                overrideAccess: true,
              })
              .then((r) => r.totalDocs),
            (async () => {
              // DB-side aggregation — no document cap.
              const model = (payload.db as unknown as {
                collections: Record<string, { aggregate: (p: unknown[]) => Promise<{ views?: number; likes?: number; dislikes?: number }[]> }>;
              }).collections["posts"];
              const [totals] = await model.aggregate([
                {
                  $group: {
                    _id: null,
                    views: { $sum: { $ifNull: ["$viewCount", 0] } },
                    likes: { $sum: { $ifNull: ["$likeCount", 0] } },
                    dislikes: { $sum: { $ifNull: ["$dislikeCount", 0] } },
                  },
                },
              ]);
              return { views: totals?.views ?? 0, likes: totals?.likes ?? 0, dislikes: totals?.dislikes ?? 0 };
            })(),
          ]);
          return Response.json({ ok: true, published, scheduled, drafts, archived, inReview, pendingSubmissions: pendingSubs, ...totals });
        } catch (e) {
          payload.logger.error(`[posts/blog-stats] failed: ${(e as Error).message}`);
          return Response.json({ error: "Stats unavailable" }, { status: 500 });
        }
      },
    },
  ],
};
