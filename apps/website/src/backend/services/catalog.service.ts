/**
 * Catalog service — reads products / blog posts.
 *
 * Reads backend-owned seed data for now (the backend must not depend on the
 * frontend). TODO(backend): read from MongoDB (+ Meilisearch for search/facets).
 */
import type { Product, BlogPost } from "@/backend/models";
import { seedProducts, seedPosts } from "@/backend/data/seed";

export async function listProducts(): Promise<Product[]> {
  return seedProducts.map((p) => ({ ...p }));
}

export async function getProduct(slug: string): Promise<Product | null> {
  return seedProducts.find((p) => p.slug === slug) ?? null;
}

export async function listPosts(): Promise<BlogPost[]> {
  return seedPosts.map((p) => ({ ...p }));
}
