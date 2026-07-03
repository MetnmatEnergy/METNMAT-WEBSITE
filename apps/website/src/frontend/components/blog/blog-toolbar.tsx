"use client";

/**
 * Search + filters + sort for /blog. All state lives in the URL (shareable,
 * refresh-safe, back-button-friendly): typing is debounced into ?q=, selects
 * push immediately, and any change resets pagination. Desktop shows a filter
 * bar; mobile collapses the selects behind a "Filters" disclosure.
 */
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  BLOG_SORT_LABELS,
  BLOG_SORTS,
  blogQueryString,
  hasActiveFilters,
  parseBlogQuery,
  type BlogQuery,
} from "@/frontend/lib/blog-query";

export type FilterOption = { slug: string; name: string };

type Props = {
  categories: FilterOption[];
  contentTypes: FilterOption[];
  authors: FilterOption[];
  years: number[];
};

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto";

export function BlogToolbar({ categories, contentTypes, authors, years }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = React.useMemo(
    () => parseBlogQuery(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );

  const [text, setText] = React.useState(query.q);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  React.useEffect(() => setText(query.q), [query.q]);

  const push = React.useCallback(
    (next: Partial<BlogQuery>) => {
      const merged: Partial<BlogQuery> = { ...query, page: 1, ...next };
      router.push(`/blog${blogQueryString(merged)}`, { scroll: false });
    },
    [router, query],
  );

  // Debounced search-as-you-type (450 ms) — Enter submits immediately.
  React.useEffect(() => {
    if (text === query.q) return;
    const t = setTimeout(() => push({ q: text }), 450);
    return () => clearTimeout(t);
  }, [text, query.q, push]);

  const active = hasActiveFilters(query);

  const select = (
    id: string,
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (v: string) => void,
  ) => (
    <label className="flex w-full flex-col gap-1 sm:w-auto">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select id={id} className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: text });
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="blog-search" className="sr-only">
            Search articles by title, author, topic, keyword or DOI
          </label>
          <input
            id="blog-search"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search articles, authors, topics, keywords, DOI…"
            className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {text && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setText("");
                push({ q: "" });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted sm:hidden"
          aria-expanded={filtersOpen}
          aria-controls="blog-filters"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </form>

      <div
        id="blog-filters"
        className={`mt-4 grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end ${filtersOpen ? "grid" : "hidden sm:flex"}`}
      >
        {select("f-category", "Category", query.category, categories.map((c) => ({ value: c.slug, label: c.name })), (v) => push({ category: v }))}
        {select("f-type", "Content type", query.type, contentTypes.map((c) => ({ value: c.slug, label: c.name })), (v) => push({ type: v }))}
        {authors.length > 0 &&
          select("f-author", "Author", query.author, authors.map((a) => ({ value: a.slug, label: a.name })), (v) => push({ author: v }))}
        {years.length > 0 &&
          select("f-year", "Year", query.year ? String(query.year) : "", years.map((y) => ({ value: String(y), label: String(y) })), (v) =>
            push({ year: v ? Number(v) : null }),
          )}
        <label className="flex w-full flex-col gap-1 sm:ml-auto sm:w-auto">
          <span className="text-xs font-medium text-muted-foreground">Sort by</span>
          <select
            id="f-sort"
            className={SELECT_CLASS}
            value={query.sort}
            onChange={(e) => push({ sort: e.target.value as BlogQuery["sort"] })}
          >
            {BLOG_SORTS.map((s) => (
              <option key={s} value={s}>
                {BLOG_SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {active && (
          <button
            type="button"
            onClick={() => router.push("/blog", { scroll: false })}
            className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-brand-soft hover:text-brand"
          >
            <X className="h-4 w-4" /> Clear all
          </button>
        )}
      </div>
    </div>
  );
}
