import type { CollectionConfig, PayloadRequest } from "payload";
import { isAdmin } from "../access";
import { inboundKeyMatches } from "../lib/internal-key";

/**
 * Article Like/Dislike reactions — one row per (article, visitor).
 *
 * Privacy + integrity model:
 *  - NOT publicly readable (rows carry visitor identifiers); the website only
 *    ever sees aggregate counts, which live on the article itself
 *    (`likeCount` / `dislikeCount`, maintained atomically below).
 *  - All writes go through the /react endpoint (website server → x-internal-key);
 *    the browser can never write rows directly.
 *  - A compound UNIQUE index on (article, visitorId) makes duplicates impossible
 *    at the database level, and the endpoint uses a single atomic
 *    findOneAndUpdate upsert so concurrent clicks resolve to one row.
 */

type ReactionValue = "LIKE" | "DISLIKE";
type MongoSession = {
  withTransaction: (fn: () => Promise<void>) => Promise<unknown>;
  endSession: () => Promise<void>;
};
type MongooseishModel = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<{ reaction?: ReactionValue } | null> & { lean?: unknown };
  findOneAndDelete: (
    filter: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<{ reaction?: ReactionValue } | null>;
  updateOne: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  findOne: (filter: Record<string, unknown>, projection?: Record<string, unknown>) => {
    lean: () => Promise<{ likeCount?: number; dislikeCount?: number } | null>;
  };
};

const models = (req: PayloadRequest) =>
  (req.payload.db as unknown as { collections: Record<string, MongooseishModel> }).collections;

/** Mongo session for a row+counter transaction; null on standalone Mongo (dev). */
async function tryStartSession(req: PayloadRequest): Promise<MongoSession | null> {
  try {
    const conn = (req.payload.db as unknown as { connection: { startSession: () => Promise<MongoSession> } }).connection;
    return await conn.startSession();
  } catch {
    return null;
  }
}

/** Current aggregate counts straight from the articles collection. */
async function readCounts(req: PayloadRequest, articleId: string) {
  const post = await models(req)["posts"]
    .findOne({ _id: articleId }, { likeCount: 1, dislikeCount: 1 })
    .lean();
  return {
    likeCount: Math.max(0, post?.likeCount ?? 0),
    dislikeCount: Math.max(0, post?.dislikeCount ?? 0),
  };
}

export const BlogReactions: CollectionConfig = {
  slug: "blog-reactions",
  labels: { singular: "Blog Reaction", plural: "Blog Reactions" },
  admin: {
    group: "Blog",
    description: "Like/Dislike rows (system-managed — do not edit by hand).",
    defaultColumns: ["article", "reaction", "createdAt"],
    hidden: ({ user }) => !user, // keep the sidebar tidy for non-logged-in states
  },
  access: {
    read: isAdmin, // rows carry visitor identifiers — never public
    create: () => false, // only via the atomic /react endpoint below
    update: () => false,
    delete: isAdmin,
  },
  // DB-level guarantee: one reaction per (article, visitor).
  indexes: [{ fields: ["article", "visitorId"], unique: true }],
  fields: [
    { name: "article", type: "relationship", relationTo: "posts", required: true, index: true },
    {
      name: "visitorId",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Signed anonymous visitor id or customer:<id> — never a raw IP." },
    },
    {
      name: "reaction",
      type: "select",
      required: true,
      options: [
        { label: "Like", value: "LIKE" },
        { label: "Dislike", value: "DISLIKE" },
      ],
    },
  ],
  endpoints: [
    /**
     * POST /api/blog-reactions/react  (website server only — x-internal-key)
     * Body: { articleId, visitorId, reaction: "LIKE" | "DISLIKE" | "NONE" }
     * Atomically upserts/removes the row, adjusts the article's aggregate
     * counters with $inc, and returns the fresh counts.
     */
    {
      path: "/react",
      method: "post",
      handler: async (req) => {
        const { payload } = req;
        if (!inboundKeyMatches(req.headers.get("x-internal-key"), "CMS_BLOG_KEY")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        let body: { articleId?: string; visitorId?: string; reaction?: string };
        try {
          body = ((await req.json?.()) ?? {}) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const articleId = String(body.articleId ?? "").trim();
        const visitorId = String(body.visitorId ?? "").trim();
        const reaction = String(body.reaction ?? "").toUpperCase();
        if (
          !/^[a-f0-9]{24}$/i.test(articleId) ||
          !visitorId ||
          visitorId.length > 200 ||
          !["LIKE", "DISLIKE", "NONE"].includes(reaction)
        ) {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        // The article must be live and accepting reactions.
        type ArticleGate = { _status?: string; archived?: boolean; allowReactions?: boolean; publishedDate?: string };
        let article: ArticleGate | null = null;
        try {
          article = (await payload.findByID({
            collection: "posts",
            id: articleId,
            depth: 0,
            overrideAccess: true,
          })) as unknown as ArticleGate;
        } catch {
          /* not found */
        }
        const scheduled =
          article?.publishedDate && new Date(article.publishedDate).getTime() > Date.now();
        if (!article || article._status !== "published" || article.archived === true || scheduled) {
          return Response.json({ error: "Article not found" }, { status: 404 });
        }
        if (article.allowReactions === false) {
          return Response.json({ error: "Reactions are disabled for this article" }, { status: 403 });
        }

        const Reactions = models(req)["blog-reactions"];
        const Posts = models(req)["posts"];

        // Row change + counter $inc run in one transaction when the cluster
        // supports it (Atlas replica set — both prod and dev), so a failure
        // between the two can't leave the counters drifted. Falls back to
        // sequential writes on standalone Mongo.
        const session = await tryStartSession(req);
        const sessionOpt = session ? { session } : {};

        const applyReaction = async (): Promise<void> => {
          const inc: Record<string, number> = {};
          if (reaction === "NONE") {
            const prev = await Reactions.findOneAndDelete({ article: articleId, visitorId }, sessionOpt);
            if (prev?.reaction === "LIKE") inc.likeCount = -1;
            if (prev?.reaction === "DISLIKE") inc.dislikeCount = -1;
          } else {
            const doUpsert = () =>
              Reactions.findOneAndUpdate(
                { article: articleId, visitorId },
                { $set: { reaction }, $setOnInsert: { article: articleId, visitorId } },
                { upsert: true, new: false, ...sessionOpt }, // returns the PREVIOUS doc (null on insert)
              );
            let prev: { reaction?: ReactionValue } | null;
            try {
              prev = await doUpsert();
            } catch (e) {
              // Two first-clicks raced the upsert (duplicate key) — one inserted,
              // retry turns ours into a plain update. Anything else propagates.
              if ((e as { code?: number })?.code !== 11000) throw e;
              prev = await doUpsert();
            }
            if (!prev) {
              inc[reaction === "LIKE" ? "likeCount" : "dislikeCount"] = 1;
            } else if (prev.reaction !== reaction) {
              inc[reaction === "LIKE" ? "likeCount" : "dislikeCount"] = 1;
              inc[prev.reaction === "LIKE" ? "likeCount" : "dislikeCount"] = -1;
            }
          }
          if (Object.keys(inc).length) {
            // timestamps:false — reactions must not bump the article's
            // updatedAt (it feeds "Updated" labels + JSON-LD dateModified).
            await Posts.updateOne({ _id: articleId }, { $inc: inc }, { timestamps: false, ...sessionOpt });
          }
        };

        try {
          if (session) {
            try {
              await session.withTransaction(applyReaction);
            } finally {
              await session.endSession().catch(() => {});
            }
          } else {
            await applyReaction();
          }
          const counts = await readCounts(req, articleId);
          return Response.json({
            ok: true,
            reaction: reaction === "NONE" ? null : reaction,
            ...counts,
          });
        } catch (e) {
          payload.logger.error(`[blog-reactions/react] failed: ${(e as Error).message}`);
          return Response.json({ error: "Could not save reaction" }, { status: 500 });
        }
      },
    },
    /**
     * GET /api/blog-reactions/state?articleId=…&visitorId=…  (website server only)
     * Returns the visitor's current reaction + aggregate counts, for hydrating
     * the buttons on the article page.
     */
    {
      path: "/state",
      method: "get",
      handler: async (req) => {
        if (!inboundKeyMatches(req.headers.get("x-internal-key"), "CMS_BLOG_KEY")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const articleId = String(req.query?.articleId ?? "").trim();
        const visitorId = String(req.query?.visitorId ?? "").trim();
        if (!/^[a-f0-9]{24}$/i.test(articleId)) {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        try {
          const counts = await readCounts(req, articleId);
          let current: string | null = null;
          if (visitorId) {
            const row = await models(req)["blog-reactions"]
              .findOne({ article: articleId, visitorId }, { reaction: 1 })
              .lean();
            current = (row as { reaction?: string } | null)?.reaction ?? null;
          }
          return Response.json({ ok: true, reaction: current, ...counts });
        } catch (e) {
          req.payload.logger.error(`[blog-reactions/state] failed: ${(e as Error).message}`);
          return Response.json({ error: "Could not load reactions" }, { status: 500 });
        }
      },
    },
  ],
  timestamps: true,
};
