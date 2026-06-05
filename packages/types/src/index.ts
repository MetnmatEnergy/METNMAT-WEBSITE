/**
 * @metnmat/types — shared domain & API contract types.
 *
 * Single source of truth for types used across codebases (website, backend, and
 * later the dashboard + APIs). Prevents type drift — the reason the monorepo
 * exists. Keep this package runtime-free (types only).
 */

export interface Enquiry {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  source: "contact" | "quote";
  createdAt?: string;
}

export interface Product {
  id?: string;
  slug: string;
  name: string;
  category: string;
  blurb: string;
  price?: string;
}

export interface BlogPost {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
}

/** Standard API response envelope returned by all endpoints. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string; fields?: Record<string, string> };
