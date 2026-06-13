/**
 * CMS data layer — the website reads ALL catalog + settings from the Payload
 * dashboard (apps/dashboard) via its public REST API. Nothing is hardcoded.
 *
 * Caching: every fetch uses ISR (`revalidate: 60`) so pages are served from
 * the data cache (fast) and CMS edits appear within a minute — plus React
 * `cache()` so the same endpoint is fetched at most once per request (the
 * header, footer, top bar and page all share one settings/nav lookup).
 */
import { cache } from "react";
import type { Product, Category } from "@/frontend/lib/catalog";
import {
  services as phServices,
  projects as phProjects,
  blogPosts as phBlogPosts,
  clients as phClients,
  eduLogos as phEduLogos,
  hero as phHero,
  stats as phStats,
  type Service,
  type Project,
  type BlogPost,
  type Client,
  type EduLogo,
  type Stat,
} from "@/frontend/lib/placeholder";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";

const api = cache(async function api<T>(path: string): Promise<T | null> {
  try {
    // ISR (60s safety net) + the "cms" tag so a dashboard save can purge the
    // whole data cache instantly via POST /api/revalidate.
    const res = await fetch(`${CMS}${path}`, { next: { revalidate: 60, tags: ["cms"] } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // CMS unreachable — pages still render (fallback content)
  }
});

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
  usdPrice?: number;
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
  sizes?: { label?: string }[];
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
    usdPrice: typeof d.usdPrice === "number" && d.usdPrice > 0 ? d.usdPrice : undefined,
    mrp: d.mrp,
    rating: d.rating ?? 0,
    reviewCount: 0,
    inStock: d.inStock ?? true,
    moq: d.moq ?? 1,
    unit: d.unit ?? "unit",
    leadTime: d.leadTime ?? "Ships in 1–2 weeks",
    priceTiers: d.priceTiers ?? [],
    shortDesc: d.shortDesc ?? "",
    sizes: (d.sizes ?? []).map((s) => s.label?.trim()).filter(Boolean) as string[],
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

export async function getProductBySku(sku: string): Promise<Product | null> {
  const data = await api<{ docs: CmsProduct[] }>(
    `/api/products?depth=1&limit=1&where[sku][equals]=${encodeURIComponent(sku)}`
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

// ── Global site search ──────────────────────────────────────────────────────
// Searches the whole site: products + research/services + projects + blog +
// categories + static pages. Products are surfaced first; everything else
// (research, blog, projects, …) follows.
export type SiteLinkType = "Service" | "Blog" | "Project" | "Category" | "Page";
export type SiteLink = { type: SiteLinkType; title: string; href: string; desc?: string };

/** Static pages indexed for global search (keywords broaden matching). */
const SITE_PAGES: (SiteLink & { keywords: string })[] = [
  { type: "Page", title: "Home", href: "/", desc: "METNMAT — materials & electrochemistry R&D and lab equipment", keywords: "home metnmat start" },
  { type: "Page", title: "About", href: "/about", desc: "Who we are and what we do", keywords: "about company team story mission" },
  { type: "Page", title: "Services", href: "/services", desc: "Turnkey materials R&D services", keywords: "services r&d research consulting development" },
  { type: "Page", title: "Projects", href: "/projects", desc: "Case studies and delivered work", keywords: "projects case studies portfolio work" },
  { type: "Page", title: "Blog", href: "/blog", desc: "Articles and updates", keywords: "blog articles news posts insights" },
  { type: "Page", title: "Shop", href: "/shop", desc: "Buy electrodes, cells & accessories", keywords: "shop store buy catalog products ecommerce" },
  { type: "Page", title: "Request for Customization", href: "/quote", desc: "Tell us your requirement and get a quote", keywords: "quote rfq customization custom enquiry contact sales bulk pricing" },
  { type: "Page", title: "Contact", href: "/contact", desc: "Get in touch with METNMAT", keywords: "contact email phone address support reach" },
  { type: "Page", title: "Cart", href: "/cart", desc: "Your shopping cart", keywords: "cart basket bag checkout" },
  { type: "Page", title: "Account", href: "/account", desc: "Your account, orders & RFQs", keywords: "account profile orders login" },
];

export async function searchSite(
  q: string
): Promise<{ products: Product[]; links: SiteLink[] }> {
  const term = q.trim().toLowerCase();
  if (!term) return { products: [], links: [] };
  const has = (s: string) => s.toLowerCase().includes(term);

  const [products, cats, svcs, projs, posts] = await Promise.all([
    searchProducts(term),
    getAllCategories(),
    getServices(),
    getProjects(),
    getBlogPosts(),
  ]);

  // Research / services — highest-priority non-product content.
  const serviceLinks: SiteLink[] = svcs
    .filter((s) => has(`${s.title} ${s.summary}`))
    .map((s) => ({ type: "Service", title: s.title, href: `/services#${s.slug}`, desc: s.summary }));

  // Blog / insights — real detail pages at /blog/[slug].
  const blogLinks: SiteLink[] = posts
    .filter((b) => has(`${b.title} ${b.excerpt} ${b.category}`))
    .map((b) => ({ type: "Blog", title: b.title, href: `/blog/${b.slug}`, desc: b.excerpt }));

  // Projects / case studies.
  const projectLinks: SiteLink[] = projs
    .filter((p) => has(`${p.title} ${p.category} ${p.summary}`))
    .map((p) => ({ type: "Project", title: p.title, href: `/projects#${p.slug}`, desc: p.summary }));

  const categoryLinks: SiteLink[] = cats
    .filter((c) => has(`${c.name} ${c.blurb ?? ""}`))
    .map((c) => ({ type: "Category", title: c.name, href: `/shop/c/${c.slug}`, desc: c.blurb }));

  const pageLinks: SiteLink[] = SITE_PAGES.filter((p) =>
    has(`${p.title} ${p.desc ?? ""} ${p.keywords}`)
  ).map((p) => ({ type: "Page", title: p.title, href: p.href, desc: p.desc }));

  // Order: research → blog → projects → categories → pages.
  return {
    products,
    links: [...serviceLinks, ...blogLinks, ...projectLinks, ...categoryLinks, ...pageLinks],
  };
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

// ── Website content (services / projects / blog / faq / team / clients) ───────
// Each falls back to the bundled placeholder content when the CMS is empty or
// unreachable, so pages always render.

type CmsService = { slug: string; title: string; summary?: string; icon?: string };
export async function getServices(): Promise<Service[]> {
  const data = await api<{ docs: CmsService[] }>("/api/services?depth=0&limit=100&sort=order");
  const docs = data?.docs ?? [];
  if (!docs.length) return phServices;
  return docs.map((d) => ({ slug: d.slug, title: d.title, summary: d.summary ?? "", icon: d.icon }));
}

type CmsProjectDoc = { slug: string; title: string; category?: string; summary?: string };
export async function getProjects(): Promise<Project[]> {
  const data = await api<{ docs: CmsProjectDoc[] }>("/api/projects?depth=0&limit=100&sort=order");
  const docs = data?.docs ?? [];
  if (!docs.length) return phProjects;
  return docs.map((d) => ({ slug: d.slug, title: d.title, category: d.category ?? "", summary: d.summary ?? "" }));
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  return (await getProjects()).find((p) => p.slug === slug) ?? null;
}

type CmsPost = {
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
  publishedDate?: string;
  readingTime?: string;
  author?: string;
  coverImage?: Media;
  body?: unknown;
};
function mapPost(d: CmsPost): BlogPost {
  return {
    slug: d.slug,
    title: d.title,
    excerpt: d.excerpt ?? "",
    category: d.category ?? "Insights",
    date: d.publishedDate ?? "",
    readingTime: d.readingTime ?? "",
  };
}
export async function getBlogPosts(): Promise<BlogPost[]> {
  const data = await api<{ docs: CmsPost[] }>("/api/posts?depth=0&limit=100&sort=-publishedDate");
  const docs = data?.docs ?? [];
  if (!docs.length) return phBlogPosts;
  return docs.map(mapPost);
}
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const data = await api<{ docs: CmsPost[] }>(
    `/api/posts?depth=0&limit=1&where[slug][equals]=${encodeURIComponent(slug)}`
  );
  const doc = data?.docs?.[0];
  if (doc) return mapPost(doc);
  return phBlogPosts.find((p) => p.slug === slug) ?? null;
}

/** Full post for the article page: card meta + author, cover image and rich-text body. */
export type BlogPostFull = BlogPost & { author?: string; coverUrl?: string; body?: unknown };
export async function getBlogPostFull(slug: string): Promise<BlogPostFull | null> {
  const data = await api<{ docs: CmsPost[] }>(
    `/api/posts?depth=1&limit=1&where[slug][equals]=${encodeURIComponent(slug)}`
  );
  const doc = data?.docs?.[0];
  if (doc) {
    return { ...mapPost(doc), author: doc.author, coverUrl: mediaUrl(doc.coverImage), body: doc.body };
  }
  const ph = phBlogPosts.find((p) => p.slug === slug);
  return ph ? { ...ph } : null;
}

export type Faq = { q: string; a: string };
type CmsFaq = { question: string; answer: string };
/** FAQs — returns [] when none in CMS so the caller can fall back to its own. */
export async function getFaqs(): Promise<Faq[]> {
  const data = await api<{ docs: CmsFaq[] }>("/api/faqs?depth=0&limit=100&sort=order");
  return (data?.docs ?? []).map((d) => ({ q: d.question, a: d.answer }));
}

export type TeamMember = { name: string; role?: string; photoUrl?: string; bio?: string; linkedin?: string };
type CmsTeam = { name: string; role?: string; photo?: Media; bio?: string; linkedin?: string };
export async function getTeam(): Promise<TeamMember[]> {
  const data = await api<{ docs: CmsTeam[] }>("/api/team?depth=1&limit=100&sort=order");
  return (data?.docs ?? []).map((d) => ({
    name: d.name,
    role: d.role,
    photoUrl: mediaUrl(d.photo),
    bio: d.bio,
    linkedin: d.linkedin,
  }));
}

type CmsClient = { name: string; logo?: Media; url?: string; type?: string };
/** Logo wall — companies vs institutions, split by `type`. */
export async function getClients(): Promise<{ companies: Client[]; institutions: EduLogo[] }> {
  const data = await api<{ docs: CmsClient[] }>("/api/clients?depth=1&limit=200&sort=order");
  const docs = data?.docs ?? [];
  if (!docs.length) return { companies: phClients, institutions: phEduLogos };
  const companies: Client[] = [];
  const institutions: EduLogo[] = [];
  for (const d of docs) {
    const url = mediaUrl(d.logo);
    if (!url) continue;
    if (d.type === "company") companies.push({ name: d.name, logo: url });
    else institutions.push({ src: url, name: d.name });
  }
  return {
    companies: companies.length ? companies : phClients,
    institutions: institutions.length ? institutions : phEduLogos,
  };
}

// ── Homepage & navigation globals ─────────────────────────────────────────────
export type Homepage = {
  hero: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
  };
  stats: Stat[];
  show: { clients: boolean; services: boolean; projects: boolean; blog: boolean };
};
export async function getHomepage(): Promise<Homepage> {
  const d = await api<Record<string, unknown>>("/api/globals/homepage?depth=0");
  const s = (d?.stats as Stat[] | undefined) ?? [];
  return {
    hero: {
      eyebrow: (d?.eyebrow as string) || phHero.eyebrow,
      titleLead: (d?.titleLead as string) || phHero.titleLead,
      titleAccent: (d?.titleAccent as string) || phHero.titleAccent,
      subtitle: (d?.subtitle as string) || phHero.subtitle,
      primaryCta: {
        label: (d?.primaryCtaLabel as string) || phHero.primaryCta.label,
        href: (d?.primaryCtaHref as string) || phHero.primaryCta.href,
      },
      secondaryCta: {
        label: (d?.secondaryCtaLabel as string) || phHero.secondaryCta.label,
        href: (d?.secondaryCtaHref as string) || phHero.secondaryCta.href,
      },
    },
    stats: s.length ? s.map((x) => ({ value: x.value, label: x.label })) : phStats,
    show: {
      clients: d?.showClients !== false,
      services: d?.showServices !== false,
      projects: d?.showProjects !== false,
      blog: d?.showBlog !== false,
    },
  };
}

export type NavLink = { label: string; href: string };
export type Navigation = { headerLinks: NavLink[]; footerGroups: { title: string; links: NavLink[] }[] };
/** Returns null when the CMS has no nav, so callers fall back to site.ts. */
export async function getNavigation(): Promise<Navigation | null> {
  const d = await api<Record<string, unknown>>("/api/globals/navigation?depth=0");
  const headerLinks = ((d?.headerLinks as NavLink[] | undefined) ?? []).filter((l) => l?.label && l?.href);
  const footerGroups = (d?.footerGroups as { title: string; links: NavLink[] }[] | undefined) ?? [];
  if (!headerLinks.length) return null;
  return { headerLinks, footerGroups };
}

/**
 * ₹-per-$1 display rate — LIVE, refreshed hourly via the data cache:
 *   1. Open Exchange Rates (openexchangerates.org) when OPEN_EXCHANGE_RATES_APP_ID is set
 *   2. open.er-api.com (keyless daily rates) as the live fallback
 *   3. The staff-maintained rate in the dashboard (Commerce & Pricing)
 *   4. 84 as the final hardcoded fallback
 */
const sane = (r: unknown): number | null => {
  const n = Number(r);
  return Number.isFinite(n) && n > 20 && n < 500 ? n : null; // sanity band for INR/USD
};

export const getUsdRate = cache(async function getUsdRate(): Promise<number> {
  // 1) Open Exchange Rates (official, keyed).
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (appId) {
    try {
      const res = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=INR`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const j = (await res.json()) as { rates?: { INR?: number } };
        const r = sane(j?.rates?.INR);
        if (r) return r;
      }
    } catch {
      /* fall through */
    }
  }
  // 2) Keyless live rates (ExchangeRate-API open endpoint, updated daily).
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const j = (await res.json()) as { rates?: { INR?: number } };
      const r = sane(j?.rates?.INR);
      if (r) return r;
    }
  } catch {
    /* fall through */
  }
  // 3) Staff-maintained rate from the dashboard.
  const d = await api<{ usdExchangeRate?: number }>("/api/globals/commerce?depth=0");
  return sane(d?.usdExchangeRate) ?? 84;
});

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
