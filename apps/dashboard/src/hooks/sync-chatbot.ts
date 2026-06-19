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
 * Design (production-grade):
 *  - Full refresh inside a TRANSACTION (clear + insert atomically): a bot query
 *    always sees the complete old catalog or the complete new one — never empty,
 *    never half-synced — and there are no per-row unique-key collisions against
 *    stale rows, because the collection is cleared first within the same txn.
 *    Falls back to a non-atomic clear+insert only if transactions are unsupported
 *    (standalone Mongo); Atlas — prod and local dev — always supports them.
 *  - SKU-safe: the chatbot's `products.sku` carries a UNIQUE (sparse) index.
 *    Empty SKUs are omitted (sparse ignores missing fields) and genuine duplicate
 *    SKUs are de-duplicated (first wins, the rest sync without a SKU) with a
 *    warning — so a single catalog typo can never fail the whole sync.
 *  - Debounced + coalesced (like revalidate.ts) so the boot-time seed's burst of
 *    writes collapses into a single resync instead of dozens.
 *  - Fire-and-forget and fully guarded: a chatbot-DB hiccup never blocks or
 *    fails a CMS save, and a failed read never wipes the live catalog.
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

// A single chatbot-shaped product document (the bot's `products` collection).
type ChatbotProduct = {
  id: string;
  title: string;
  brand: string;
  tagline?: string;
  subcategory?: string;
  marketing_description: string;
  variants: string[];
  category: string;
  key_features: string[];
  description: string;
  common_uses: string[];
  specifications?: string;
  sku?: string;
  price: string;
  product_purchase_link: { platform: string; link: string }[];
  product_image_link?: string;
  createdAt: Date;
  updatedAt: Date;
};

// Minimal native-driver surface we use — avoids importing `mongodb` types (not a
// direct dependency of this app) while still typing the calls we make.
type RawSession = {
  withTransaction(fn: () => Promise<unknown>): Promise<unknown>;
  endSession(): Promise<void>;
};
type RawCollection = {
  deleteMany(filter: Record<string, unknown>, opts?: Record<string, unknown>): Promise<{ deletedCount?: number }>;
  insertMany(docs: unknown[], opts?: Record<string, unknown>): Promise<{ insertedCount?: number }>;
};
type RawClient = {
  startSession(): RawSession;
  db(name?: string): { collection(name: string): RawCollection };
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

/** Drop keys whose value is undefined so optional fields (e.g. an empty SKU) are
 *  OMITTED, not written as null — which keeps the sparse unique SKU index happy. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

function mapProduct(p: CmsProduct, now: Date): ChatbotProduct {
  const catName = (p.category && typeof p.category === "object" ? p.category.name : "") || "";
  const slug = p.slug || String(p.id);
  const doc: ChatbotProduct = {
    id: slug,
    title: p.name,
    brand: p.brand || "METNMAT",
    tagline: p.shortDesc ? p.shortDesc.split(".")[0].slice(0, 140) : undefined,
    subcategory: catName || undefined,
    marketing_description: p.shortDesc || "",
    variants: (p.sizes || []).map((s) => s.label).filter((l): l is string => Boolean(l)),
    category: mapCategory(catName),
    key_features: (p.specs || []).slice(0, 6).map((s) => `${s.label}: ${s.value}`),
    description: p.shortDesc || p.name,
    common_uses: [],
    specifications: specsStr(p.specs) || undefined,
    sku: (p.sku && String(p.sku).trim()) || undefined,
    price: priceStr(p.price, p.unit),
    product_purchase_link: [{ platform: "Metnmat", link: `${SITE}/shop/p/${slug}` }],
    product_image_link: imageUrl(p),
    createdAt: now,
    updatedAt: now,
  };
  return stripUndefined(doc as unknown as Record<string, unknown>) as unknown as ChatbotProduct;
}

function chatbotClient(payload: Payload): RawClient {
  // Reuse the live mongoose connection's pooled MongoClient to reach the chatbot
  // DB on the same Atlas cluster.
  const adapter = payload.db as unknown as MongooseAdapter;
  return adapter.connection.getClient() as unknown as RawClient;
}

/** Transactions need a replica set / mongos. Atlas always qualifies; a bare local
 *  mongod does not — detect that one case so we can fall back gracefully. */
function isTxnUnsupported(err: unknown): boolean {
  const e = err as { code?: number; codeName?: string; message?: string };
  return (
    e?.code === 20 ||
    e?.codeName === "IllegalOperation" ||
    /replica set|Transaction numbers are only allowed|Transactions are not supported/i.test(e?.message || "")
  );
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

  // Map, de-duplicating by id (slug) — last write wins if a slug somehow repeats.
  const byId = new Map<string, ChatbotProduct>();
  for (const p of docs) {
    const m = mapProduct(p, now);
    byId.set(m.id, m);
  }
  const mapped = [...byId.values()];

  // Guarantee SKUs are unique before writing (the chatbot's products.sku has a
  // UNIQUE sparse index). Keep the first occurrence; drop the SKU on later
  // duplicates so the product still syncs, and warn so staff can fix the catalog.
  const seenSku = new Set<string>();
  const dupes: string[] = [];
  for (const m of mapped) {
    if (!m.sku) continue;
    if (seenSku.has(m.sku)) {
      dupes.push(`${m.id} (sku ${m.sku})`);
      delete m.sku;
    } else {
      seenSku.add(m.sku);
    }
  }
  if (dupes.length) {
    payload.logger.warn(
      `[chatbot-sync] ${dupes.length} duplicate SKU(s) in catalog — kept first, dropped SKU on: ` +
        `${dupes.slice(0, 10).join(", ")}${dupes.length > 10 ? " …" : ""}`,
    );
  }

  const client = chatbotClient(payload);
  const col = client.db(CHATBOT_DB).collection("products");

  // Atomic full refresh: clear + insert in one transaction. External readers
  // (the bot) only ever see the complete old or complete new catalog, and there
  // are no unique-key collisions against stale rows (collection cleared first).
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await col.deleteMany({}, { session });
      await col.insertMany(mapped, { session, ordered: false });
    });
  } catch (err) {
    if (isTxnUnsupported(err)) {
      // Standalone Mongo (no replica set): best-effort non-atomic refresh.
      await col.deleteMany({});
      await col.insertMany(mapped, { ordered: false });
    } else {
      throw err;
    }
  } finally {
    await session.endSession();
  }

  payload.logger.info(`[chatbot-sync] synced ${mapped.length} products → '${CHATBOT_DB}.products'`);
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
    // Concise: never dump the whole bulk payload (the old behaviour flooded logs
    // with thousands of lines). One line with the cause is enough to diagnose.
    const e = err as { message?: string };
    payload.logger.error(`[chatbot-sync] catalog resync failed: ${e?.message || String(err)}`);
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
