import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Payload,
} from "payload";
import type { MongooseAdapter } from "@payloadcms/db-mongodb";

/**
 * Zero-drift chatbot catalog sync.
 *
 * The customer-facing chatbot answers from its OWN MongoDB database (`metnmat`)
 * — a different DB from the CMS (`metnmat_cms`), but on the SAME Atlas cluster
 * and reachable with the SAME user the mongoose adapter already holds open. So
 * instead of running deploy/sync-catalog-from-cms.mjs by hand after every CMS
 * edit, this hook re-syncs the chatbot's `products` collection automatically
 * whenever a Product (or Category) changes.
 *
 * It reproduces the exact mapping from deploy/sync-catalog-from-cms.mjs: the bot
 * retrieves via regex on title/sku/subcategory/category/description and filters
 * by a 5-value `category` enum, so the CMS fields are flattened into that shape.
 *
 * Design:
 *  - Full re-sync (not per-doc): publish / unpublish / delete / category-rename
 *    all converge to a consistent catalog from one code path. The catalog is
 *    tiny (~68 products) so a full pass is cheap.
 *  - Debounced + coalesced (like revalidate.ts) so the boot-time seed's burst of
 *    writes collapses into a single resync instead of dozens.
 *  - Fire-and-forget and fully guarded: a chatbot-DB hiccup never blocks or
 *    fails a CMS save.
 *  - Reuses the adapter's pooled MongoClient — no new dependency, no extra Atlas
 *    connection. Targets the `metnmat` DB on the shared cluster.
 */

// www.metnmat.com — base for product purchase links (same env the rest of the app uses).
const SITE = (process.env.WEBSITE_URL || "https://www.metnmat.com").replace(/\/+$/, "");
// admin.metnmat.com — turns relative `/api/media/file/...` image paths into absolute URLs.
// Empty locally → images are omitted rather than emitted as broken relative links.
const CMS = (process.env.CMS_URL || "").replace(/\/+$/, "");
// The chatbot's database name on the shared Atlas cluster.
const CHATBOT_DB = process.env.CHATBOT_DB_NAME || "metnmat";

const DEBOUNCE_MS = 1500;

type CmsSpec = { label?: string | null; value?: string | null };
type CmsSize = { label?: string | null };
type CmsMedia = { url?: string | null; filename?: string | null };
type CmsProduct = {
  id: string | number;
  slug?: string | null;
  name: string;
  brand?: string | null;
  shortDesc?: string | null;
  sku?: string | null;
  price?: number | null;
  unit?: string | null;
  category?: { name?: string | null } | string | number | null;
  sizes?: CmsSize[] | null;
  specs?: CmsSpec[] | null;
  images?: { image?: CmsMedia | string | number | null }[] | null;
};

// Minimal native-driver surface we use — avoids importing `mongodb` types (not a
// direct dependency of this app) while still typing the calls we make.
type RawCollection = {
  bulkWrite(ops: unknown[], opts?: { ordered?: boolean }): Promise<unknown>;
  deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount?: number }>;
};

// Map a granular CMS category name → the chatbot's 5-value top-level enum.
// (Mirrors deploy/sync-catalog-from-cms.mjs exactly.)
function mapCategory(name: string): string {
  const s = (name || "").toLowerCase();
  if (/electrode/.test(s)) return "electrodes";
  if (/membrane|nafion|\bpem\b|\baem\b|\bcem\b|\bbpm\b|ionomer/.test(s)) return "membranes";
  if (/reactor|cell|electroly|stack|fuel|photo|battery/.test(s)) return "reactor_and_cell";
  if (/pump|equipment|fabricat|\bmea\b|press|instrument|machine|system/.test(s)) return "equipments";
  return "accessories";
}

const priceStr = (p?: number | null, unit?: string | null): string =>
  typeof p === "number" && p > 0
    ? `₹${p.toLocaleString("en-IN")}${unit ? ` / ${unit}` : ""}`
    : "Request a quote";

const specsStr = (specs?: CmsSpec[] | null): string =>
  (specs || []).map((s) => `${s.label}: ${s.value}`).join("; ");

function imageUrl(p: CmsProduct): string | undefined {
  const img = p.images?.[0]?.image;
  if (!img || typeof img !== "object") return undefined;
  if (img.url) return img.url.startsWith("http") ? img.url : CMS ? CMS + img.url : undefined;
  if (img.filename) return CMS ? `${CMS}/api/media/file/${encodeURIComponent(img.filename)}` : undefined;
  return undefined;
}

function mapProduct(p: CmsProduct, now: Date) {
  const catName = (p.category && typeof p.category === "object" ? p.category.name : "") || "";
  const slug = p.slug || String(p.id);
  return {
    id: slug,
    title: p.name,
    brand: p.brand || "METNMAT",
    tagline: p.shortDesc ? p.shortDesc.split(".")[0].slice(0, 140) : undefined,
    subcategory: catName,
    marketing_description: p.shortDesc || "",
    variants: (p.sizes || []).map((s) => s.label).filter(Boolean),
    category: mapCategory(catName),
    key_features: (p.specs || []).slice(0, 6).map((s) => `${s.label}: ${s.value}`),
    description: p.shortDesc || p.name,
    common_uses: [] as string[],
    specifications: specsStr(p.specs),
    sku: p.sku || undefined,
    price: priceStr(p.price, p.unit),
    body_material: undefined as string | undefined,
    product_includes: undefined as string | undefined,
    product_purchase_link: [{ platform: "Metnmat", link: `${SITE}/shop/p/${slug}` }],
    product_image_link: imageUrl(p),
    createdAt: now,
    updatedAt: now,
  };
}

function chatbotProducts(payload: Payload): RawCollection {
  // Reuse the live mongoose connection's pooled MongoClient to reach the chatbot
  // DB on the same Atlas cluster.
  const adapter = payload.db as unknown as MongooseAdapter;
  return adapter.connection
    .getClient()
    .db(CHATBOT_DB)
    .collection("products") as unknown as RawCollection;
}

async function resyncOnce(payload: Payload): Promise<void> {
  const result = await payload.find({
    collection: "products",
    depth: 2,
    pagination: false,
    overrideAccess: true,
    where: { _status: { equals: "published" } },
  });
  const docs = result.docs as unknown as CmsProduct[];

  // Never wipe the live catalog on an empty/failed read.
  if (docs.length === 0) {
    payload.logger.warn(
      "[chatbot-sync] 0 published products found — skipping resync to avoid wiping the chatbot catalog",
    );
    return;
  }

  const now = new Date();
  const mapped = docs.map((p) => mapProduct(p, now));
  const ids = mapped.map((m) => m.id);
  const col = chatbotProducts(payload);

  // Upsert every current product, then drop any chatbot doc no longer in the CMS.
  // (Upsert-then-prune, not deleteMany-then-insert, so the collection is never
  // momentarily empty for a bot query mid-sync.)
  await col.bulkWrite(
    mapped.map((m) => ({ replaceOne: { filter: { id: m.id }, replacement: m, upsert: true } })),
    { ordered: false },
  );
  const del = await col.deleteMany({ id: { $nin: ids } });

  payload.logger.info(
    `[chatbot-sync] synced ${mapped.length} products → '${CHATBOT_DB}.products' (removed ${del.deletedCount ?? 0} stale)`,
  );
}

// Debounce/coalesce so a burst of saves (e.g. the boot-time seed) triggers one
// resync, and a change that lands mid-run guarantees exactly one more pass.
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let queued = false;

async function runResync(payload: Payload): Promise<void> {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  try {
    do {
      queued = false;
      await resyncOnce(payload);
    } while (queued);
  } catch (err) {
    payload.logger.error({ err }, "[chatbot-sync] catalog resync failed");
  } finally {
    running = false;
  }
}

function scheduleResync(payload: Payload): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void runResync(payload);
  }, DEBOUNCE_MS);
}

export const syncChatbotAfterChange: CollectionAfterChangeHook = ({ req, doc }) => {
  scheduleResync(req.payload);
  return doc;
};

export const syncChatbotAfterDelete: CollectionAfterDeleteHook = ({ req, doc }) => {
  scheduleResync(req.payload);
  return doc;
};
