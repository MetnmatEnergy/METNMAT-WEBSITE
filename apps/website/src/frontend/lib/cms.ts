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
import { DEFAULT_TAX_POLICY, taxPolicyFrom, type TaxPolicy } from "./tax";
import type { Product, Category } from "@/frontend/lib/catalog";
import { selectBrowsable } from "@/frontend/lib/catalog";
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

/** The CMS did not answer. Distinct from it answering "there is no such thing". */
export class CmsUnavailableError extends Error {
  constructor(path: string, cause?: unknown) {
    super(`CMS unavailable for ${path}`);
    this.name = "CmsUnavailableError";
    this.cause = cause;
  }
}

/**
 * Like `api`, but a failure THROWS instead of looking like an empty result.
 *
 * WHAT WAS WRONG
 * `api` collapsed three different outcomes into one `null`: transport failure,
 * a non-2xx upstream, and a successful empty result. Every detail route read
 * that null as "this document does not exist" and called notFound(), so any CMS
 * unavailability — a restart, a 5xx, an Atlas blip — turned every product,
 * category, project and blog URL into a real HTTP 404. A 404 tells Google to
 * drop the URL; a 5xx tells it to come back. A few minutes of downtime could
 * therefore cost catalogue rankings, and nothing signalled that anything failed.
 *
 * The distinction already exists elsewhere in the codebase, and even elsewhere
 * in THIS file: getProjects() treats null as "unreachable, use placeholders"
 * twelve lines above getProjectFull() treating the identical null as "no such
 * slug". The listing and fallback callers genuinely should degrade, so `api`
 * keeps its behaviour; the DETAIL fetchers use this one, and call notFound()
 * only when the CMS answered and had nothing.
 */
const apiStrict = cache(async function apiStrict<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CMS}${path}`, { next: { revalidate: 60, tags: ["cms"] } });
  } catch (e) {
    throw new CmsUnavailableError(path, e);
  }
  if (!res.ok) throw new CmsUnavailableError(path, `HTTP ${res.status}`);
  return (await res.json()) as T;
});

type MediaSize = { url?: string; width?: number; height?: number };

type Media =
  | {
      url?: string;
      alt?: string;
      width?: number;
      height?: number;
      sizes?: Partial<Record<LadderSize, MediaSize>>;
    }
  | string
  | null
  | undefined;

/**
 * The Media collection's 4:3 variant ladder (apps/dashboard/src/collections/Media.ts),
 * ASCENDING by width. `display` sits after `pdp` deliberately: both render at
 * 1600×1200, and where the subject-aware display derivative exists it must win.
 *
 * Payload generates these once, at upload. Serving them directly is what keeps
 * `/_next/image` — and therefore sharp — off the website process entirely for
 * product photography; see mediaVariants() below.
 */
const LADDER = ["micro", "thumb", "card", "pdp", "display", "zoom"] as const;
type LadderSize = (typeof LADDER)[number];

/** Absolute URL for a Payload media object (handles local + cloud storage). */
export function mediaUrl(media: Media): string | undefined {
  if (!media || typeof media === "string") return undefined;
  return absolute(media.url);
}

function absolute(u?: string): string | undefined {
  if (!u) return undefined;
  return u.startsWith("http") ? u : `${CMS}${u}`;
}

/**
 * Every ladder derivative Payload actually generated for this media, ascending
 * by width, with the stored original as the final entry.
 *
 * Read from the record rather than reconstructed from the filename, because the
 * ladder is NOT uniform: media uploaded before the 4:3 ladder landed carry only
 * `card`, so guessing `<stem>-1600x1200.webp` for those would 404. Deduped by
 * width, which is also how `display` supersedes `pdp` at 1600.
 */
export function mediaVariants(media: Media): { url: string; width: number }[] {
  if (!media || typeof media === "string") return [];
  const byWidth = new Map<number, string>();
  for (const name of LADDER) {
    const size = media.sizes?.[name];
    const url = absolute(size?.url);
    if (url && size?.width) byWidth.set(size.width, url);
  }
  const original = absolute(media.url);
  if (original && media.width) byWidth.set(media.width, original);
  return [...byWidth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([width, url]) => ({ url, width }));
}

/**
 * A `srcset` attribute over the whole ladder. Paired with a `sizes` hint the
 * browser picks the variant that fits the slot — the same responsive selection
 * next/image used to do, minus the server-side re-encode.
 */
export function mediaSrcSet(media: Media): string | undefined {
  const variants = mediaVariants(media);
  return variants.length > 1 ? variants.map((v) => `${v.url} ${v.width}w`).join(", ") : undefined;
}

/**
 * The smallest derivative at least `minWidth` wide — the fallback `src` for a
 * given surface (800 card grid · 1600 PDP stage · 2400 lightbox). Falls back to
 * the largest variant, then to the stored file, so media with a short ladder
 * still resolves.
 */
export function mediaAtLeast(media: Media, minWidth: number): string | undefined {
  const variants = mediaVariants(media);
  if (variants.length === 0) return mediaUrl(media);
  return (variants.find((v) => v.width >= minWidth) ?? variants[variants.length - 1]!).url;
}

type CmsCategory = {
  slug: string;
  name: string;
  blurb?: string;
  order?: number;
  parent?: { slug?: string } | string | null;
  image?: Media;
  updatedAt?: string;
  hidden?: boolean;
};

type CmsProduct = {
  slug: string;
  name: string;
  brand?: string;
  sku?: string;
  category?: { slug?: string } | string | null;
  price?: number;
  usdPrice?: number;
  internationalPricing?: "AUTO_CONVERT" | "FIXED_USD";
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
  description?: unknown;
  images?: { image?: Media }[];
  videoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  hsnSac?: string;
  countryOfOrigin?: string;
  productType?: string;
  documents?: (CmsDocument | string)[];
  seoTitle?: string;
  metaDescription?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: Media;
  noIndex?: boolean;
};

/** A product-attached document (datasheet / SDS / certificate). Only ones the
 *  staff flagged `public` are exposed on the storefront. */
type CmsDocument = { id?: string; title?: string; filename?: string; url?: string; public?: boolean };

function mapProduct(d: CmsProduct): Product {
  // Display URL (gallery/cards), full URL (lightbox = untouched original) and
  // alt are kept pairwise so the arrays stay index-aligned even when an entry
  // has no resolvable file and is dropped.
  const gallery = (d.images ?? [])
    .map((i) => ({
      card: mediaAtLeast(i.image, 800), // grid card / cart / mosaic fallback src
      src: mediaAtLeast(i.image, 1600), // PDP stage fallback src
      full: mediaAtLeast(i.image, 2400), // lightbox fallback src
      srcSet: mediaSrcSet(i.image) ?? "", // the whole ladder; the browser chooses
      alt: typeof i.image === "object" && i.image ? (i.image.alt ?? "").trim() : "",
    }))
    .filter(
      (g): g is { card: string; src: string; full: string; srcSet: string; alt: string } =>
        Boolean(g.src) && Boolean(g.card) && Boolean(g.full)
    );
  return {
    slug: d.slug,
    name: d.name,
    brand: d.brand ?? "",
    categorySlug: typeof d.category === "object" && d.category ? d.category.slug ?? "" : "",
    sku: d.sku ?? "",
    price: d.price ?? 0,
    usdPrice: typeof d.usdPrice === "number" && d.usdPrice > 0 ? d.usdPrice : undefined,
    // Same derivation the CMS hook applies on save, so a product that has not
    // been re-saved since the field was added prices identically either way.
    internationalPricing:
      d.internationalPricing ??
      (typeof d.usdPrice === "number" && d.usdPrice > 0 ? "FIXED_USD" : "AUTO_CONVERT"),
    mrp: d.mrp,
    rating: d.rating ?? 0,
    reviewCount: 0,
    inStock: d.inStock ?? true,
    moq: d.moq ?? 1,
    unit: d.unit ?? "unit",
    leadTime: d.leadTime ?? "Ships in 1–2 weeks",
    priceTiers: d.priceTiers ?? [],
    shortDesc: d.shortDesc ?? "",
    description: d.description,
    sizes: (d.sizes ?? []).map((s) => s.label?.trim()).filter(Boolean) as string[],
    specs: d.specs ?? [],
    // Only PUBLIC documents surface as downloadable datasheets. Private docs
    // (invoices/quotations also live in the Documents collection) come back from
    // the public API as bare IDs, so the object+public===true filter drops them.
    datasheets: (d.documents ?? [])
      .filter((doc): doc is CmsDocument => typeof doc === "object" && doc !== null && doc.public === true)
      .map((doc) => ({
        label: doc.title?.trim() || doc.filename || "Datasheet (PDF)",
        href: doc.url ? (doc.url.startsWith("http") ? doc.url : `${CMS}${doc.url}`) : "",
      }))
      .filter((sheet) => sheet.href),
    badges: d.badges ?? [],
    imageUrl: gallery[0]?.card,
    imageSrcSet: gallery[0]?.srcSet || undefined,
    images: gallery.map((g) => g.src),
    imageFulls: gallery.map((g) => g.full),
    imageSrcSets: gallery.map((g) => g.srcSet),
    imageAlts: gallery.map((g) => g.alt),
    videoUrl: d.videoUrl?.trim() || undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    hsnSac: d.hsnSac?.trim() || undefined,
    countryOfOrigin: d.countryOfOrigin?.trim() || undefined,
    productType: d.productType?.trim() || undefined,
    // Optional SEO overrides from the CMS. Empty strings collapse to undefined
    // so the page's existing fallbacks (name / shortDesc / first image) apply
    // unchanged when staff leave a field blank.
    seoTitle: d.seoTitle?.trim() || undefined,
    metaDescription: d.metaDescription?.trim() || undefined,
    seoKeywords: d.keywords?.trim() || undefined,
    canonicalUrl: d.canonicalUrl?.trim() || undefined,
    ogImageUrl: mediaUrl(d.ogImage) || undefined,
    noIndex: d.noIndex === true,
  };
}

function mapCategory(d: CmsCategory): Category {
  return {
    slug: d.slug,
    name: d.name,
    blurb: d.blurb,
    parent: typeof d.parent === "object" && d.parent ? d.parent.slug : undefined,
    imageUrl: mediaUrl(d.image),
    updatedAt: d.updatedAt,
    hidden: d.hidden === true,
  };
}

// ── Products ──────────────────────────────────────────────────────────────────
export async function getAllProducts(): Promise<Product[]> {
  // High cap: the storefront filters/sorts/paginates in-memory (the catalog is
  // small). If it ever grows past this, move paging server-side into the query.
  const data = await api<{ docs: CmsProduct[] }>("/api/products?depth=1&limit=500&sort=-createdAt");
  return (data?.docs ?? []).map(mapProduct);
}

/**
 * Lightweight product list for the sitemap: slug + timestamps only, `depth=0` so
 * NO relationships/media are populated. The full getAllProducts (depth=1,
 * limit=500) is heavy enough to time out against a cold CMS during a build — when
 * it does, the sitemap's `.catch(() => [])` silently drops EVERY product URL.
 * This query is cheap and reliable, so product pages always make the sitemap.
 */
export async function getProductSitemapEntries(): Promise<
  { slug: string; updatedAt?: string; createdAt?: string }[]
> {
  const data = await api<{ docs: { slug?: string; updatedAt?: string; createdAt?: string }[] }>(
    "/api/products?depth=0&limit=1000&sort=-createdAt"
  );
  return (data?.docs ?? [])
    .filter((d): d is { slug: string; updatedAt?: string; createdAt?: string } => Boolean(d.slug))
    .map((d) => ({ slug: d.slug, updatedAt: d.updatedAt, createdAt: d.createdAt }));
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
  // Strict: null here means the CMS answered and had no such slug, so the route
  // may 404. A CMS outage throws instead of masquerading as a missing product.
  const data = await apiStrict<{ docs: CmsProduct[] }>(
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


/**
 * Normalise text for search on BOTH sides — the query and the indexed fields.
 *
 * NFKD folds the subscript digits used in chemical formulae down to ASCII, so
 * the article titled "CO₂ Fuel Cells" is reachable by typing "CO2" — which is
 * what people actually type, and which previously returned nothing at all. It
 * also strips diacritics, so "Café" matches "cafe".
 */
export function normalizeSearchText(s: string): string {
  return s
    .normalize("NFKD")
    // Combining marks left behind by NFKD (the accent in "Café").
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Terms the catalogue names differently from the way customers ask for them.
 * Every entry maps a word a buyer types onto wording that genuinely appears in
 * our own data — Nafion IS the PFSA membrane we stock, "electrolyser" is the
 * British spelling of a product we list as "electrolyzer". No invented
 * equivalences: if we do not sell it, the synonym does not conjure a result.
 */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  nafion: ["pfsa", "perfluorosulfonic"],
  electrolyser: ["electrolyzer"],
  electrolysers: ["electrolyzers"],
  electrolyse: ["electrolyze"],
  analyser: ["analyzer"],
  sulphate: ["sulfate"],
  sulphuric: ["sulfuric"],
  aluminium: ["aluminum"],
};

/** A token matches if the field contains it, or any wording we use for it. */
function tokenVariants(t: string): string[] {
  return [t, ...(SEARCH_SYNONYMS[t] ?? [])];
}

export async function searchProducts(q: string): Promise<Product[]> {
  const term = normalizeSearchText(q);
  if (!term) return [];
  // Multi-token AND match (every word must appear somewhere) + relevance score
  // so an exact name/SKU ranks above an incidental shortDesc mention — instead
  // of the old "newest-first that happens to contain the substring".
  const tokens = term.split(/\s+/).filter(Boolean);
  const scored: { p: Product; score: number }[] = [];
  for (const p of await getAllProducts()) {
    const name = normalizeSearchText(p.name);
    const sku = normalizeSearchText(p.sku ?? "");
    const brand = normalizeSearchText(p.brand ?? "");
    const desc = normalizeSearchText(p.shortDesc ?? "");
    const fields = [name, sku, brand, desc];
    // AND across tokens, OR across each token's accepted wordings.
    if (!tokens.every((t) => tokenVariants(t).some((v) => fields.some((f) => f.includes(v))))) continue;
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
  const term = normalizeSearchText(q);
  if (!term) return { products: [], links: [] };
  const terms = term.split(/s+/).filter(Boolean).flatMap(tokenVariants);
  // Match on any accepted wording so "CO2" reaches "CO₂" and "electrolyser"
  // reaches "electrolyzer"; the whole phrase still wins on relevance below.
  const has = (s: string) => {
    const f = normalizeSearchText(s);
    return f.includes(term) || terms.some((t) => f.includes(t));
  };

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

/**
 * One category by slug, asked for directly.
 *
 * Used to filter the full 200-row list, which meant a CMS outage produced an
 * empty list and read as "no such category" — a hard 404 on a real department.
 * A targeted strict query separates the two, and fetches one row instead of two
 * hundred.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const data = await apiStrict<{ docs: CmsCategory[] }>(
    `/api/categories?depth=1&limit=1&where[slug][equals]=${encodeURIComponent(slug)}`
  );
  const doc = data?.docs?.[0];
  return doc ? mapCategory(doc) : null;
}

export async function getTopCategories(): Promise<Category[]> {
  return (await getAllCategories()).filter((c) => !c.parent);
}

/**
 * Categories the storefront shows.
 *
 * Visibility is a staff decision, read from the `hidden` flag — it is not
 * inferred from whether a category happens to hold products. An empty
 * department is usually deliberate ("we are not selling this yet"), and the
 * listing page already says "No products in this category yet", so hiding it
 * automatically removes a real part of the range on a guess.
 */
export async function getVisibleCategories(): Promise<Category[]> {
  return (await getAllCategories()).filter((c) => !c.hidden);
}

/** Top-level departments — the shop grid and the header menu. */
export async function getVisibleTopCategories(): Promise<Category[]> {
  return (await getVisibleCategories()).filter((c) => !c.parent);
}

/**
 * Categories worth SUBMITTING to search engines: visible and actually stocked.
 *
 * A stricter rule than the storefront on purpose. An empty department is a
 * reasonable page for a shopper who navigated to it and thin content for a
 * crawler that was invited to it — being in the range and being worth indexing
 * are different questions.
 */
export async function getIndexableCategories(): Promise<Category[]> {
  const [cats, prods] = await Promise.all([getVisibleCategories(), getAllProducts()]);
  return selectBrowsable(cats, prods);
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
/*
 * ACTIVE FILTER.
 *
 * Services, Team and Clients each carry an `active` checkbox labelled "Uncheck
 * to hide from the website" — and nothing read it. Staff could untick it, see it
 * saved, and the row stayed live on the site. A control that reports success and
 * does nothing is worse than no control.
 *
 * `not_equals false` rather than `equals true` on purpose: rows created before
 * the field existed have no value at all, and `equals true` would have hidden
 * every one of them — turning a bug fix into a blank page.
 */
const ACTIVE_ONLY = "where[active][not_equals]=false";

export async function getServices(): Promise<Service[]> {
  const data = await api<{ docs: CmsService[] }>(`/api/services?depth=0&limit=100&sort=order&${ACTIVE_ONLY}`);
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
  updatedAt?: string;
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
    updatedAt: d.updatedAt,
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
  // Strict — see getProductBySlug. Twelve lines above, getProjects() already
  // treats a null from `api` as "unreachable"; this used to read the same null
  // as "no such project" and 404 the page.
  const data = await apiStrict<{ docs: CmsProjectDoc[] }>(
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

export type Faq = { q: string; a: string; category?: string };
type CmsFaq = { question: string; answer: string; category?: string };
/**
 * FAQs — returns [] when none in CMS so the caller can fall back to its own.
 *
 * Filters on `active`. It previously did not, which made the admin checkbox
 * decorative: its own description reads "Uncheck to hide", but an unchecked FAQ
 * still rendered on the page AND was still emitted as FAQPage structured data.
 * Staff had no way to retract a published answer from Google short of deleting
 * the record.
 *
 * `not_equals: false` rather than `equals: true` so a document written before
 * the field existed (no `active` key at all) still shows, instead of silently
 * emptying the section.
 *
 * `category` is optional and free text in the CMS. Passing one scopes the
 * result, so a page can emit an FAQPage of only its own questions — the schema
 * is driven by what is actually in the database, not by a hardcoded list.
 */
export async function getFaqs(category?: string): Promise<Faq[]> {
  const scope = category ? `&where[category][equals]=${encodeURIComponent(category)}` : "";
  const data = await api<{ docs: CmsFaq[] }>(
    `/api/faqs?depth=0&limit=100&sort=order&where[active][not_equals]=false${scope}`,
  );
  return (data?.docs ?? []).map((d) => ({ q: d.question, a: d.answer, category: d.category }));
}

export type TeamMember = { name: string; role?: string; photoUrl?: string; bio?: string; linkedin?: string };
type CmsTeam = { name: string; role?: string; photo?: Media; bio?: string; linkedin?: string };
export async function getTeam(): Promise<TeamMember[]> {
  const data = await api<{ docs: CmsTeam[] }>(`/api/team?depth=1&limit=100&sort=order&${ACTIVE_ONLY}`);
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
  const data = await api<{ docs: CmsClient[] }>(`/api/clients?depth=1&limit=200&sort=order&${ACTIVE_ONLY}`);
  const docs = data?.docs ?? [];
  if (!docs.length) return { companies: phClients, institutions: phEduLogos };
  const companies: Client[] = [];
  const institutions: EduLogo[] = [];
  for (const d of docs) {
    const url = mediaUrl(d.logo);
    if (!url) continue;
    // Payload returns intrinsic width/height on a media doc; carrying them
    // through lets the marquee reserve the right box before the logo loads.
    const dim =
      d.logo && typeof d.logo === "object"
        ? { width: d.logo.width, height: d.logo.height }
        : {};
    if (d.type === "company") companies.push({ name: d.name, logo: url, ...dim });
    else institutions.push({ src: url, name: d.name, ...dim });
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

/** One live source, bounded. Resolves to null rather than throwing. */
async function liveRate(url: string, budgetMs: number): Promise<number | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(budgetMs),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { rates?: { INR?: number } };
    return sane(j?.rates?.INR);
  } catch {
    return null;
  }
}

/**
 * How long the whole lookup may spend on third parties.
 *
 * WHAT WAS WRONG
 * The two live sources were tried SEQUENTIALLY, each with its own 2.5s timeout,
 * and RootLayout awaits this before returning any JSX. So on a cold data cache
 * every page on the site could sit behind up to five seconds of third-party
 * network before the shell was even sent — and if OPEN_EXCHANGE_RATES_APP_ID was
 * a placeholder rather than absent, the first of those hops was doomed from the
 * start and paid for on every cold render anyway.
 *
 * Steady state was always fine: `revalidate: 3600` means Next serves the cached
 * value and refreshes behind the request. The cold path was the problem, and the
 * cold path is exactly what a visitor hits after every deploy or restart.
 *
 * Now both sources race in parallel on one shared budget, so the worst case is
 * one timeout instead of two, and a slow source cannot delay a fast one.
 */
const LIVE_RATE_BUDGET_MS = 1200;

export const getUsdRate = cache(async function getUsdRate(): Promise<number> {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  const sources: Array<Promise<number | null>> = [
    // Keyless open endpoint (ExchangeRate-API), updated daily.
    liveRate("https://open.er-api.com/v6/latest/USD", LIVE_RATE_BUDGET_MS),
  ];
  if (appId) {
    sources.unshift(
      liveRate(
        `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=INR`,
        LIVE_RATE_BUDGET_MS
      )
    );
  }

  // Settled, not raced: a source that fails fast must not decide the answer
  // before a slower, more authoritative one has replied. The order of `sources`
  // is the preference order.
  const results = await Promise.all(sources);
  for (const r of results) if (r) return r;

  // Staff-maintained rate from the dashboard — same-origin and already cached,
  // so this costs nothing once the CMS has been read for anything else.
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

/** Grievance Officer + SLA published for the DPDP Act, 2023 (s.13(3)). */
export type PrivacySettings = {
  officerName: string;
  officerEmail: string;
  officerPhone: string;
  responseDays: number;
};

/**
 * Read the `privacy` global. Falls back to the company mailbox so the policy
 * always publishes a REACHABLE contact — a blank grievance contact would be a
 * compliance gap, and an invented one would be worse.
 */
export async function getPrivacySettings(): Promise<PrivacySettings> {
  const g = await api<Record<string, unknown>>("/api/globals/privacy?depth=0");
  const days = Number(g?.responseDays);
  return {
    officerName: (g?.officerName as string) || "",
    officerEmail: (g?.officerEmail as string) || "contact@metnmat.com",
    officerPhone: (g?.officerPhone as string) || "",
    responseDays: Number.isFinite(days) && days > 0 ? days : 30,
  };
}

/**
 * Tax policy from the commerce global.
 *
 * Cached per request like the exchange rate, and falls back to the DEFAULT
 * policy on any failure — a tax treatment that changes because a fetch timed
 * out would be far worse than one that never changes.
 */
export const getTaxPolicy = cache(async function getTaxPolicy(): Promise<TaxPolicy> {
  try {
    const d = await api<Record<string, unknown>>("/api/globals/commerce?depth=0");
    return taxPolicyFrom(d);
  } catch {
    return DEFAULT_TAX_POLICY;
  }
});
