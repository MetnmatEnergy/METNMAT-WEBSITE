/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PLACEHOLDER CONTENT — REPLACE PER TAB                                     │
 * │                                                                           │
 * │  Nothing here is real company data. It exists only so the layout renders. │
 * │  As the company hands you real content, edit the arrays below (or later   │
 * │  swap this file for data fetched from Payload CMS / the Website API).      │
 * │  Search for "TODO(content)" to find every spot that needs real data.      │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

export type Stat = { value: string; label: string };
export type Client = { name: string };
export type Service = { slug: string; title: string; summary: string; icon?: string };
export type Project = {
  slug: string;
  title: string;
  category: string;
  summary: string;
};
export type Product = {
  slug: string;
  name: string;
  category: string;
  blurb: string;
  price?: string;
};
export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO
  readingTime: string;
};

/** Hero headline split so the last line can use the brand gradient. */
export const hero = {
  // TODO(content): final approved headline + subcopy.
  eyebrow: "India's first private Metallurgy & Materials R&D",
  titleLead: "Turning materials science into",
  titleAccent: "industrial advantage",
  subtitle:
    "Lab-scale prototype to full industrial scale — turnkey R&D that makes your process cheaper, cleaner and stronger.",
  primaryCta: { label: "Explore Solutions", href: "/services" },
  secondaryCta: { label: "Shop Now", href: "/shop" },
};

// TODO(content): real metrics.
export const stats: Stat[] = [
  { value: "100+", label: "R&D projects delivered" },
  { value: "12+", label: "Years of expertise" },
  { value: "93%", label: "IACS conductivity achieved" },
];

// TODO(content): confirmed client list + logos.
export const clients: Client[] = [
  { name: "Tata Steel" },
  { name: "Vedanta" },
  { name: "JSL" },
  { name: "Eastern Copper" },
  { name: "Mescab Wires & Cables" },
];

// TODO(content): real services with descriptions + icons.
export const services: Service[] = [
  { slug: "placeholder-service-1", title: "Service One", summary: "Short description of this service offering goes here." },
  { slug: "placeholder-service-2", title: "Service Two", summary: "Short description of this service offering goes here." },
  { slug: "placeholder-service-3", title: "Service Three", summary: "Short description of this service offering goes here." },
  { slug: "placeholder-service-4", title: "Service Four", summary: "Short description of this service offering goes here." },
  { slug: "placeholder-service-5", title: "Service Five", summary: "Short description of this service offering goes here." },
  { slug: "placeholder-service-6", title: "Service Six", summary: "Short description of this service offering goes here." },
];

// TODO(content): real case studies / projects.
export const projects: Project[] = [
  { slug: "placeholder-project-1", title: "Project Title One", category: "Category", summary: "One-line summary of the case study and the outcome delivered." },
  { slug: "placeholder-project-2", title: "Project Title Two", category: "Category", summary: "One-line summary of the case study and the outcome delivered." },
  { slug: "placeholder-project-3", title: "Project Title Three", category: "Category", summary: "One-line summary of the case study and the outcome delivered." },
  { slug: "placeholder-project-4", title: "Project Title Four", category: "Category", summary: "One-line summary of the case study and the outcome delivered." },
  { slug: "placeholder-project-5", title: "Project Title Five", category: "Category", summary: "One-line summary of the case study and the outcome delivered." },
  { slug: "placeholder-project-6", title: "Project Title Six", category: "Category", summary: "One-line summary of the case study and the outcome delivered." },
];

// TODO(content): real products from the catalog (or fetch from API/Meilisearch).
export const products: Product[] = [
  { slug: "placeholder-product-1", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-2", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-3", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-4", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-5", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-6", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
];

export const productCategories: string[] = [
  // TODO(content): real shop categories.
  "All",
  "Furnaces",
  "Crucibles",
  "Analysis",
  "Consumables",
];

// TODO(content): real blog posts (or fetch from Payload CMS).
export const blogPosts: BlogPost[] = [
  { slug: "placeholder-post-1", title: "Blog Post Title One", excerpt: "A short two-line excerpt that previews what the article is about.", category: "Category", date: "2026-01-01", readingTime: "4 min read" },
  { slug: "placeholder-post-2", title: "Blog Post Title Two", excerpt: "A short two-line excerpt that previews what the article is about.", category: "Category", date: "2026-01-01", readingTime: "5 min read" },
  { slug: "placeholder-post-3", title: "Blog Post Title Three", excerpt: "A short two-line excerpt that previews what the article is about.", category: "Category", date: "2026-01-01", readingTime: "3 min read" },
];
