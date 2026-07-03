/**
 * /blog URL state — parsing + serialising the search/filter/sort/pagination
 * query string. Pure (no fetch/DOM) so the root test runner can cover it, and
 * shared by the server page (parse) and the client toolbar (serialise), which
 * is what makes every filter state a shareable, refresh-safe URL.
 */

export const BLOG_SORTS = ["recent", "oldest", "liked", "read", "updated", "picks"] as const;
export type BlogSort = (typeof BLOG_SORTS)[number];

export const BLOG_SORT_LABELS: Record<BlogSort, string> = {
  recent: "Most recent",
  oldest: "Oldest first",
  liked: "Most liked",
  read: "Most read",
  updated: "Recently updated",
  picks: "Editor's picks",
};

export type BlogQuery = {
  q: string;
  category: string; // category slug ("" = all)
  type: string; // content-type slug
  author: string; // author slug
  year: number | null;
  sort: BlogSort;
  page: number;
};

export const BLOG_PAGE_SIZE = 12;

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v ?? "").trim();

/** Safe parse of Next.js searchParams into a normalised BlogQuery. */
export function parseBlogQuery(params: RawParams): BlogQuery {
  const q = first(params.q).slice(0, 200);
  const category = first(params.category).toLowerCase().slice(0, 100);
  const type = first(params.type).toLowerCase().slice(0, 100);
  const author = first(params.author).toLowerCase().slice(0, 100);

  const yearNum = Number.parseInt(first(params.year), 10);
  const year = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100 ? yearNum : null;

  const sortRaw = first(params.sort) as BlogSort;
  const sort: BlogSort = BLOG_SORTS.includes(sortRaw) ? sortRaw : "recent";

  const pageNum = Number.parseInt(first(params.page), 10);
  const page = Number.isInteger(pageNum) && pageNum >= 1 && pageNum <= 10_000 ? pageNum : 1;

  return { q, category, type, author, year, sort, page };
}

/** True when any search/filter is active (featured rail hides, result count shows). */
export function hasActiveFilters(query: BlogQuery): boolean {
  return Boolean(
    query.q || query.category || query.type || query.author || query.year || query.sort !== "recent",
  );
}

/** Query string ("?q=…" or "") for a BlogQuery — omits defaults for clean URLs. */
export function blogQueryString(query: Partial<BlogQuery>): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.type) params.set("type", query.type);
  if (query.author) params.set("author", query.author);
  if (query.year) params.set("year", String(query.year));
  if (query.sort && query.sort !== "recent") params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
