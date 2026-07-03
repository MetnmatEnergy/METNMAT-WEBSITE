/**
 * Blog data layer — reads the Research & Engineering Insights content from the
 * Payload CMS public REST API (anonymous: the CMS access rules only ever expose
 * published, non-archived, past-publish-time articles). Same caching model as
 * cms.ts: ISR 60 s + the "cms" tag (instant purge on dashboard saves) + React
 * cache() per-request dedupe.
 *
 * Server-side search/filter/sort/pagination: every listing query is executed
 * by the database via Payload `where` params — the browser never downloads the
 * whole article set.
 */
import { cache } from "react";
import { mediaUrl } from "@/frontend/lib/cms";
import { BLOG_PAGE_SIZE, type BlogQuery } from "@/frontend/lib/blog-query";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";

const fetchJson = cache(async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${CMS}${path}`, { next: { revalidate: 60, tags: ["cms"] } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
});

// ── Where-clause encoding (Payload REST bracket syntax) ───────────────────────

type Where = Record<string, unknown>;

function encodeParam(out: URLSearchParams, prefix: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => encodeParam(out, `${prefix}[${i}]`, v));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      encodeParam(out, `${prefix}[${k}]`, v);
    }
  } else {
    out.set(prefix, String(value));
  }
}

function buildQueryString(opts: {
  where?: Where;
  sort?: string;
  limit?: number;
  page?: number;
  depth?: number;
}): string {
  const params = new URLSearchParams();
  if (opts.depth !== undefined) params.set("depth", String(opts.depth));
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.page !== undefined && opts.page > 1) params.set("page", String(opts.page));
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.where) encodeParam(params, "where", opts.where);
  return params.toString();
}

/** Explicit public-visibility clauses (the CMS access rules enforce the same — defense in depth).
 * The "now" bound is floored to the minute — a millisecond timestamp would make
 * every fetch URL unique and defeat the Next data cache entirely (scheduled
 * articles still appear within ~1 min, same as the ISR window). */
const publiclyVisible = (): Where[] => [
  { _status: { equals: "published" } },
  { archived: { not_equals: true } },
  {
    or: [
      { publishedDate: { exists: false } },
      { publishedDate: { less_than_equal: new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString() } },
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type BlogTaxonomy = { id: string; slug: string; name: string; description?: string };

export type BlogAuthorProfile = {
  id: string;
  slug: string;
  name: string;
  designation?: string;
  organisation?: string;
  department?: string;
  bio?: string;
  photoUrl?: string;
  email?: string;
  orcidUrl?: string;
  googleScholarUrl?: string;
  researchGateUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  isMetnmatAuthor: boolean;
};

export type BlogReferenceEntry = {
  authors?: string;
  title: string;
  source?: string;
  year?: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
};

export type BlogArticleCard = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  categoryName: string;
  categorySlug?: string;
  contentTypeName?: string;
  contentTypeSlug?: string;
  authorLine: string;
  affiliationLine?: string;
  date: string;
  updatedAt?: string;
  readingTime: string;
  viewCount: number;
  likeCount: number;
  coverUrl?: string;
  coverAlt?: string;
  isFeatured: boolean;
  isEditorsPick: boolean;
  tags: string[];
};

export type BlogArticleFull = BlogArticleCard & {
  abstract?: string;
  body?: unknown;
  authors: BlogAuthorProfile[];
  correspondingAuthorId?: string;
  legacyAuthor?: string;
  doi?: string;
  referenceNumber?: string;
  externalPublicationUrl?: string;
  references: BlogReferenceEntry[];
  attachments: { name: string; url: string }[];
  keywords?: string;
  researchArea?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  noIndex: boolean;
  allowReactions: boolean;
  dislikeCount: number;
  coverCaption?: string;
};

// Raw CMS shapes (only what we read — everything defensive).
type Rel = { id?: string; slug?: string; name?: string } | string | null | undefined;
type CmsMedia = { url?: string; alt?: string } | string | null | undefined;
type CmsAuthor = {
  id?: string;
  slug?: string;
  name?: string;
  designation?: string;
  organisation?: string;
  department?: string;
  bio?: string;
  profileImage?: CmsMedia;
  email?: string;
  showEmail?: boolean;
  orcidUrl?: string;
  googleScholarUrl?: string;
  researchGateUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  isMetnmatAuthor?: boolean;
};
type CmsArticle = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  abstract?: string;
  body?: unknown;
  category?: string; // legacy text
  primaryCategory?: Rel;
  contentType?: Rel;
  authors?: (CmsAuthor | string)[];
  correspondingAuthor?: Rel;
  author?: string; // legacy text
  publishedDate?: string;
  updatedAt?: string;
  readingTime?: string;
  viewCount?: number;
  likeCount?: number;
  dislikeCount?: number;
  coverImage?: CmsMedia;
  coverImageAlt?: string;
  coverImageCaption?: string;
  isFeatured?: boolean;
  isEditorsPick?: boolean;
  allowReactions?: boolean;
  noIndex?: boolean;
  tags?: { tag?: string }[];
  keywords?: string;
  researchArea?: string;
  doi?: string;
  referenceNumber?: string;
  externalPublicationUrl?: string;
  references?: BlogReferenceEntry[];
  attachments?: ({ filename?: string; url?: string } | string)[];
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogImage?: CmsMedia;
};
type ListResponse<T> = { docs: T[]; totalDocs: number; totalPages: number; page: number };

// ── Mapping ───────────────────────────────────────────────────────────────────

const relName = (r: Rel): string | undefined =>
  r && typeof r === "object" ? r.name : undefined;
const relSlug = (r: Rel): string | undefined =>
  r && typeof r === "object" ? r.slug : undefined;
const relId = (r: Rel): string | undefined =>
  r && typeof r === "object" ? r.id : typeof r === "string" ? r : undefined;

function mapAuthor(a: CmsAuthor): BlogAuthorProfile {
  return {
    id: String(a.id ?? ""),
    slug: a.slug ?? "",
    name: a.name ?? "",
    designation: a.designation || undefined,
    organisation: a.organisation || undefined,
    department: a.department || undefined,
    bio: a.bio || undefined,
    photoUrl: mediaUrl(a.profileImage),
    email: a.showEmail && a.email ? a.email : undefined,
    orcidUrl: a.orcidUrl || undefined,
    googleScholarUrl: a.googleScholarUrl || undefined,
    researchGateUrl: a.researchGateUrl || undefined,
    linkedinUrl: a.linkedinUrl || undefined,
    websiteUrl: a.websiteUrl || undefined,
    isMetnmatAuthor: a.isMetnmatAuthor !== false,
  };
}

function authorNames(d: CmsArticle): string[] {
  const linked = (d.authors ?? [])
    .filter((a): a is CmsAuthor => typeof a === "object" && a !== null)
    .map((a) => a.name ?? "")
    .filter(Boolean);
  if (linked.length) return linked;
  return d.author ? [d.author] : [];
}

/** "A. Sharma", "A. Sharma & B. Gupta", "A. Sharma, B. Gupta & C. Rao". */
export function formatAuthorLine(names: string[]): string {
  if (!names.length) return "METNMAT Editorial Team";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function mapCard(d: CmsArticle): BlogArticleCard {
  const names = authorNames(d);
  const firstAuthor = (d.authors ?? []).find(
    (a): a is CmsAuthor => typeof a === "object" && a !== null,
  );
  return {
    id: String(d.id),
    slug: d.slug,
    title: d.title,
    subtitle: d.subtitle || undefined,
    excerpt: d.excerpt ?? "",
    categoryName: relName(d.primaryCategory) ?? d.category ?? "Insights",
    categorySlug: relSlug(d.primaryCategory),
    contentTypeName: relName(d.contentType),
    contentTypeSlug: relSlug(d.contentType),
    authorLine: formatAuthorLine(names),
    affiliationLine: firstAuthor?.organisation || undefined,
    date: d.publishedDate ?? "",
    updatedAt: d.updatedAt,
    readingTime: d.readingTime ?? "",
    viewCount: Math.max(0, d.viewCount ?? 0),
    likeCount: Math.max(0, d.likeCount ?? 0),
    coverUrl: mediaUrl(d.coverImage),
    coverAlt: d.coverImageAlt || d.title,
    isFeatured: d.isFeatured === true,
    isEditorsPick: d.isEditorsPick === true,
    tags: (d.tags ?? []).map((t) => t.tag ?? "").filter(Boolean),
  };
}

function mapFull(d: CmsArticle): BlogArticleFull {
  return {
    ...mapCard(d),
    abstract: d.abstract || undefined,
    body: d.body,
    authors: (d.authors ?? [])
      .filter((a): a is CmsAuthor => typeof a === "object" && a !== null)
      .map(mapAuthor),
    correspondingAuthorId: relId(d.correspondingAuthor),
    legacyAuthor: d.author || undefined,
    doi: d.doi || undefined,
    referenceNumber: d.referenceNumber || undefined,
    externalPublicationUrl: d.externalPublicationUrl || undefined,
    references: (d.references ?? []).filter((r) => r && r.title),
    attachments: (d.attachments ?? [])
      .filter((a): a is { filename?: string; url?: string } => typeof a === "object" && a !== null)
      .map((a) => ({ name: a.filename ?? "Attachment", url: mediaUrl(a as CmsMedia) ?? "" }))
      .filter((a) => a.url),
    keywords: d.keywords || undefined,
    researchArea: d.researchArea || undefined,
    seoTitle: d.seoTitle || undefined,
    metaDescription: d.metaDescription || undefined,
    canonicalUrl: d.canonicalUrl || undefined,
    ogImageUrl: mediaUrl(d.ogImage) ?? mediaUrl(d.coverImage),
    noIndex: d.noIndex === true,
    allowReactions: d.allowReactions !== false,
    dislikeCount: Math.max(0, d.dislikeCount ?? 0),
    coverCaption: d.coverImageCaption || undefined,
  };
}

// ── Taxonomies ────────────────────────────────────────────────────────────────

type CmsTaxonomy = { id: string; slug?: string; name?: string; description?: string; isActive?: boolean };

const mapTaxonomy = (d: CmsTaxonomy): BlogTaxonomy => ({
  id: String(d.id),
  slug: d.slug ?? "",
  name: d.name ?? "",
  description: d.description,
});

export async function getBlogCategories(): Promise<BlogTaxonomy[]> {
  const data = await fetchJson<ListResponse<CmsTaxonomy>>(
    "/api/blog-categories?depth=0&limit=100&sort=displayOrder&where[isActive][not_equals]=false",
  );
  return (data?.docs ?? []).map(mapTaxonomy).filter((t) => t.slug && t.name);
}

export async function getBlogContentTypes(): Promise<BlogTaxonomy[]> {
  const data = await fetchJson<ListResponse<CmsTaxonomy>>(
    "/api/blog-content-types?depth=0&limit=100&sort=displayOrder&where[isActive][not_equals]=false",
  );
  return (data?.docs ?? []).map(mapTaxonomy).filter((t) => t.slug && t.name);
}

export async function getBlogAuthorOptions(): Promise<BlogTaxonomy[]> {
  const data = await fetchJson<ListResponse<CmsTaxonomy>>(
    "/api/blog-authors?depth=0&limit=200&sort=name&where[isActive][not_equals]=false",
  );
  return (data?.docs ?? []).map(mapTaxonomy).filter((t) => t.slug && t.name);
}

/** Distinct publication years (newest first) from the first/last published articles. */
export async function getBlogYears(): Promise<number[]> {
  const qs = (sort: string) =>
    `/api/posts?${buildQueryString({
      where: { and: [...publiclyVisible(), { publishedDate: { exists: true } }] },
      sort,
      limit: 1,
      depth: 0,
    })}`;
  const [newest, oldest] = await Promise.all([
    fetchJson<ListResponse<CmsArticle>>(qs("-publishedDate")),
    fetchJson<ListResponse<CmsArticle>>(qs("publishedDate")),
  ]);
  const hi = new Date(newest?.docs?.[0]?.publishedDate ?? "").getFullYear();
  const lo = new Date(oldest?.docs?.[0]?.publishedDate ?? "").getFullYear();
  if (!Number.isInteger(hi) || !Number.isInteger(lo) || hi < lo) return [];
  const years: number[] = [];
  for (let y = hi; y >= lo && years.length < 25; y--) years.push(y);
  return years;
}

// ── Listing ───────────────────────────────────────────────────────────────────

const SORT_MAP: Record<BlogQuery["sort"], string> = {
  recent: "-isPinned,-publishedDate",
  oldest: "publishedDate",
  liked: "-likeCount,-publishedDate",
  read: "-viewCount,-publishedDate",
  updated: "-updatedAt",
  picks: "-publishedDate",
};

export type BlogListing = {
  articles: BlogArticleCard[];
  totalDocs: number;
  totalPages: number;
  page: number;
};

export async function listBlogArticles(query: BlogQuery): Promise<BlogListing> {
  const and: Where[] = [...publiclyVisible()];

  // Slug-based filters resolve through the (request-cached) taxonomy lists.
  if (query.category) {
    const cat = (await getBlogCategories()).find((c) => c.slug === query.category);
    if (!cat) return { articles: [], totalDocs: 0, totalPages: 0, page: 1 };
    and.push({ or: [{ primaryCategory: { equals: cat.id } }, { secondaryCategories: { in: cat.id } }] });
  }
  if (query.type) {
    const t = (await getBlogContentTypes()).find((c) => c.slug === query.type);
    if (!t) return { articles: [], totalDocs: 0, totalPages: 0, page: 1 };
    and.push({ contentType: { equals: t.id } });
  }
  if (query.author) {
    const a = (await getBlogAuthorOptions()).find((c) => c.slug === query.author);
    if (!a) return { articles: [], totalDocs: 0, totalPages: 0, page: 1 };
    and.push({ or: [{ authors: { in: a.id } }, { correspondingAuthor: { equals: a.id } }] });
  }
  if (query.year) {
    and.push({ publishedDate: { greater_than_equal: `${query.year}-01-01T00:00:00.000Z` } });
    and.push({ publishedDate: { less_than: `${query.year + 1}-01-01T00:00:00.000Z` } });
  }
  if (query.sort === "picks") {
    and.push({ isEditorsPick: { equals: true } });
  }
  if (query.q) {
    const like = { like: query.q };
    const or: Where[] = [
      { title: like },
      { subtitle: like },
      { excerpt: like },
      { abstract: like },
      { keywords: like },
      { researchArea: like },
      { author: like },
      { doi: like },
      { referenceNumber: like },
      { "tags.tag": like },
    ];
    // Also match articles whose linked author names/organisations match.
    const authors = await getBlogAuthorOptions();
    const q = query.q.toLowerCase();
    const matched = authors.filter((a) => a.name.toLowerCase().includes(q)).map((a) => a.id);
    if (matched.length) or.push({ authors: { in: matched.join(",") } });
    and.push({ or });
  }

  const qs = buildQueryString({
    where: { and },
    sort: SORT_MAP[query.sort],
    limit: BLOG_PAGE_SIZE,
    page: query.page,
    depth: 1,
  });
  const data = await fetchJson<ListResponse<CmsArticle>>(`/api/posts?${qs}`);
  if (!data) return { articles: [], totalDocs: 0, totalPages: 0, page: 1 };
  return {
    articles: (data.docs ?? []).map(mapCard),
    totalDocs: data.totalDocs ?? 0,
    totalPages: data.totalPages ?? 0,
    page: data.page ?? 1,
  };
}

/** Up to 4 featured / editor's-pick articles for the top rail (page 1, no filters). */
export async function getFeaturedBlogArticles(): Promise<BlogArticleCard[]> {
  const qs = buildQueryString({
    where: {
      and: [...publiclyVisible(), { or: [{ isFeatured: { equals: true } }, { isEditorsPick: { equals: true } }] }],
    },
    sort: "-isPinned,-publishedDate",
    limit: 4,
    depth: 1,
  });
  const data = await fetchJson<ListResponse<CmsArticle>>(`/api/posts?${qs}`);
  return (data?.docs ?? []).map(mapCard);
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getBlogArticle(slug: string): Promise<BlogArticleFull | null> {
  const qs = buildQueryString({
    where: { and: [{ slug: { equals: slug } }, ...publiclyVisible()] },
    limit: 1,
    depth: 2, // authors → profile images, attachments → files
  });
  const data = await fetchJson<ListResponse<CmsArticle>>(`/api/posts?${qs}`);
  const doc = data?.docs?.[0];
  return doc ? mapFull(doc) : null;
}

/** Current slug for an old (renamed) slug via the redirect table, or null. */
export async function resolveBlogSlugRedirect(oldSlug: string): Promise<string | null> {
  const qs = buildQueryString({ where: { oldSlug: { equals: oldSlug } }, limit: 1, depth: 1 });
  const data = await fetchJson<ListResponse<{ article?: { slug?: string } | string }>>(
    `/api/blog-slug-redirects?${qs}`,
  );
  const article = data?.docs?.[0]?.article;
  return article && typeof article === "object" ? article.slug ?? null : null;
}

/** Related articles: shared category / tags / authors, excluding the article itself. */
export async function getRelatedBlogArticles(article: BlogArticleFull, limit = 3): Promise<BlogArticleCard[]> {
  const or: Where[] = [];
  const catId = article.categorySlug
    ? (await getBlogCategories()).find((c) => c.slug === article.categorySlug)?.id
    : undefined;
  if (catId) or.push({ primaryCategory: { equals: catId } });
  if (article.tags.length) or.push({ "tags.tag": { in: article.tags.slice(0, 6).join(",") } });
  const authorIds = article.authors.map((a) => a.id).filter(Boolean);
  if (authorIds.length) or.push({ authors: { in: authorIds.join(",") } });
  if (!or.length) or.push({ id: { exists: true } }); // fall back to latest articles

  const qs = buildQueryString({
    where: { and: [...publiclyVisible(), { id: { not_equals: article.id } }, { or }] },
    sort: "-publishedDate",
    limit,
    depth: 1,
  });
  const data = await fetchJson<ListResponse<CmsArticle>>(`/api/posts?${qs}`);
  return (data?.docs ?? []).map(mapCard).filter((a) => a.slug !== article.slug).slice(0, limit);
}

/** Map a raw CMS article doc (e.g. a draft fetched by the preview route) to the full shape. */
export function mapCmsArticleFull(doc: unknown): BlogArticleFull {
  return mapFull(doc as CmsArticle);
}

// ── Feeds (sitemap / RSS) ─────────────────────────────────────────────────────

export async function listBlogArticlesForFeed(limit = 100): Promise<BlogArticleCard[]> {
  const qs = buildQueryString({
    where: { and: [...publiclyVisible(), { noIndex: { not_equals: true } }] },
    sort: "-publishedDate",
    limit,
    depth: 1,
  });
  const data = await fetchJson<ListResponse<CmsArticle>>(`/api/posts?${qs}`);
  return (data?.docs ?? []).map(mapCard);
}
