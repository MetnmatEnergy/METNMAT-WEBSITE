/**
 * Server-to-server blog operations against the CMS (never callable from the
 * browser directly — the public API routes validate/rate-limit first, then call
 * these with the purpose-scoped internal key `CMS_BLOG_KEY`, falling back to
 * the shared INTERNAL_API_KEY like every other service in this app).
 */
import { outboundKey } from "@/backend/lib/internal-key";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const KEY = () => outboundKey("CMS_BLOG_KEY");

type ReactionResult = {
  ok: boolean;
  reaction: "LIKE" | "DISLIKE" | null;
  likeCount: number;
  dislikeCount: number;
  error?: string;
};

export async function reactToArticle(
  articleId: string,
  visitorId: string,
  reaction: "LIKE" | "DISLIKE" | "NONE",
): Promise<ReactionResult | null> {
  try {
    const res = await fetch(`${CMS}/api/blog-reactions/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": KEY() },
      body: JSON.stringify({ articleId, visitorId, reaction }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ReactionResult;
  } catch {
    return null;
  }
}

export async function getReactionState(
  articleId: string,
  visitorId: string | null,
): Promise<ReactionResult | null> {
  try {
    const params = new URLSearchParams({ articleId });
    if (visitorId) params.set("visitorId", visitorId);
    const res = await fetch(`${CMS}/api/blog-reactions/state?${params}`, {
      headers: { "x-internal-key": KEY() },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ReactionResult;
  } catch {
    return null;
  }
}

export async function trackArticleView(articleId: string): Promise<boolean> {
  try {
    const res = await fetch(`${CMS}/api/posts/track-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": KEY() },
      body: JSON.stringify({ id: articleId }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Draft preview (signed link from the CMS admin) ────────────────────────────

/** Fetch an article INCLUDING drafts — only used by the token-verified preview route. */
export async function getDraftArticleRaw(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const params = new URLSearchParams({
      draft: "true",
      depth: "2",
      limit: "1",
      "where[slug][equals]": slug,
    });
    const res = await fetch(`${CMS}/api/posts?${params}`, {
      headers: { "x-internal-key": KEY() },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { docs?: Record<string, unknown>[] };
    return data.docs?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Publication requests ──────────────────────────────────────────────────────

export type SubmissionFileUpload = { buffer: Buffer; filename: string; mimeType: string };

/** Upload one validated file into the PRIVATE blog-submission-files collection. */
export async function uploadSubmissionFile(file: SubmissionFileUpload): Promise<string | null> {
  try {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
      file.filename,
    );
    const res = await fetch(`${CMS}/api/blog-submission-files`, {
      method: "POST",
      headers: { "x-internal-key": KEY() },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { doc?: { id?: string } };
    return data.doc?.id ? String(data.doc.id) : null;
  } catch {
    return null;
  }
}

/** Create the submission record. Returns its id, or null on failure. */
export async function createBlogSubmission(data: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`${CMS}/api/blog-submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": KEY() },
      body: JSON.stringify(data),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { doc?: { id?: string } };
    return json.doc?.id ? String(json.doc.id) : null;
  } catch {
    return null;
  }
}

/** Duplicate guard: same contributor email + same title in the last 24 h. */
export async function findRecentDuplicateSubmission(
  email: string,
  title: string,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      limit: "1",
      depth: "0",
      "where[and][0][email][equals]": email,
      "where[and][1][proposedTitle][equals]": title,
      "where[and][2][createdAt][greater_than]": since,
    });
    const res = await fetch(`${CMS}/api/blog-submissions?${params}`, {
      headers: { "x-internal-key": KEY() },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { totalDocs?: number };
    return (data.totalDocs ?? 0) > 0;
  } catch {
    return false;
  }
}
