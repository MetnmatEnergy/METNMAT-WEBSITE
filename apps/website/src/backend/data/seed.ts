/**
 * Backend-owned seed data (placeholder).
 *
 * This exists so the API has something to return before MongoDB is wired.
 * It is intentionally backend-owned (the backend must NOT import frontend code).
 * TODO(backend): delete this and read from MongoDB (+ Meilisearch for search).
 */
import type { Product, BlogPost } from "@metnmat/types";

export const seedProducts: Product[] = [
  { slug: "placeholder-product-1", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-2", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-3", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
];

export const seedPosts: BlogPost[] = [
  { slug: "placeholder-post-1", title: "Blog Post Title One", excerpt: "Short excerpt.", category: "Category", date: "2026-01-01" },
  { slug: "placeholder-post-2", title: "Blog Post Title Two", excerpt: "Short excerpt.", category: "Category", date: "2026-01-01" },
];
