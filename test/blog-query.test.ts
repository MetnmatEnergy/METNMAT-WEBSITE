import { describe, it, expect } from "vitest";
import {
  parseBlogQuery,
  blogQueryString,
  hasActiveFilters,
} from "../apps/website/src/frontend/lib/blog-query";

describe("parseBlogQuery", () => {
  it("returns safe defaults for an empty query", () => {
    expect(parseBlogQuery({})).toEqual({
      q: "",
      category: "",
      type: "",
      author: "",
      year: null,
      sort: "recent",
      page: 1,
    });
  });
  it("parses valid params", () => {
    const q = parseBlogQuery({
      q: " electrolyzer ",
      category: "Materials",
      type: "case-study",
      author: "a-sharma",
      year: "2026",
      sort: "liked",
      page: "3",
    });
    expect(q).toEqual({
      q: "electrolyzer",
      category: "materials",
      type: "case-study",
      author: "a-sharma",
      year: 2026,
      sort: "liked",
      page: 3,
    });
  });
  it("rejects invalid year / sort / page", () => {
    const q = parseBlogQuery({ year: "1834", sort: "hacked", page: "-2" });
    expect(q.year).toBeNull();
    expect(q.sort).toBe("recent");
    expect(q.page).toBe(1);
  });
  it("takes the first value of array params and caps length", () => {
    const q = parseBlogQuery({ q: ["a".repeat(500), "second"] });
    expect(q.q).toHaveLength(200);
  });
});

describe("blogQueryString", () => {
  it("omits defaults for clean URLs", () => {
    expect(blogQueryString({ q: "", sort: "recent", page: 1 })).toBe("");
  });
  it("serialises active state and round-trips through parse", () => {
    const qs = blogQueryString({ q: "PEM", category: "materials", year: 2025, sort: "read", page: 2 });
    const parsed = parseBlogQuery(Object.fromEntries(new URLSearchParams(qs.slice(1)).entries()));
    expect(parsed.q).toBe("PEM");
    expect(parsed.category).toBe("materials");
    expect(parsed.year).toBe(2025);
    expect(parsed.sort).toBe("read");
    expect(parsed.page).toBe(2);
  });
});

describe("hasActiveFilters", () => {
  it("is false for the default state", () => {
    expect(hasActiveFilters(parseBlogQuery({}))).toBe(false);
  });
  it("is true for any active filter", () => {
    expect(hasActiveFilters(parseBlogQuery({ q: "x" }))).toBe(true);
    expect(hasActiveFilters(parseBlogQuery({ year: "2026" }))).toBe(true);
    expect(hasActiveFilters(parseBlogQuery({ sort: "liked" }))).toBe(true);
    // Pagination alone is not a "filter" (featured rail only hides on filters).
    expect(hasActiveFilters(parseBlogQuery({ page: "3" }))).toBe(false);
  });
});
