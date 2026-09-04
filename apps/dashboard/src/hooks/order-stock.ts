import type { CollectionAfterChangeHook } from "payload";
import { recordStockMovement } from "../lib/stock";
import { stockMovementForTransition } from "../lib/stock-math";

/**
 * Stock follows the order.
 *
 * Until this hook existed nothing in either application ever moved inventory: a
 * paid order decremented nothing, a cancellation restored nothing, and
 * `stock-ledger` — a correct append-only ledger — had no writer at all. The shop
 * could oversell without limit and leave no trace of having done so.
 *
 * Two transitions matter:
 *   → paid                        take the goods out of stock
 *   paid/shipped/delivered → cancelled | refunded    put them back
 *
 * IDEMPOTENCY. Razorpay redelivers webhooks, and staff re-save orders. The
 * ledger is itself the record of whether stock has already been applied, so the
 * guard needs no new field: before moving anything, look for a movement of the
 * same kind already booked against this order. That is exact, survives restarts,
 * and cannot drift from the thing it is protecting.
 *
 * THIS HOOK NEVER THROWS. An order must not fail to be marked paid because
 * inventory bookkeeping had a problem — the payment is the fact, the stock
 * number is the bookkeeping. Failures are logged loudly instead, the same way
 * the audit hook treats a failed audit write.
 *
 * BUT A LOG LINE IS NOT A REPORT. A line that fails to move stock means the
 * customer was charged for goods the count still shows on the shelf, and this
 * hook usually runs from a webhook at an hour when nobody is reading process
 * output. Every unmoved line therefore also lands in `integration-logs`, which
 * is where the Razorpay webhook already records "the customer HAS been charged,
 * a human must reconcile".
 */

type OrderItem = {
  slug?: string | null;
  sku?: string | null;
  productName?: string | null;
  qty?: number | null;
};

type OrderDoc = {
  id?: string | number;
  status?: string | null;
  orderNumber?: string | null;
  items?: OrderItem[] | null;
  /** Payload timestamp. Used to tell a REUSED slug from an ordinary product edit. */
  createdAt?: string | null;
};

/** Has a movement of this kind already been booked against this order? */
async function alreadyApplied(
  payload: { find: (args: never) => Promise<{ totalDocs: number }> },
  orderId: string,
  movementType: "stock-out" | "returned"
): Promise<boolean> {
  const res = await payload.find({
    collection: "stock-ledger",
    where: { and: [{ relatedOrder: { equals: orderId } }, { movementType: { equals: movementType } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as never);
  return res.totalDocs > 0;
}

/** What an order line resolved to, or why it could not be resolved. */
export type LineResolution =
  | { ok: true; productId: string; via: "slug" | "redirect" | "sku" }
  | { ok: false; reason: "no-identifier" | "not-found" | "ambiguous-sku" | "conflict" };

/** The narrow slice of the local API this file needs, so a test can stand one up. */
type PayloadLike = {
  find: (args: never) => Promise<{ docs?: unknown[] }>;
  create: (args: never) => Promise<unknown>;
  collections?: Record<string, unknown>;
};

/**
 * The old-slug -> product table a rename leaves behind, named in ONE place
 * because it is a contract with whichever collection writes it. The lookup is
 * skipped entirely when that collection is not registered, so this hook is
 * correct whether or not the redirect work has shipped — it simply has one
 * fewer way to identify a line.
 */
export const SLUG_REDIRECTS = {
  collection: "product-slug-redirects",
  oldSlugField: "oldSlug",
  productField: "product",
} as const;

/** A relationship arrives as an id at depth 0 and as a document above it. */
function relationId(value: unknown): string | null {
  const raw = value && typeof value === "object" ? (value as { id?: unknown }).id : value;
  if (raw === null || raw === undefined || raw === "") return null;
  return String(raw);
}

/**
 * Resolve an order line to the product it was bought from.
 *
 * WHY THIS IS NOT JUST A SLUG LOOKUP. Order lines snapshot the product instead
 * of holding a relationship, deliberately, so order history survives a product
 * being retired — see Orders.ts and hooks/product-guards.ts. That decision is
 * untouched here. What was wrong is that the snapshot was read as though a slug
 * were a permanent identifier. It is not: staff may edit it, and the storefront
 * URL changing is the entire reason blog articles keep a redirect table. Rename
 * a slug while an order sits pending and the paid-webhook lookup found nothing —
 * the customer was charged, stock never moved, one log line was the only trace.
 *
 * Three identifiers, strongest first:
 *   1. the slug, if it still names a product AND the SKU snapshot does not
 *      contradict it;
 *   2. the redirect table, a system-written statement that this old slug became
 *      that product;
 *   3. the SKU snapshot, and only when it names exactly one product.
 *
 * WHY THE CONTRADICTION CHECK. Slugs are unique, so a rename FREES the old one
 * and a later product can take it. That lookup succeeds and points at the wrong
 * shelf, and the ledger row it would write is append-only — correctable only by
 * a compensating movement. lib/stock-math.ts already states the rule this
 * follows: refusing is better than recording an impossible position.
 *
 * WHY THE SKU FALLBACK EARNS ITS PLACE even once a redirect table exists: a slug
 * renamed BEFORE that table existed leaves no row behind, and the SKU snapshot
 * is then the only surviving link between the line and the shelf.
 */
export async function resolveOrderLineProduct(
  payload: PayloadLike,
  line: { slug?: string | null; sku?: string | null },
  /**
   * When the ORDER was placed. Used to tell a reused slug from an ordinary
   * edit: a product created after the order cannot be the one that was bought.
   * Optional — without it the slug match is simply trusted, which is the
   * behaviour before this hook learned about renames at all.
   */
  orderPlacedAt?: string | Date | null,
): Promise<LineResolution> {
  const slug = (line.slug ?? "").trim();
  const sku = (line.sku ?? "").trim();
  if (!slug && !sku) return { ok: false, reason: "no-identifier" };

  let contradicted = false;

  if (slug) {
    const bySlug = await payload.find({
      collection: "products",
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as never);
    const hit = bySlug?.docs?.[0] as
      | { id?: string | number; sku?: string | null; createdAt?: string | null }
      | undefined;
    if (hit?.id) {
      /*
       * A slug hit is the right product UNLESS the slug has been reused — and
       * reuse is provable, not guessable: the matched product cannot be the one
       * that was bought if it did not exist when the order was placed.
       *
       * NOT a SKU comparison. A staff member fixing a SKU typo leaves every
       * pending line carrying the old SKU and the current slug; treating that
       * as a conflict refuses to move stock on a paid order for the most
       * routine edit there is. The dates are exact where the SKUs are only
       * suggestive.
       */
      const placed = orderPlacedAt ? new Date(orderPlacedAt).getTime() : NaN;
      const created = hit.createdAt ? new Date(hit.createdAt).getTime() : NaN;
      const createdAfterOrder =
        Number.isFinite(placed) && Number.isFinite(created) && created > placed;
      if (!createdAfterOrder) {
        return { ok: true, productId: String(hit.id), via: "slug" };
      }
      contradicted = true;
    }
  }

  if (slug && payload.collections?.[SLUG_REDIRECTS.collection]) {
    try {
      const redirected = await payload.find({
        collection: SLUG_REDIRECTS.collection,
        where: { [SLUG_REDIRECTS.oldSlugField]: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      } as never);
      const row = redirected?.docs?.[0] as Record<string, unknown> | undefined;
      const productId = row ? relationId(row[SLUG_REDIRECTS.productField]) : null;
      if (productId) return { ok: true, productId, via: "redirect" };
    } catch {
      // The table is an aid, never a dependency: a change in its shape must not
      // stop stock moving for every other line in the order.
    }
  }

  if (sku) {
    // `sku` is free text on Products — not unique, not indexed. Two matches is a
    // guess, and a guess writes a permanent ledger row against a shelf nobody
    // sold from. `limit: 2` is only enough to tell one from more-than-one.
    const bySku = await payload.find({
      collection: "products",
      where: { sku: { equals: sku } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    } as never);
    const docs = (bySku?.docs ?? []) as { id?: string | number }[];
    if (docs.length > 1) return { ok: false, reason: "ambiguous-sku" };
    if (docs.length === 1 && docs[0]?.id) return { ok: true, productId: String(docs[0].id), via: "sku" };
  }

  return { ok: false, reason: contradicted ? "conflict" : "not-found" };
}

/** Why a line did not move, phrased for the person who has to fix it. */
const UNMOVED_REASON: Record<Extract<LineResolution, { ok: false }>["reason"], string> = {
  "no-identifier": "the line carries neither a product slug nor a SKU",
  "not-found":
    "nothing in the catalogue matches its slug or its SKU — renamed before redirects were kept, or removed",
  "ambiguous-sku": "its SKU matches more than one product, so which product to take from would be a guess",
  conflict:
    "its slug now belongs to a DIFFERENT product (the SKU on the line disagrees), so moving stock would take from the wrong shelf",
};

/** Which products this order has actually taken stock out for. */
async function productsTakenForOrder(payload: PayloadLike, orderId: string): Promise<Set<string>> {
  const res = await payload.find({
    collection: "stock-ledger",
    where: { and: [{ relatedOrder: { equals: orderId } }, { movementType: { equals: "stock-out" } }] },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  } as never);
  const ids = new Set<string>();
  for (const row of (res?.docs ?? []) as { product?: unknown }[]) {
    const id = relationId(row?.product);
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Make unmoved lines visible to a human.
 *
 * One row per order, not per line. `integration-logs` is where the Razorpay
 * webhook already records this exact class of event, it is admin-visible under
 * Administration, and its access is untouched — the row is written with
 * `overrideAccess` the same way lib/stock.ts writes the ledger.
 *
 * `req` is deliberately NOT passed. The order write may be inside a transaction,
 * and joining it would let the only trace of the problem be rolled back
 * alongside the write that caused it.
 */
async function reportUnmovedLines(
  payload: PayloadLike & { logger: { error: (o: unknown, m: string) => void } },
  order: OrderDoc,
  orderId: string,
  movementType: "stock-out" | "returned",
  unmoved: string[],
): Promise<void> {
  if (unmoved.length === 0) return;
  const label = order.orderNumber ?? orderId;
  try {
    await payload.create({
      collection: "integration-logs",
      overrideAccess: true,
      data: {
        integration: "order-stock",
        status: "error",
        summary: `Order ${label}: ${unmoved.length} line${unmoved.length === 1 ? "" : "s"} did not move stock (${movementType})`,
        error: [
          `Stock was NOT ${movementType === "stock-out" ? "taken out for" : "returned for"} order ${label}:`,
          ...unmoved.map((line) => `  - ${line}`),
          "",
          "The order and the payment are unaffected. Correct each count from the Stock panel on the product, which records the movement in the ledger with an author and a reason.",
        ].join("\n"),
        payload: { orderNumber: order.orderNumber ?? null, orderId, movementType, lines: unmoved },
      },
    } as never);
  } catch (err) {
    payload.logger.error(
      { err, orderNumber: order.orderNumber },
      "[stock] could not record the unmoved-lines report",
    );
  }
}

export const orderStockAfterChange: CollectionAfterChangeHook = async ({
  req,
  doc,
  previousDoc,
  operation,
}) => {
  const payload = req.payload;
  const order = doc as OrderDoc;
  const before = (previousDoc ?? {}) as OrderDoc;

  try {
    const from = String(before.status ?? "");
    const to = String(order.status ?? "");
    // A create can arrive already paid (staff entering a phone order); an update
    // only matters when the status actually moved.
    if (operation === "update" && from === to) return doc;

    const movementType = stockMovementForTransition(from, to);
    if (!movementType) return doc;

    const orderId = String(order.id ?? "");
    if (!orderId) return doc;

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) return doc;

    if (await alreadyApplied(payload as never, orderId, movementType)) {
      payload.logger.info(
        { orderNumber: order.orderNumber, movementType },
        "[stock] already applied for this order — skipping",
      );
      return doc;
    }

    const reason =
      movementType === "stock-out"
        ? `Order ${order.orderNumber ?? orderId} ${to}`
        : `Order ${order.orderNumber ?? orderId} ${to} — stock returned`;

    // Lines that did not move, collected so ONE report goes out per order
    // rather than one per line.
    const unmoved: string[] = [];

    // A return may only hand back what this order actually took. A line that
    // never resolved on the way out booked no stock-out, so "restoring" it would
    // invent stock that never left the shelf — the same silent corruption in the
    // opposite direction. Orders paid before this hook existed have no rows at
    // all, and are correctly returned nothing.
    //
    // Per-product is safe HERE in a way the idempotency guard is not: two lines
    // of the same product in different sizes resolve to the same id, so they
    // pass or fail together.
    const taken =
      movementType === "returned" ? await productsTakenForOrder(payload as never, orderId) : null;

    for (const item of items) {
      const qty = Number(item?.qty);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      // Line items snapshot the product rather than holding a relationship, so
      // resolve it — by slug, by the redirect a rename left behind, or by the
      // SKU the line also carries. At most two lookups per line, and an order
      // has a handful of lines; this is not an N+1 across a list.
      const resolved = await resolveOrderLineProduct(payload as never, item ?? {}, order.createdAt);
      if (!resolved.ok) {
        payload.logger.error(
          {
            orderNumber: order.orderNumber,
            productName: item?.productName,
            slug: item?.slug,
            sku: item?.sku,
            qty,
            movementType,
            reason: resolved.reason,
          },
          "[stock] could not resolve an order line to a product — stock NOT moved",
        );
        unmoved.push(
          `${item?.productName ?? "(unnamed line)"} x${qty} — ${UNMOVED_REASON[resolved.reason]}`,
        );
        continue;
      }

      if (taken && !taken.has(resolved.productId)) {
        // Not a failure: nothing was ever taken out for this line, so there is
        // nothing to hand back.
        payload.logger.warn(
          { orderNumber: order.orderNumber, productName: item?.productName, qty },
          "[stock] no stock was ever taken out for this line — not returning it",
        );
        continue;
      }

      const result = await recordStockMovement(
        payload,
        {
          productId: resolved.productId,
          movementType,
          quantity: qty,
          reason,
          relatedOrder: orderId,
          ...(req.user?.id ? { userId: String(req.user.id) } : {}),
        },
        req,
      );

      if (!result.ok) {
        // Refusing is the correct outcome for an oversell — the order still
        // stands, but somebody has to reconcile the shelf. Make that loud, and
        // durable: it is the same sentence as an unresolved line.
        payload.logger.error(
          {
            orderNumber: order.orderNumber,
            productName: item?.productName,
            slug: item?.slug,
            qty,
            movementType,
            reason: result.error,
          },
          "[stock] movement refused for order line — inventory needs reconciling",
        );
        unmoved.push(`${item?.productName ?? "(unnamed line)"} x${qty} — ${result.error}`);
      }
    }

    await reportUnmovedLines(payload as never, order, orderId, movementType, unmoved);
  } catch (err) {
    payload.logger.error(
      { err, orderNumber: (doc as OrderDoc)?.orderNumber },
      "[stock] failed to apply stock movements for order",
    );
  }

  return doc;
};
