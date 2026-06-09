import type { Payload } from "payload";
import { seedCategories, seedProducts } from "./catalog-data";

// Real METNMAT electrochemistry catalog (phase 1), generated from
// Product_data_sheet.xlsx into ./catalog-data.ts. Seeded on boot; idempotent.
// On boot it also PRUNES any product/category that is no longer in the catalog
// (so the old placeholder catalog is replaced cleanly).

async function cleanupMalformed(payload: Payload): Promise<void> {
  try {
    const res = await payload.delete({
      collection: "products",
      where: { or: [{ slug: { equals: "" } }, { slug: { exists: false } }] },
    });
    const removed = (res as { docs?: unknown[] })?.docs?.length ?? 0;
    if (removed) payload.logger.info(`[seed] Removed ${removed} malformed product(s).`);
  } catch {
    /* ignore */
  }
}

async function ensureCategory(
  payload: Payload,
  c: { slug: string; name: string; blurb?: string; parentSlug?: string; order?: number },
  ids: Record<string, string | number>
): Promise<void> {
  const parent = c.parentSlug ? ids[c.parentSlug] : undefined;
  const found = await payload.find({ collection: "categories", where: { slug: { equals: c.slug } }, limit: 1 });
  if (found.docs[0]) {
    ids[c.slug] = found.docs[0].id;
    await payload.update({
      collection: "categories",
      id: found.docs[0].id,
      data: { name: c.name, blurb: c.blurb, order: c.order ?? 0, parent },
    });
    return;
  }
  const doc = await payload.create({
    collection: "categories",
    data: { name: c.name, slug: c.slug, blurb: c.blurb, order: c.order ?? 0, parent },
  });
  ids[c.slug] = doc.id;
}

/** Delete docs in a collection whose slug is NOT in the keep-set. */
async function pruneStale(
  payload: Payload,
  collection: "products" | "categories",
  keep: Set<string>
): Promise<void> {
  try {
    const all = await payload.find({ collection, limit: 1000, depth: 0 });
    for (const doc of all.docs as Array<{ id: string | number; slug?: string }>) {
      if (!doc.slug || !keep.has(doc.slug)) {
        await payload.delete({ collection, id: doc.id });
      }
    }
  } catch (e) {
    payload.logger.warn(`[seed] prune ${collection} failed: ${(e as Error).message}`);
  }
}

export async function seed(payload: Payload): Promise<void> {
  await cleanupMalformed(payload);

  const catSlugs = new Set(seedCategories.map((c) => c.slug));
  const prodSlugs = new Set(seedProducts.map((p) => p.slug));

  // 1) Remove placeholder/stale products first (they reference categories).
  await pruneStale(payload, "products", prodSlugs);

  // 2) Upsert categories (parents before children so parent ids resolve).
  const ids: Record<string, string | number> = {};
  for (const c of seedCategories.filter((c) => !c.parentSlug)) await ensureCategory(payload, c, ids);
  for (const c of seedCategories.filter((c) => c.parentSlug)) await ensureCategory(payload, c, ids);

  // 3) Remove stale categories (now that no products reference them).
  await pruneStale(payload, "categories", catSlugs);

  // 4) Upsert catalog products — update existing by slug (so new SKUs/specs/
  //    descriptions sync), create missing. Existing images are preserved
  //    because the `images` field is not included in the update payload.
  let created = 0;
  let updated = 0;
  for (const p of seedProducts) {
    const categoryId = ids[p.categorySlug];
    if (!categoryId) {
      payload.logger.warn(`[seed] product ${p.slug} has unknown category ${p.categorySlug} — skipped.`);
      continue;
    }
    const data = {
      name: p.name, slug: p.slug, brand: p.brand, sku: p.sku, category: categoryId,
      price: p.price, mrp: p.mrp, unit: p.unit, moq: p.moq,
      inStock: p.inStock, featured: p.featured, badges: p.badges ?? [], priceTiers: p.priceTiers ?? [],
      sizes: (p.sizes ?? []).map((label) => ({ label })),
      specs: p.specs, shortDesc: p.shortDesc, _status: "published" as const,
    };
    const found = await payload.find({ collection: "products", where: { slug: { equals: p.slug } }, limit: 1 });
    if (found.docs[0]) {
      await payload.update({ collection: "products", id: found.docs[0].id, data });
      updated++;
    } else {
      await payload.create({ collection: "products", data });
      created++;
    }
  }
  payload.logger.info(`[seed] Products: ${created} created, ${updated} updated.`);

  await payload.updateGlobal({ slug: "company", data: { name: "METNMAT", legalName: "METNMAT Research & Innovations", tagline: "India's first private Metallurgy & Materials R&D", description: "METNMAT supplies electrochemistry lab equipment — electrodes, membranes, cells, reactors, equipment and accessories — and turnkey materials R&D from prototype to industrial scale.", foundedYear: 2018 } });
  await payload.updateGlobal({ slug: "contact", data: { email: "contact@metnmat.com", phone: "+91 78726 86501", whatsapp: "+91 78726 86501", shippingNote: "Shipping across India & worldwide · ISO-aligned R&D", addresses: [{ label: "West Bengal", line: "Howrah, West Bengal, India" }, { label: "Odisha", line: "Sambalpur, Odisha, India" }] } });
  await payload.updateGlobal({ slug: "social", data: { linkedin: "#", youtube: "#", facebook: "#" } });
  await payload.updateGlobal({ slug: "seo", data: { defaultTitle: "METNMAT Research & Innovations", titleTemplate: "%s · METNMAT", description: "Electrodes, membranes, electrochemical cells, reactors & lab equipment for research — plus turnkey materials R&D." } });

  payload.logger.info(`[seed] Done. ${prodSlugs.size} catalog products, ${catSlugs.size} categories.`);
}
