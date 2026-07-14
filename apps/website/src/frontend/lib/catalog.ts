/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CATALOG (PLACEHOLDER) — B2B + B2C commerce data                           │
 * │                                                                           │
 * │  Structure mirrors Amazon / Flipkart / B2B catalog sites (IndiaMART,      │
 * │  Alibaba): hierarchical categories + rich products with B2B fields        │
 * │  (MOQ, tiered pricing, SKU, datasheets, lead time, ratings).              │
 * │                                                                           │
 * │  All data is placeholder. Replace per category, or wire to MongoDB +      │
 * │  Meilisearch later. Search "TODO(content)".                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

export type Category = {
  slug: string;
  name: string;
  parent?: string; // parent category slug (omit for top-level departments)
  blurb?: string;
  imageUrl?: string; // CMS-managed category image
};

export type PriceTier = { minQty: number; price: number };
export type Spec = { label: string; value: string };
export type Datasheet = { label: string; href: string };
export type Review = {
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
};

export type Product = {
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  sku: string;
  price: number; // base unit price (INR)
  usdPrice?: number; // optional manual USD price (override); blank ⇒ auto-convert from INR
  mrp?: number; // list price for showing a discount
  rating: number; // 0–5
  reviewCount: number;
  inStock: boolean;
  moq: number; // minimum order quantity (B2B)
  unit: string; // "unit", "kg", "box", ...
  leadTime: string; // e.g. "Ships in 1–2 weeks"
  priceTiers: PriceTier[]; // bulk pricing (B2B)
  shortDesc: string;
  sizes?: string[]; // selectable size options for this SKU
  specs: Spec[];
  datasheets: Datasheet[];
  badges?: string[]; // "Bestseller", "New", "GST invoice"
  reviews?: Review[];
  imageUrl?: string; // CMS-managed primary image
  images?: string[]; // CMS-managed gallery
  videoUrl?: string; // CMS-managed YouTube link, shown as a playable item in the gallery
  createdAt?: string; // CMS document creation date (ISO) — used for "Newest" sort
  updatedAt?: string; // CMS last-edit date (ISO) — used for sitemap lastModified
  hsnSac?: string; // HSN/SAC code — snapshotted onto order items for the GST invoice
  countryOfOrigin?: string;
  productType?: string; // "in-stock" | "made-to-order" | "quote-only" | "discontinued"
};

export type Deal = { title: string; subtitle: string; href: string };

// ── Categories (2-level: departments → subcategories) ─────────────────────────
// TODO(content): real taxonomy.
export const categories: Category[] = [
  { slug: "furnaces", name: "Furnaces", blurb: "Muffle, tubular & box furnaces" },
  { slug: "muffle-furnaces", name: "Muffle Furnaces", parent: "furnaces" },
  { slug: "tubular-furnaces", name: "Tubular Furnaces", parent: "furnaces" },
  { slug: "crucibles", name: "Crucibles", blurb: "Alumina, graphite, zirconia" },
  { slug: "analysis", name: "Analysis Instruments", blurb: "Microscopes, testers" },
  { slug: "consumables", name: "Consumables", blurb: "Mounting, polishing, etchants" },
  { slug: "raw-materials", name: "Raw Materials & Alloys", blurb: "Metals, powders, alloys" },
  { slug: "safety", name: "Lab Safety", blurb: "PPE, storage, handling" },
];

// ── Products ──────────────────────────────────────────────────────────────────
// TODO(content): real catalog (or fetch from API + Meilisearch).
function p(over: Partial<Product> & Pick<Product, "slug" | "categorySlug">): Product {
  return {
    name: "Product Name",
    brand: "Brand",
    sku: "SKU-0000",
    price: 0,
    rating: 4.5,
    reviewCount: 0,
    inStock: true,
    moq: 1,
    unit: "unit",
    leadTime: "Ships in 1–2 weeks",
    priceTiers: [],
    shortDesc: "Short product description goes here.",
    specs: [
      { label: "Spec", value: "Value" },
      { label: "Spec", value: "Value" },
    ],
    datasheets: [{ label: "Datasheet (PDF)", href: "#" }],
    badges: [],
    reviews: [],
    ...over,
  };
}

export const products: Product[] = [
  p({ slug: "muffle-furnace-1200", name: "Muffle Furnace 1200°C", brand: "MetLab", categorySlug: "muffle-furnaces", sku: "MF-1200", price: 84000, mrp: 96000, rating: 4.6, reviewCount: 24, moq: 1, badges: ["Bestseller", "GST invoice"], priceTiers: [{ minQty: 2, price: 81000 }, { minQty: 5, price: 78000 }] }),
  p({ slug: "tubular-furnace-1400", name: "Tubular Furnace 1400°C", brand: "MetLab", categorySlug: "tubular-furnaces", sku: "TF-1400", price: 132000, rating: 4.7, reviewCount: 11, badges: ["New"] }),
  p({ slug: "zirconia-crucible", name: "Zirconia Crucible", brand: "CeraTech", categorySlug: "crucibles", sku: "CR-ZR-50", price: 1800, rating: 4.4, reviewCount: 63, moq: 10, unit: "pc", priceTiers: [{ minQty: 25, price: 1650 }, { minQty: 100, price: 1450 }] }),
  p({ slug: "graphite-crucible", name: "Graphite Crucible", brand: "CeraTech", categorySlug: "crucibles", sku: "CR-GR-30", price: 1200, rating: 4.2, reviewCount: 40, moq: 10, unit: "pc" }),
  p({ slug: "metallurgical-microscope", name: "Metallurgical Microscope", brand: "OptiScope", categorySlug: "analysis", sku: "MS-1000", price: 245000, mrp: 268000, rating: 4.8, reviewCount: 9, badges: ["GST invoice"] }),
  p({ slug: "hardness-tester", name: "Vickers Hardness Tester", brand: "OptiScope", categorySlug: "analysis", sku: "HT-VK", price: 410000, rating: 4.5, reviewCount: 5 }),
  p({ slug: "polishing-cloth-pack", name: "Polishing Cloth (Pack)", brand: "PrepPro", categorySlug: "consumables", sku: "PC-50", price: 950, rating: 4.1, reviewCount: 88, moq: 5, unit: "pack" }),
  p({ slug: "copper-alloy-ingot", name: "High-Conductivity Copper Alloy", brand: "METNMAT", categorySlug: "raw-materials", sku: "CU-HC-91", price: 0, rating: 4.9, reviewCount: 3, moq: 50, unit: "kg", badges: ["Made by METNMAT"], priceTiers: [{ minQty: 100, price: 0 }, { minQty: 500, price: 0 }] }),
];

// ── Deals strip (homepage of the shop) ─────────────────────────────────────────
export const deals: Deal[] = [
  { title: "Electrodes for every setup", subtitle: "Reference · counter · working", href: "/shop/c/electrodes" },
  { title: "New: ion-exchange membranes", subtitle: "PEM · AEM · BPM · CEM", href: "/shop/c/membranes" },
  { title: "Request a bulk quote", subtitle: "GST invoice · pan-India shipping", href: "/quote" },
];

// Sort options used by the listing page.
export const sortOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Avg. Customer Rating" },
  { value: "newest", label: "Newest Arrivals" },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────
export const topCategories = () => categories.filter((c) => !c.parent);
export const subCategories = (parent: string) =>
  categories.filter((c) => c.parent === parent);
export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug) ?? null;

export const getProduct = (slug: string) =>
  products.find((p) => p.slug === slug) ?? null;

/** Products in a category, including its subcategories. */
export function productsByCategory(slug: string): Product[] {
  const childSlugs = subCategories(slug).map((c) => c.slug);
  const all = [slug, ...childSlugs];
  return products.filter((p) => all.includes(p.categorySlug));
}

export const featuredProducts = (n = 8) => products.slice(0, n);

export function searchProducts(q: string): Product[] {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return products.filter((p) =>
    [p.name, p.brand, p.sku, p.shortDesc].join(" ").toLowerCase().includes(term)
  );
}

/** All distinct brands (for filter facets). */
export const allBrands = () => Array.from(new Set(products.map((p) => p.brand))).sort();

/** Format INR price. Returns "On request" for 0 (B2B quote-only items). */
export function formatINR(value: number): string {
  if (!value) return "On request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * GST display. Catalog prices are stored EXCLUDING GST; the site shows
 * GST-inclusive prices everywhere (B2C-friendly, like Amazon).
 */
export const GST_RATE = 0.18;

/** GST-inclusive price, rounded to the rupee. 0 stays 0 (quote-only). */
export const inclGST = (value: number): number => Math.round(value * (1 + GST_RATE));

/** The GST amount contained inside a GST-inclusive value (for invoices/summaries). */
export const gstPortionOf = (inclValue: number): number =>
  Math.round(inclValue - inclValue / (1 + GST_RATE));

/** Effective unit price for a given quantity using tier breaks. */
export function unitPriceForQty(product: Product, qty: number): number {
  let price = product.price;
  for (const tier of product.priceTiers) {
    if (qty >= tier.minQty && tier.price) price = tier.price;
  }
  return price;
}

/**
 * Hard ceiling on the quantity of any single line. Shared by the cart store,
 * the quantity stepper and the server checkout route so the quantity a customer
 * SEES can never differ from the quantity that is CHARGED.
 */
export const MAX_ORDER_QTY = 10_000;

/**
 * Clamp a quantity to the product's valid purchase range: never below its MOQ
 * (minimum order quantity), never above MAX_ORDER_QTY, always a whole number.
 * Used identically on the client (cart) and server (create-order) so the
 * displayed line/qty always matches what Razorpay charges.
 */
export function clampQty(product: Pick<Product, "moq">, qty: number): number {
  const moq = Math.max(1, Math.round(product.moq) || 1);
  const q = Math.round(Number(qty)) || moq;
  return Math.min(Math.max(q, moq), MAX_ORDER_QTY);
}

/**
 * A product cannot be bought online when it has no price, OR when staff marked
 * it "quote-only"/"discontinued" in the CMS (productType) — a price alone must
 * not make a discontinued item purchasable. ("in-stock"/"made-to-order" both
 * remain buyable; made-to-order just ships on a longer lead time.)
 */
export const isQuoteOnly = (product: Pick<Product, "price" | "productType">): boolean =>
  !product.price || product.productType === "quote-only" || product.productType === "discontinued";

// ── Manual USD price (staff override) ─────────────────────────────────────────
// `usdPrice` is the fixed USD a staff member sets for the BASE unit (GST-inclusive,
// as international visitors see it). When set, every USD figure for that product —
// headline, MRP, bulk tiers, cart, checkout — scales PROPORTIONALLY from it, so the
// whole flow stays internally consistent. When unset, USD auto-converts at the live
// rate (handled by the currency provider). All charges remain in INR regardless.

/**
 * USD figure for a GST-inclusive INR amount, scaled from the product's manual
 * USD price. Returns undefined when no manual price is set (⇒ auto-convert).
 */
export function usdFor(product: Product, inclGstInr: number): number | undefined {
  if (!product.usdPrice || product.usdPrice <= 0 || product.price <= 0) return undefined;
  const base = inclGST(product.price);
  if (base <= 0) return undefined;
  return Math.round(((inclGstInr * product.usdPrice) / base) * 100) / 100;
}

/** USD value of a cart line for a USD visitor: manual (proportional) else auto-convert. */
export function lineUsdValue(
  product: Product,
  effectiveUnitInr: number,
  qty: number,
  usdRate: number
): number {
  const inclTotal = inclGST(effectiveUnitInr) * qty;
  return usdFor(product, inclTotal) ?? inclTotal / usdRate;
}
