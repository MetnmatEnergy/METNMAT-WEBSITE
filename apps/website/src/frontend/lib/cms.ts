/**
 * CMS data layer — the website reads ALL catalog + settings from the Payload
 * dashboard (apps/dashboard) via its public REST API. Nothing is hardcoded.
 *
 * `no-store` keeps every page fresh, so a change in the dashboard reflects on
 * the next request (no redeploy). Optimize to ISR + on-demand revalidation later.
 */
import type { Product, Category } from "@/frontend/lib/catalog";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";

async function api<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${CMS}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // CMS unreachable — pages still render (empty states)
  }
}

type Media = { url?: string; alt?: string } | string | null | undefined;

/** Absolute URL for a Payload media object (handles local + cloud storage). */
export function mediaUrl(media: Media): string | undefined {
  if (!media || typeof media === "string") return undefined;
  const u = media.url;
  if (!u) return undefined;
  return u.startsWith("http") ? u : `${CMS}${u}`;
}

type CmsCategory = {
  slug: string;
  name: string;
  blurb?: string;
  order?: number;
  parent?: { slug?: string } | string | null;
  image?: Media;
};

type CmsProduct = {
  slug: string;
  name: string;
  brand?: string;
  sku?: string;
  category?: { slug?: string } | string | null;
  price?: number;
  mrp?: number;
  unit?: string;
  moq?: number;
  leadTime?: string;
  rating?: number;
  inStock?: boolean;
  featured?: boolean;
  badges?: string[];
  priceTiers?: { minQty: number; price: number }[];
  specs?: { label: string; value: string }[];
  shortDesc?: string;
  images?: { image?: Media }[];
};

function mapProduct(d: CmsProduct): Product {
  const imgs = (d.images ?? []).map((i) => mediaUrl(i.image)).filter(Boolean) as string[];
  return {
    slug: d.slug,
    name: d.name,
    brand: d.brand ?? "",
    categorySlug: typeof d.category === "object" && d.category ? d.category.slug ?? "" : "",
    sku: d.sku ?? "",
    price: d.price ?? 0,
    mrp: d.mrp,
    rating: d.rating ?? 0,
    reviewCount: 0,
    inStock: d.inStock ?? true,
    moq: d.moq ?? 1,
    unit: d.unit ?? "unit",
    leadTime: d.leadTime ?? "Ships in 1–2 weeks",
    priceTiers: d.priceTiers ?? [],
    shortDesc: d.shortDesc ?? "",
    specs: d.specs ?? [],
    datasheets: [],
    badges: d.badges ?? [],
    imageUrl: imgs[0],
    images: imgs,
  };
}

function mapCategory(d: CmsCategory): Category {
  return {
    slug: d.slug,
    name: d.name,
    blurb: d.blurb,
    parent: typeof d.parent === "object" && d.parent ? d.parent.slug : undefined,
    imageUrl: mediaUrl(d.image),
  };
}

// ── Products ──────────────────────────────────────────────────────────────────
export async function getAllProducts(): Promise<Product[]> {
  const data = await api<{ docs: CmsProduct[] }>("/api/products?depth=1&limit=200");
  return (data?.docs ?? []).map(mapProduct);
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const data = await api<{ docs: CmsProduct[] }>(
    `/api/products?depth=1&limit=${limit}&where[featured][equals]=true`
  );
  const docs = data?.docs ?? [];
  if (docs.length) return docs.map(mapProduct);
  return (await getAllProducts()).slice(0, limit); // fallback if none flagged
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const data = await api<{ docs: CmsProduct[] }>(
    `/api/products?depth=1&limit=1&where[slug][equals]=${encodeURIComponent(slug)}`
  );
  const doc = data?.docs?.[0];
  return doc ? mapProduct(doc) : null;
}

export async function searchProducts(q: string): Promise<Product[]> {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return (await getAllProducts()).filter((p) =>
    [p.name, p.brand, p.sku, p.shortDesc].join(" ").toLowerCase().includes(term)
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
export async function getAllCategories(): Promise<Category[]> {
  const data = await api<{ docs: CmsCategory[] }>("/api/categories?depth=1&limit=200&sort=order");
  return (data?.docs ?? []).map(mapCategory);
}

export async function getTopCategories(): Promise<Category[]> {
  return (await getAllCategories()).filter((c) => !c.parent);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return (await getAllCategories()).find((c) => c.slug === slug) ?? null;
}

export async function getSubCategories(parentSlug: string): Promise<Category[]> {
  return (await getAllCategories()).filter((c) => c.parent === parentSlug);
}

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  const cats = await getAllCategories();
  const childSlugs = cats.filter((c) => c.parent === slug).map((c) => c.slug);
  const all = [slug, ...childSlugs];
  return (await getAllProducts()).filter((p) => all.includes(p.categorySlug));
}

// ── Website settings (globals) ────────────────────────────────────────────────
export type SiteSettings = {
  company: { name: string; legalName: string; tagline: string; description: string };
  contact: { email: string; phone: string; shippingNote: string };
  social: { linkedin?: string; youtube?: string; facebook?: string; instagram?: string; x?: string };
  branding: { logoUrl?: string; faviconUrl?: string };
  seo: { defaultTitle?: string; titleTemplate?: string; description?: string };
};

export async function getSettings(): Promise<SiteSettings> {
  const [company, contact, social, seo, branding] = await Promise.all([
    api<Record<string, unknown>>("/api/globals/company?depth=1"),
    api<Record<string, unknown>>("/api/globals/contact?depth=1"),
    api<Record<string, unknown>>("/api/globals/social?depth=1"),
    api<Record<string, unknown>>("/api/globals/seo?depth=1"),
    api<Record<string, unknown>>("/api/globals/branding?depth=1"),
  ]);
  return {
    company: {
      name: (company?.name as string) || "METNMAT",
      legalName: (company?.legalName as string) || "METNMAT Research & Innovations",
      tagline: (company?.tagline as string) || "India's first private Metallurgy & Materials R&D",
      description: (company?.description as string) || "",
    },
    contact: {
      email: (contact?.email as string) || "contact@metnmat.com",
      phone: (contact?.phone as string) || "+91 78726 86501",
      shippingNote: (contact?.shippingNote as string) || "Shipping across India & worldwide",
    },
    social: {
      linkedin: (social?.linkedin as string) || "#",
      youtube: (social?.youtube as string) || "#",
      facebook: (social?.facebook as string) || "#",
    },
    branding: {
      logoUrl: mediaUrl(branding?.logo as Media),
      faviconUrl: mediaUrl(branding?.favicon as Media),
    },
    seo: {
      defaultTitle: seo?.defaultTitle as string,
      titleTemplate: seo?.titleTemplate as string,
      description: seo?.description as string,
    },
  };
}
