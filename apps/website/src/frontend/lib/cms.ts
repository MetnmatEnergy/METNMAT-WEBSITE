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
  videoUrl?: string;
  createdAt?: string;
  hsnSac?: string;
  countryOfOrigin?: string;
  productType?: string;
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
    videoUrl: d.videoUrl?.trim() || undefined,
    createdAt: d.createdAt,
    hsnSac: d.hsnSac?.trim() || undefined,
    countryOfOrigin: d.countryOfOrigin?.trim() || undefined,
    productType: d.productType?.trim() || undefined,
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
  // High cap: the storefront filters/sorts/paginates in-memory (the catalog is
  // small). If it ever grows past this, move paging server-side into the query.
  const data = await api<{ docs: CmsProduct[] }>("/api/products?depth=1&limit=500&sort=-createdAt");
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
  // Multi-token AND match (every word must appear somewhere) + relevance score
  // so an exact name/SKU ranks above an incidental shortDesc mention — instead
  // of the old "newest-first that happens to contain the substring".
  const tokens = term.split(/\s+/).filter(Boolean);
  const scored: { p: Product; score: number }[] = [];
  for (const p of await getAllProducts()) {
    const name = p.name.toLowerCase();
    const sku = (p.sku ?? "").toLowerCase();
    const brand = (p.brand ?? "").toLowerCase();
    const desc = (p.shortDesc ?? "").toLowerCase();
    const fields = [name, sku, brand, desc];
    if (!tokens.every((t) => fields.some((f) => f.includes(t)))) continue; // AND
    let score = 0;
    if (name === term) score += 100;
    else if (name.startsWith(term)) score += 45;
    else if (name.includes(term)) score += 25;
    if (sku === term) score += 80;
    else if (sku.includes(term)) score += 25;
    if (brand.includes(term)) score += 10;
    for (const t of tokens) {
      if (name.includes(t)) score += 6;
      if (sku.includes(t)) score += 5;
      if (brand.includes(t)) score += 2;
      if (desc.includes(t)) score += 1;
    }
    scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.p);
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
    .map((p) => ({ type: "Project", title: p.title, href: `/projects/${p.slug}`, desc: p.summary }));

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

type CmsProjectDoc = {
  slug: string;
  title: string;
  subtitle?: string;
  category?: string;
  client?: string;
  year?: number;
  featured?: boolean;
  summary?: string;
  tags?: { tag?: string }[];
  highlights?: { label?: string; value?: string }[];
  coverImage?: Media;
  coverImageAlt?: string;
  body?: unknown;
  gallery?: { image?: Media; caption?: string }[];
  seoTitle?: string;
  metaDescription?: string;
  externalUrl?: string;
};

function mapProjectCard(d: CmsProjectDoc): Project {
  return {
    slug: d.slug,
    title: d.title,
    category: d.category ?? "",
    summary: d.summary ?? "",
    subtitle: d.subtitle,
    client: d.client,
    year: d.year,
    featured: d.featured,
    tags: (d.tags ?? []).map((t) => t.tag?.trim()).filter(Boolean) as string[],
    highlights: (d.highlights ?? [])
      .filter((h) => h.label && h.value)
      .map((h) => ({ label: h.label as string, value: h.value as string })),
    coverUrl: mediaUrl(d.coverImage),
    coverAlt: d.coverImageAlt,
  };
}

// Public visibility (published + active) is enforced by the CMS access rules;
// the explicit where clause here is defense in depth.
const PROJECT_PUBLIC_WHERE =
  "where[_status][equals]=published&where[active][not_equals]=false";

// The CMS orders by `order`; the listing then pins featured projects to the top.
export async function getProjects(): Promise<Project[]> {
  const data = await api<{ docs: CmsProjectDoc[] }>(
    `/api/projects?depth=1&limit=200&sort=order&${PROJECT_PUBLIC_WHERE}`
  );
  // Offline fallback ONLY when the CMS is unreachable — an empty result is a
  // legitimate state (staff unpublished everything) and must render as empty.
  if (!data) return phProjects;
  const mapped = (data.docs ?? []).map(mapProjectCard);
  return [...mapped].sort((a, b) => Number(b.featured) - Number(a.featured));
}

/** Full project for the detail page: card meta + rich body, gallery and SEO. */
export type ProjectFull = Project & {
  body?: unknown;
  gallery?: { url?: string; caption?: string; alt?: string }[];
  seoTitle?: string;
  metaDescription?: string;
  externalUrl?: string;
};

export async function getProjectFull(slug: string): Promise<ProjectFull | null> {
  const data = await api<{ docs: CmsProjectDoc[] }>(
    `/api/projects?depth=1&limit=1&where[slug][equals]=${encodeURIComponent(slug)}&${PROJECT_PUBLIC_WHERE}`
  );
  const doc = data?.docs?.[0];
  if (doc) {
    return {
      ...mapProjectCard(doc),
      body: doc.body,
      gallery: (doc.gallery ?? [])
        .map((g) => ({
          url: mediaUrl(g.image),
          caption: g.caption,
          // Prefer the staff-authored Media alt text; caption/title are fallbacks.
          alt:
            (typeof g.image === "object" && g.image?.alt) || g.caption || doc.title,
        }))
        .filter((g) => g.url),
      seoTitle: doc.seoTitle,
      metaDescription: doc.metaDescription,
      externalUrl: doc.externalUrl,
    };
  }
  // Placeholder fallback ONLY when the CMS is unreachable — if the CMS answered
  // and the slug isn't publicly visible (draft/inactive/deleted), 404 correctly.
  if (data) return null;
  const ph = phProjects.find((p) => p.slug === slug);
  return ph ? { ...ph } : null;
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
  /** Slug of the CMS-selected homepage featured project (if set + public). */
  featuredProjectSlug?: string;
};
export async function getHomepage(): Promise<Homepage> {
  // depth=1 populates the featuredProject relationship (respecting public
  // read access, so a draft/inactive selection resolves to just an id and is
  // ignored by the slug check below → the caller falls back).
  const d = await api<Record<string, unknown>>("/api/globals/homepage?depth=1");
  const s = (d?.stats as Stat[] | undefined) ?? [];
  const fp = d?.featuredProject;
  const featuredProjectSlug =
    fp && typeof fp === "object" ? ((fp as { slug?: string }).slug || undefined) : undefined;
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
    featuredProjectSlug,
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

// ── Maintenance notice (global) ───────────────────────────────────────────────
export type MaintenanceNotice = { enabled: boolean; message: string; showContact: boolean };

const DEFAULT_MAINTENANCE_MESSAGE =
  "We are currently performing scheduled maintenance. Some features may be temporarily unavailable.";

/**
 * Staff-controlled maintenance banner state. Fail-safe: if the CMS is
 * unreachable the banner stays OFF (the site must never look broken because
 * the notice about maintenance could not be fetched).
 */
export async function getMaintenance(): Promise<MaintenanceNotice> {
  const d = await api<Record<string, unknown>>("/api/globals/maintenance?depth=0");
  return {
    enabled: d?.enabled === true,
    message: ((d?.message as string) || "").trim() || DEFAULT_MAINTENANCE_MESSAGE,
    showContact: d?.showContact !== false,
  };
}

// ── Website settings (globals) ────────────────────────────────────────────────
export type SiteSettings = {
  company: { name: string; legalName: string; tagline: string; description: string };
  contact: { email: string; email2?: string; phone: string; shippingNote: string };
  social: { linkedin?: string; youtube?: string; facebook?: string; amazon?: string; instagram?: string; x?: string };
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
      legalName: (company?.legalName as string) || "METNMAT INNOVATIONS PRIVATE LIMITED",
      tagline: (company?.tagline as string) || "Research. Design. Build. Scale.",
      description: (company?.description as string) || "",
    },
    contact: {
      email: (contact?.email as string) || "contact@metnmat.com",
      email2: (contact?.email2 as string) || "",
      phone: (contact?.phone as string) || "+91 78726 86501",
      shippingNote: (contact?.shippingNote as string) || "Shipping across India & worldwide",
    },
    social: {
      linkedin: (social?.linkedin as string) || "#",
      youtube: (social?.youtube as string) || "#",
      facebook: (social?.facebook as string) || "#",
      amazon: (social?.amazon as string) || "#",
      // Empty (not "#") when unset so consumers can skip rendering them.
      instagram: (social?.instagram as string) || "",
      x: (social?.x as string) || "",
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
