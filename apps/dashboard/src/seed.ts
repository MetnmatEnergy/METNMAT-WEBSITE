import path from "path";
import { existsSync } from "fs";
import type { Payload } from "payload";
import { decideDirectorPinWrite, directorPinForced } from "./lib/director-pin";
import { derivePinLookup } from "./lib/pin";
import { seedCategories, seedProducts, type SeedCategory } from "./catalog-data";
import {
  seedServices,
  seedProjects,
  seedPosts,
  seedFaqs,
  seedHomepage,
  seedNavigation,
  seedBlogCategories,
  seedBlogContentTypes,
  dummyPostSlugs,
  dummyProjectSlugs,
} from "./content-data";
import { plainTextToLexical } from "./lib/blog";
import { istYear2, formatUserCode, bumpCounter, countersModel, userCodeCounterKey } from "./hooks/customer-code";

// Real METNMAT electrochemistry catalog (phase 1), generated from
// Product_data_sheet.xlsx into ./catalog-data.ts. Seeded on boot; idempotent.
// On boot it also PRUNES any product/category that is no longer in the catalog
// (so the old placeholder catalog is replaced cleanly).

/**
 * THE canonical storefront departments — the top-level categories, in order,
 * exactly as specified in the company's "Product Categories" document.
 *
 * This list is the source of truth for department name/blurb/order and OVERRIDES
 * any top-level entry of the same slug in the auto-generated catalog-data.ts, so
 * regenerating that file from the product sheet can neither rename a department
 * nor drop one. Sub-categories still come from catalog-data.
 *
 * ensureCategory upserts on boot, so editing a name/blurb here changes it
 * site-wide on the next deploy. Slugs are the public URL (/shop/c/<slug>) —
 * changing one breaks inbound links and search rankings, so rename the `name`
 * and leave the `slug` alone. Staff can still add further categories in the
 * admin; nothing here deletes them (pruning stays opt-in).
 */
const SHOP_DEPARTMENTS: SeedCategory[] = [
  { slug: "electrodes", name: "Electrodes", blurb: "Working, reference, and counter electrodes for electrochemistry", order: 1 },
  { slug: "electrode-holders", name: "Electrode Holders & Accessories", blurb: "Electrode holders, sample holders, polishing kits, and accessories", order: 2 },
  { slug: "membranes", name: "Membranes", blurb: "Proton, anion, cation, and bipolar exchange membranes, ionomers", order: 3 },
  { slug: "reactor-cell", name: "Reactors & Cells", blurb: "Water-splitting, CO₂ electrolysis, photoelectrochemical (PEC), fuel cell, and battery reactors", order: 4 },
  { slug: "battery-components", name: "Battery & Cell Components", blurb: "Coin cell and cylindrical cell components, separators, pouch films, and related parts", order: 5 },
  { slug: "carbon-gdl", name: "Carbon Materials & Gas Diffusion Layers (GDL)", blurb: "Gas diffusion layers, carbon paper, carbon cloth, carbon felt, and carbon powders", order: 6 },
  { slug: "raw-materials", name: "Raw Materials & Alloys", blurb: "Metal foams, felts, foils, meshes, sheets, plates, alloys, and raw materials", order: 7 },
  { slug: "peristaltic-pumps", name: "Peristaltic Pumps", blurb: "Single and dual-channel laboratory peristaltic pumps for continuous electrolyte and reagent flow", order: 8 },
  { slug: "equipments", name: "Equipment & Accessories", blurb: "Presses, test benches, coating equipment, and laboratory accessories", order: 9 },
  { slug: "consumables", name: "Consumables", blurb: "Polishing materials, sealing products, gas-handling consumables, and specialty chemicals", order: 10 },
  // Retired in favour of Peristaltic Pumps, which took its slot at order 8. The
  // record and any future products are kept; it is simply off the storefront.
  { slug: "analysis", name: "Analysis Instruments", blurb: "Conductivity measurement systems and materials characterization instruments", order: 11, hidden: true },
];

const DEPARTMENT_SLUGS = new Set(SHOP_DEPARTMENTS.map((d) => d.slug));

/**
 * Departments that predate the category document and are no longer offered.
 * Retired on boot — but ONLY when empty, so a department that still holds
 * products (or sub-categories) is left alone and reported instead of silently
 * orphaning catalogue rows. Safe to re-run; safe to leave in place forever.
 */
const RETIRED_DEPARTMENTS = ["furnaces", "crucibles", "safety"] as const;

/**
 * Department banner images, versioned in the repo and attached on boot (same
 * pattern as project covers). Only fills a category that has NO image yet, so a
 * staff upload in the admin always wins and is never overwritten.
 */
/**
 * Department banner images.
 *
 * Filenames all end -cover so they cannot collide with the media rows left
 * behind by the GCS deployment. Those rows still exist and every one of them
 * 404s — the files were never copied — so reusing a media doc by its old name,
 * which is what this used to do, reattached a broken image and looked like a
 * success. A new name forces a real upload.
 */
const CATEGORY_IMAGES: { slug: string; asset: string; alt: string }[] = [
  { slug: "peristaltic-pumps", asset: "src/seed-assets/categories/peristaltic-pumps-cover.webp", alt: "Laboratory peristaltic pumps — benchtop dispensing and flow-rate models with touchscreen controllers, OEM pump heads and multi-channel cartridges — METNMAT peristaltic pumps" },
  { slug: "membranes", asset: "src/seed-assets/categories/membranes-cover.webp", alt: "Ion-exchange membrane sheets — proton, anion, cation and bipolar exchange membranes in a range of textures and reinforcements — METNMAT membranes" },
  { slug: "reactor-cell", asset: "src/seed-assets/categories/reactor-cell-cover.webp", alt: "Electrochemical reactors and cells — flow cells, zero-gap electrolysers and sealed test cells with compression hardware and fluid fittings — METNMAT reactors & cells" },
  { slug: "electrodes", asset: "src/seed-assets/categories/electrodes-cover.webp", alt: "Electrode shafts and bodies — threaded rotating-disc shafts, sleeves, porous frits and cell body tubes — METNMAT electrodes" },
  { slug: "electrode-holders", asset: "src/seed-assets/categories/electrode-holders-accessories-cover.webp", alt: "Electrode holders and cell accessories — glass cell bodies, PTFE cell tops, electrode stands and clamps, a reference-electrode rack, polishing discs and a polishing kit — METNMAT electrode holders & accessories" },
  { slug: "equipments", asset: "src/seed-assets/categories/equipments-cover.webp", alt: "Laboratory equipment and accessories — carbon and ceramic felts, metal foams and meshes, powders, filter holders, fittings, wash bottles and sample tubes — METNMAT equipment & accessories" },
  { slug: "carbon-gdl", asset: "src/seed-assets/categories/carbon-gdl-cover.webp", alt: "Carbon cloth, carbon paper, carbon felt and gas diffusion layer sheets and rolls with carbon powders and granules — METNMAT carbon materials & GDL" },
  { slug: "raw-materials", asset: "src/seed-assets/categories/raw-materials-cover.webp", alt: "High-purity metals and alloys — aluminium, nickel, titanium and zirconium granules, copper wire, powders, rods, sheets and ingots — METNMAT raw materials & alloys" },
  { slug: "battery-components", asset: "src/seed-assets/categories/battery-components-cover.webp", alt: "Cylindrical and coin cell cases, caps, gaskets, current-collector tabs, separators, pouch film and electrode powders — METNMAT battery & cell components" },
  { slug: "consumables", asset: "src/seed-assets/categories/consumables-cover.webp", alt: "Laboratory plasticware, tubes, petri dishes, pipette tips, fittings and tubing — METNMAT consumables" },
];

/**
 * Every seeded category: the canonical departments plus the sub-categories from
 * the product sheet. Departments win on slug collision (see SHOP_DEPARTMENTS).
 */
const ALL_SEED_CATEGORIES: SeedCategory[] = [
  ...SHOP_DEPARTMENTS,
  ...seedCategories.filter((c) => !DEPARTMENT_SLUGS.has(c.slug)),
];

/**
 * Attach the department banner images. Only fills a category with no image yet,
 * and reuses an already-uploaded Media row by filename rather than minting a new
 * one — so this is idempotent across retries, concurrent boots and redeploys,
 * and never leaves orphaned uploads in the bucket.
 */
async function ensureCategoryImages(payload: Payload): Promise<void> {
  for (const { slug, asset, alt } of CATEGORY_IMAGES) {
    try {
      const res = await payload.find({
        collection: "categories",
        where: { slug: { equals: slug } },
        limit: 1,
        // depth 1: the decision below needs the attached media FILENAME, which a
        // depth-0 read returns only as an id.
        depth: 1,
        overrideAccess: true,
      });
      const doc = res.docs[0] as
        | { id: string | number; image?: { filename?: string } | string | null }
        | undefined;
      if (!doc) continue;

      const filename = path.basename(asset);
      // Compare against the filename actually attached, not merely "is something
      // attached". The previous test skipped whenever ANY image was set, which
      // meant a category pointing at a file that no longer exists stayed broken
      // for exactly as long as the broken pointer survived — and after the GCS
      // move that was all of them.
      const currentFile =
        doc.image && typeof doc.image === "object" ? doc.image.filename : undefined;
      if (currentFile === filename) continue; // already the banner we ship
      const filePath = path.resolve(process.cwd(), asset);
      if (!existsSync(filePath)) {
        payload.logger.warn(`[seed] category banner asset missing: ${filePath}`);
        continue;
      }
      const existingMedia = await payload.find({
        collection: "media",
        where: { filename: { equals: filename } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const mediaId =
        (existingMedia.docs[0] as { id: string | number } | undefined)?.id ??
        (await payload.create({ collection: "media", filePath, data: { alt, category: "hero-banner" }, overrideAccess: true })).id;
      await payload.update({
        collection: "categories",
        id: doc.id,
        data: { image: mediaId },
        overrideAccess: true,
      });
      payload.logger.info(`[seed] categories: banner attached (${slug}).`);
    } catch (e) {
      payload.logger.warn(`[seed] category banner for ${slug} failed: ${(e as Error).message}`);
    }
  }
}

/**
 * Retire departments dropped from the category document — but only when they
 * hold no products and no sub-categories. A non-empty one is left in place and
 * logged, so retiring it stays a deliberate human decision in the admin rather
 * than a boot-time surprise that orphans catalogue rows.
 */
async function retireDepartments(payload: Payload): Promise<void> {
  for (const slug of RETIRED_DEPARTMENTS) {
    try {
      const found = await payload.find({
        collection: "categories",
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const doc = found.docs[0] as { id: string | number } | undefined;
      if (!doc) continue;

      const [products, children] = await Promise.all([
        payload.count({ collection: "products", where: { category: { equals: doc.id } }, overrideAccess: true }),
        payload.count({ collection: "categories", where: { parent: { equals: doc.id } }, overrideAccess: true }),
      ]);
      if (products.totalDocs > 0 || children.totalDocs > 0) {
        payload.logger.warn(
          `[seed] retired department '${slug}' still has ${products.totalDocs} product(s) and ${children.totalDocs} sub-category(ies) — left in place; move them, then delete it in the admin.`,
        );
        continue;
      }
      await payload.delete({ collection: "categories", id: doc.id, overrideAccess: true });
      payload.logger.info(`[seed] categories: retired empty department '${slug}'.`);
    } catch (e) {
      payload.logger.warn(`[seed] retiring ${slug} failed: ${(e as Error).message}`);
    }
  }
}

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
  // SeedCategory rather than a restatement of its fields: the inline copy had
  // already fallen behind it, which is how a new field silently stops being
  // written.
  c: SeedCategory,
  ids: Record<string, string>
): Promise<void> {
  const parent = c.parentSlug ? ids[c.parentSlug] : undefined;
  const found = await payload.find({ collection: "categories", where: { slug: { equals: c.slug } }, limit: 1 });
  if (found.docs[0]) {
    ids[c.slug] = String(found.docs[0].id);
    await payload.update({
      collection: "categories",
      id: found.docs[0].id,
      // null, not undefined. An undefined value is "field not supplied" and
      // leaves the existing parent in place, so promoting a sub-category to a
      // department would silently do nothing. null clears the relationship.
      // `hidden` is written only when the seed entry states one. Sending it
      // unconditionally would un-hide, on every boot, any department staff had
      // chosen to hide — the seed is authoritative for names and ordering, not
      // for a merchandising decision someone made in the admin.
      data: {
        name: c.name,
        blurb: c.blurb,
        order: c.order ?? 0,
        parent: parent ?? null,
        ...(c.hidden === undefined ? {} : { hidden: c.hidden }),
      },
    });
    return;
  }
  const doc = await payload.create({
    collection: "categories",
    data: { name: c.name, slug: c.slug, blurb: c.blurb, order: c.order ?? 0, parent, hidden: c.hidden === true },
  });
  ids[c.slug] = String(doc.id);
}

/**
 * Seed a global ONLY when it has never been populated — gated on one or more key
 * fields, seeding only when ALL of them are empty. Once staff (or the first
 * boot) set any gate field, later boots leave the whole global untouched, so
 * admin edits to company/contact/social/seo are never reverted. Passing several
 * fields (e.g. all social URLs) prevents clearing a single field from
 * re-seeding the rest.
 */
async function seedGlobalIfUnset(
  payload: Payload,
  slug: "company" | "contact" | "social" | "seo",
  keyFields: string[],
  data: Record<string, unknown>
): Promise<void> {
  try {
    const current = (await payload.findGlobal({ slug })) as Record<string, unknown> | null;
    const anySet = keyFields.some((f) => {
      const v = current?.[f];
      return v !== undefined && v !== null && v !== "";
    });
    if (!anySet) await payload.updateGlobal({ slug, data });
  } catch (e) {
    payload.logger.warn(`[seed] global ${slug} seed-if-unset failed: ${(e as Error).message}`);
  }
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

/**
 * Seed website CONTENT (services, projects, posts, faqs) + homepage/navigation
 * globals. Collections seed only when empty; globals seed only when unset — so
 * staff edits in the admin are never overwritten on reboot.
 */
async function seedContent(payload: Payload): Promise<void> {
  const seedIfEmpty = async (
    collection: "services" | "projects" | "posts" | "faqs",
    rows: Record<string, unknown>[]
  ): Promise<void> => {
    try {
      const { totalDocs } = await payload.count({ collection });
      if (totalDocs > 0) return;
      let i = 0;
      for (const row of rows) {
        await payload.create({
          collection,
          data: { ...row, order: i, active: true, _status: "published" },
        });
        i++;
      }
      payload.logger.info(`[seed] ${collection}: ${rows.length} created.`);
    } catch (e) {
      payload.logger.warn(`[seed] ${collection} failed: ${(e as Error).message}`);
    }
  };

  await seedIfEmpty("services", seedServices);

  // Additive top-up for services added to seedServices AFTER the initial seed
  // (i.e. when the collection is no longer empty). Creates only these specific
  // missing slugs — existing/edited docs are never touched, and the list is
  // scoped so a service staff deliberately delete won't reappear site-wide.
  const ensureServiceSlugs = [
    "materials-testing-characterization",
    "materials-processing-facilities",
  ];
  try {
    for (const slug of ensureServiceSlugs) {
      const row = seedServices.find((s) => s.slug === slug);
      if (!row) continue;
      const { totalDocs } = await payload.count({
        collection: "services",
        where: { slug: { equals: slug } },
      });
      if (totalDocs === 0) {
        await payload.create({
          collection: "services",
          data: { ...row, order: seedServices.indexOf(row), active: true, _status: "published" },
        });
        payload.logger.info(`[seed] services: + ${slug}`);
      }
    }
  } catch (e) {
    payload.logger.warn(`[seed] ensure services failed: ${(e as Error).message}`);
  }

  await seedIfEmpty("faqs", seedFaqs);

  // Blog taxonomy — seed only when empty (no drafts on these collections).
  // MUST run before ensureRealBlogArticles so articles can link categories.
  const seedPlain = async (
    collection: "blog-categories" | "blog-content-types",
    rows: Record<string, unknown>[],
  ): Promise<void> => {
    try {
      const { totalDocs } = await payload.count({ collection });
      if (totalDocs > 0) return;
      let i = 0;
      for (const row of rows) {
        await payload.create({
          collection,
          data: { ...row, displayOrder: i, isActive: true },
        });
        i++;
      }
      payload.logger.info(`[seed] ${collection}: ${rows.length} created.`);
    } catch (e) {
      payload.logger.warn(`[seed] ${collection} failed: ${(e as Error).message}`);
    }
  };
  await seedPlain("blog-categories", seedBlogCategories);
  await seedPlain("blog-content-types", seedBlogContentTypes);

  await ensureRealProjects(payload);
  await ensureRealBlogArticles(payload);

  // Homepage global — seed only if the hero hasn't been filled in yet.
  try {
    const hp = (await payload.findGlobal({ slug: "homepage" })) as { titleLead?: string };
    if (!hp?.titleLead) {
      await payload.updateGlobal({ slug: "homepage", data: seedHomepage });
      payload.logger.info("[seed] homepage global seeded.");
    }
  } catch (e) {
    payload.logger.warn(`[seed] homepage global failed: ${(e as Error).message}`);
  }

  // Navigation global — seed only if no header links exist yet.
  try {
    const nav = (await payload.findGlobal({ slug: "navigation" })) as { headerLinks?: unknown[] };
    if (!nav?.headerLinks?.length) {
      await payload.updateGlobal({ slug: "navigation", data: seedNavigation });
      payload.logger.info("[seed] navigation global seeded.");
    }
  } catch (e) {
    payload.logger.warn(`[seed] navigation global failed: ${(e as Error).message}`);
  }

  // Commerce global — seed the USD display rate only if unset (staff maintain it).
  try {
    const commerce = (await payload.findGlobal({ slug: "commerce" })) as { usdExchangeRate?: number };
    if (!commerce?.usdExchangeRate) {
      await payload.updateGlobal({ slug: "commerce", data: { usdExchangeRate: 84 } });
      payload.logger.info("[seed] commerce global seeded (usdExchangeRate 84).");
    }
  } catch (e) {
    payload.logger.warn(`[seed] commerce global failed: ${(e as Error).message}`);
  }
}

/** True when a Lexical body has real content (used to detect bare seed rows). */
function hasLexicalBody(body: unknown): boolean {
  return Boolean((body as { root?: { children?: unknown[] } } | null)?.root?.children?.length);
}

/**
 * One-time real-project migration. Runs the create/reconcile/cleanup pass ONLY
 * while migration is still pending — i.e. the old placeholder projects exist,
 * or the collection has none of the real case studies yet (fresh database).
 * Once migrated, this is a permanent no-op: a case study a staffer deliberately
 * deletes stays deleted (no resurrection on the next boot), and staff-authored
 * content is never overwritten. Further projects are authored in the CMS.
 */
async function ensureRealProjects(payload: Payload): Promise<void> {
  try {
    const [dummies, real] = await Promise.all([
      payload.count({
        collection: "projects",
        where: { slug: { in: dummyProjectSlugs } },
        overrideAccess: true,
      }),
      payload.count({
        collection: "projects",
        where: { slug: { in: seedProjects.map((p) => p.slug) } },
        overrideAccess: true,
      }),
    ]);
    if (dummies.totalDocs === 0 && real.totalDocs > 0) return; // migrated — never resurrect
  } catch (e) {
    payload.logger.warn(`[seed] project migration pre-check failed: ${(e as Error).message}`);
    return;
  }

  let realPresent = 0;
  for (const project of seedProjects) {
    try {
      const existing = await payload.find({
        collection: "projects",
        where: { slug: { equals: project.slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const doc = existing.docs[0] as { id: string | number; body?: unknown } | undefined;
      const { bodyText, tags, ...rest } = project;
      const data = {
        ...rest,
        // content-data lists tags as plain strings; the collection stores { tag }.
        tags: (tags ?? []).map((t) => ({ tag: t })),
        body: plainTextToLexical(bodyText),
        _status: "published" as const,
      };

      if (doc) {
        realPresent++;
        // Reconcile a stale bare-seed project (no body) to the real content.
        // A project with a body (staff-authored) is never overwritten, and the
        // update does NOT touch `active`/`featured` (staff intent preserved).
        if (!hasLexicalBody(doc.body)) {
          await payload.update({ collection: "projects", id: doc.id, data, overrideAccess: true });
          payload.logger.info(`[seed] projects: reconciled ${project.slug}`);
        }
        continue;
      }

      await payload.create({
        collection: "projects",
        data: { ...data, active: true, featured: false },
      });
      realPresent++;
      payload.logger.info(`[seed] projects: + ${project.slug} (published)`);
    } catch (e) {
      payload.logger.warn(`[seed] project ${project.slug} failed: ${(e as Error).message}`);
    }
  }

  // Remove the old placeholders only when the real content fully landed, and
  // only rows that are still bare seeds — a placeholder slug that a staffer
  // filled with real content is left in place (warned) rather than destroyed.
  if (realPresent === seedProjects.length) {
    for (const slug of dummyProjectSlugs) {
      try {
        const found = await payload.find({
          collection: "projects",
          where: { slug: { equals: slug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });
        const doc = found.docs[0] as { id: string | number; body?: unknown } | undefined;
        if (!doc) continue;
        if (hasLexicalBody(doc.body)) {
          payload.logger.warn(`[seed] placeholder slug '${slug}' has staff content — left in place.`);
          continue;
        }
        await payload.delete({ collection: "projects", id: doc.id, overrideAccess: true });
        payload.logger.info(`[seed] projects: removed placeholder '${slug}'.`);
      } catch (e) {
        payload.logger.warn(`[seed] placeholder removal '${slug}' failed: ${(e as Error).message}`);
      }
    }
  }
}

/**
 * Blog content migration (idempotent, never overwrites staff edits):
 *  1. Creates the real METNMAT-written articles from content-data.ts when
 *     their slug does not exist yet (fresh DBs and the first deploy).
 *  2. Removes the ORIGINAL placeholder posts once — only after the real
 *     articles are confirmed present, and only the known dummy slugs.
 * Staff-created/edited articles are never touched; further articles are
 * authored directly in the CMS.
 */
async function ensureRealBlogArticles(payload: Payload): Promise<void> {
  // One-shot: once the placeholders are gone and any real article exists, the
  // migration never runs again — an article staff deliberately delete stays
  // deleted (no resurrection on the next boot).
  try {
    const [dummies, real] = await Promise.all([
      payload.count({
        collection: "posts",
        where: { slug: { in: dummyPostSlugs } },
        overrideAccess: true,
      }),
      payload.count({
        collection: "posts",
        where: { slug: { in: seedPosts.map((p) => p.slug) } },
        overrideAccess: true,
      }),
    ]);
    if (dummies.totalDocs === 0 && real.totalDocs > 0) return;
  } catch (e) {
    payload.logger.warn(`[seed] blog migration pre-check failed: ${(e as Error).message}`);
    return;
  }

  const idBySlug = async (
    collection: "blog-categories" | "blog-content-types",
    slug?: string,
  ): Promise<string | undefined> => {
    if (!slug) return undefined;
    try {
      const res = await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1, depth: 0 });
      return res.docs[0] ? String(res.docs[0].id) : undefined;
    } catch {
      return undefined;
    }
  };

  /**
   * Attach the bundled cover image when the article has none. Runs on every
   * boot but is a no-op once a cover is set (and staff replacing the cover in
   * the admin is never overwritten). The asset path resolves against the app
   * dir (process.cwd() is apps/dashboard both locally and in the container).
   */
  const ensureCover = async (
    articleId: string | number,
    coverAsset?: string,
    coverAlt?: string,
  ): Promise<void> => {
    if (!coverAsset) return;
    const filePath = path.resolve(process.cwd(), coverAsset);
    if (!existsSync(filePath)) {
      payload.logger.warn(`[seed] cover asset missing: ${filePath}`);
      return;
    }
    const media = await payload.create({
      collection: "media",
      filePath,
      // Explicit category — the "product" default would put this through the
      // product-image spec check and reject it.
      data: { alt: coverAlt ?? "", category: "hero-banner" },
    });
    await payload.update({
      collection: "posts",
      id: articleId,
      data: { coverImage: media.id, coverImageAlt: coverAlt ?? "" },
    });
    payload.logger.info(`[seed] posts: cover attached (${coverAsset})`);
  };

  let realPresent = 0;
  for (const post of seedPosts) {
    try {
      const existing = await payload.find({
        collection: "posts",
        where: { slug: { equals: post.slug } },
        limit: 1,
        depth: 0,
      });
      if (existing.docs[0]) {
        realPresent++;
        const doc = existing.docs[0] as { id: string | number; coverImage?: unknown };
        if (!doc.coverImage) {
          await ensureCover(doc.id, post.coverAsset, post.coverAlt).catch((e) =>
            payload.logger.warn(`[seed] cover for ${post.slug} failed: ${(e as Error).message}`),
          );
        }
        continue;
      }
      const { bodyText, categorySlug, contentTypeSlug, coverAsset, coverAlt, ...rest } = post;
      const [categoryId, contentTypeId] = await Promise.all([
        idBySlug("blog-categories", categorySlug),
        idBySlug("blog-content-types", contentTypeSlug),
      ]);
      const created = await payload.create({
        collection: "posts",
        data: {
          ...rest,
          body: plainTextToLexical(bodyText),
          ...(categoryId ? { primaryCategory: categoryId } : {}),
          ...(contentTypeId ? { contentType: contentTypeId } : {}),
          workflowStatus: "approved",
          allowReactions: true,
          _status: "published",
        },
      });
      // Attach the cover on the same boot (not a later one).
      await ensureCover(created.id, coverAsset, coverAlt).catch((e) =>
        payload.logger.warn(`[seed] cover for ${post.slug} failed: ${(e as Error).message}`),
      );
      realPresent++;
      payload.logger.info(`[seed] posts: + ${post.slug} (published)`);
    } catch (e) {
      payload.logger.warn(`[seed] posts ${post.slug} failed: ${(e as Error).message}`);
    }
  }

  // Remove the placeholder posts only when the real content is fully in place,
  // so the blog can never end up empty because a create failed.
  if (realPresent === seedPosts.length) {
    try {
      const res = await payload.delete({
        collection: "posts",
        where: { slug: { in: dummyPostSlugs } },
      });
      const removed = (res as { docs?: unknown[] })?.docs?.length ?? 0;
      if (removed) payload.logger.info(`[seed] posts: removed ${removed} placeholder article(s).`);
    } catch (e) {
      payload.logger.warn(`[seed] placeholder post removal failed: ${(e as Error).message}`);
    }
  }
}

/**
 * Self-healing RBAC bootstrap. A first user created before the roles-field
 * access was bootstrap-safe could be saved with NO roles — locking everyone out
 * ("You are not allowed to perform this action"). On every boot, if no account
 * has the `super-admin` role, promote the earliest-created user to super-admin
 * so the dashboard always has a working administrator. Idempotent: once a
 * super-admin exists it does nothing. Uses overrideAccess so the write can't be
 * blocked by the very field-access rule we're recovering from.
 */
export async function ensureSuperAdmin(payload: Payload): Promise<void> {
  try {
    const users = await payload.find({
      collection: "users",
      limit: 200,
      depth: 0,
      sort: "createdAt",
      overrideAccess: true,
    });
    const docs = users.docs as unknown as Array<{ id: string | number; name?: string; roles?: string[] }>;
    const roleState = docs.map((u) => `${u.name || u.id}=[${(u.roles || []).join(",")}]`).join("; ");
    payload.logger.info(`[seed] ${docs.length} user(s); roles: ${roleState || "(none)"}`);

    const hasSuper = docs.some((u) => Array.isArray(u.roles) && u.roles.includes("super-admin"));
    if (!hasSuper && docs[0]) {
      const target = docs[0];
      const roles = Array.from(new Set([...(target.roles || []), "super-admin"]));
      await payload.update({
        collection: "users",
        id: target.id,
        data: { roles },
        overrideAccess: true,
      });
      payload.logger.warn(
        `[seed] No super-admin found — promoted earliest user '${target.name || target.id}' to super-admin.`,
      );
    }
  } catch (e) {
    payload.logger.error(`[seed] ensureSuperAdmin failed: ${(e as Error).message}`);
  }
}

/**
 * SECURITY migration: legacy synthetic staff emails embedded the login PIN
 * (staff-<PIN>-<ts>@staff.metnmat.local). Rewrite them to opaque addresses so
 * no user-list reader can recover a credential. Idempotent — the new format
 * never matches the legacy pattern. Login is unaffected (PIN sign-in looks up
 * the pin field; the derived password is tied to the PIN, not the email).
 */
async function scrubPinBearingEmails(payload: Payload): Promise<void> {
  try {
    const legacy = /^staff-\d{4}-\d+@staff\.metnmat\.local$/;
    const users = await payload.find({
      collection: "users",
      limit: 500,
      depth: 0,
      overrideAccess: true,
    });
    let fixed = 0;
    for (const u of users.docs as Array<{ id: string | number; email?: string }>) {
      if (u.email && legacy.test(u.email)) {
        const { randomBytes } = await import("crypto");
        await payload.update({
          collection: "users",
          id: u.id,
          data: { email: `staff-${randomBytes(6).toString("hex")}@staff.metnmat.local` },
          overrideAccess: true,
        });
        fixed++;
      }
    }
    if (fixed) payload.logger.warn(`[seed] scrubbed ${fixed} PIN-bearing synthetic staff email(s).`);
  } catch (e) {
    payload.logger.warn(`[seed] email scrub failed: ${(e as Error).message}`);
  }
}

/**
 * Move staff PINs out of cleartext.
 *
 * The `pin` field used to be ordinary text, so MongoDB held every staff
 * credential in the clear, indexed, beside the password hash. Field-level access
 * limited who could read it through Payload's API and did nothing about anyone
 * able to read the collection itself.
 *
 * TWO PHASES, ON PURPOSE. This writes the derived lookup and leaves the
 * cleartext alone. Clearing it is a separate, flag-gated pass. Doing both at
 * once would mean that a failure halfway — a dropped connection, a bad document
 * — could clear a PIN whose lookup had not been written, and since the PIN is
 * the credential and nothing else can reproduce it, that account would be
 * unreachable forever. Writing first is additive and reversible; only purge once
 * sign-in has been seen to work.
 *
 * Uses the native driver deliberately: `pin` is now a virtual field, so Payload
 * will not read the legacy stored value at all.
 *
 * Idempotent. Only touches documents that still need it, so a repeat run is a
 * no-op and a partial run is fixed by running again.
 */
async function migratePinsOutOfCleartext(payload: Payload): Promise<void> {
  const conn = (payload.db as unknown as { connection?: { collection?: (n: string) => unknown; db?: { collection: (n: string) => unknown } } })?.connection;
  const col = (conn?.collection?.("users") ?? conn?.db?.collection("users")) as
    | {
        find: (f: unknown) => { toArray: () => Promise<Array<Record<string, unknown>>> };
        updateOne: (f: unknown, u: unknown) => Promise<unknown>;
        updateMany: (f: unknown, u: unknown) => Promise<{ modifiedCount?: number }>;
      }
    | undefined;
  if (!col) return;

  try {
    // Phase 1 — additive. Give every legacy PIN its lookup.
    const pending = await col
      .find({ pin: { $exists: true, $nin: [null, ""] }, pinLookup: { $exists: false } })
      .toArray();

    let written = 0;
    for (const doc of pending) {
      const pin = String(doc.pin ?? "");
      if (!/^\d{4}$/.test(pin)) continue;
      await col.updateOne({ _id: doc._id }, { $set: { pinLookup: derivePinLookup(pin) } });
      written += 1;
    }
    if (written) payload.logger.warn(`[seed] pin lookup written for ${written} staff account(s)`);

    // Phase 2 — destructive, and only when explicitly asked for. Every document
    // touched here already has a lookup, so sign-in continues to work; what goes
    // is the ability to READ the PIN back, which is the point.
    if (process.env.PIN_CLEARTEXT_PURGE === "true") {
      const res = await col.updateMany(
        { pin: { $exists: true }, pinLookup: { $exists: true, $nin: [null, ""] } },
        { $unset: { pin: "" } },
      );
      payload.logger.warn(
        `[seed] cleartext PIN purged from ${res?.modifiedCount ?? 0} staff account(s) — PINs can no longer be read back, only reset`,
      );
    }
  } catch (e) {
    // Never fail boot over this: a CMS that will not start is worse than one
    // still holding cleartext, and the next boot retries.
    payload.logger.error(`[seed] pin migration failed (continuing boot): ${(e as Error).message}`);
  }
}

/**
 * Director / super-admin bootstrap — env-driven so no credential is ever
 * committed to git. On boot, when DIRECTOR_EMAIL + DIRECTOR_PIN are set, ensure
 * that account exists as an ACTIVE super-admin. It is created through the local
 * API (not a raw insert), so the PIN-derived password is hashed with the real
 * production pepper — meaning the 4-digit PIN sign-in works in prod.
 *
 * THE PIN IS SEEDED, NOT ENFORCED. This used to overwrite the PIN on every
 * boot, so a PIN changed in the admin UI was reverted by the next restart and
 * the person who set it was locked out with no explanation — seen in production
 * on 2026-09-04. It is now written only when the account has none, or when
 * DIRECTOR_PIN_FORCE=true asks for it deliberately. That flag is the break-glass
 * path: the password is an HMAC of the PIN, so a forgotten PIN cannot be
 * recovered any other way. See lib/director-pin. When
 * DIRECTOR_RESET=true, every OTHER staff account is removed AFTER the director
 * is confirmed present (so a "fresh single-admin" CMS can be provisioned with no
 * risk of lockout). Storefront customers are a separate collection and are NEVER
 * touched. Fully idempotent and a complete no-op when the env vars are unset.
 */
async function ensureDirectorAccount(payload: Payload): Promise<void> {
  const email = (process.env.DIRECTOR_EMAIL || "").trim().toLowerCase();
  const pin = (process.env.DIRECTOR_PIN || "").trim();
  const name = (process.env.DIRECTOR_NAME || "").trim() || "Administrator";
  const reset = process.env.DIRECTOR_RESET === "true";
  if (!email || !/^\d{4}$/.test(pin)) return;

  try {
    // Match by email OR by the target PIN. A pre-existing account that already
    // holds this email or this PIN must be RECONCILED, never duplicated — and
    // matching the PIN avoids the unique-PIN validation failure that a blind
    // create would hit. If several match, keep the earliest and delete the rest.
    const matches = await payload.find({
      collection: "users",
      // Matched on the derived lookup — the PIN itself is no longer stored.
      where: { or: [{ email: { equals: email } }, { pinLookup: { equals: derivePinLookup(pin) } }] },
      sort: "createdAt",
      limit: 50,
      depth: 0,
      overrideAccess: true,
    });
    const docs = matches.docs as Array<{ id: string | number }>;

    let directorId: string | number;
    if (docs.length > 0) {
      directorId = docs[0].id;
      // Remove duplicate matches first so the email + PIN are free to set.
      for (const dup of docs.slice(1)) {
        await payload.delete({ collection: "users", id: dup.id, overrideAccess: true });
      }
      const decision = decideDirectorPinWrite(
        // The stored lookup stands in for "this account already has a PIN": the
        // PIN itself is not readable any more, which is the whole point.
        (docs[0] as { pinLookup?: unknown }).pinLookup,
        directorPinForced(process.env),
      );
      await payload.update({
        collection: "users",
        id: directorId,
        // The PIN is deliberately absent unless it needs writing: including it
        // makes Users.beforeChange re-derive the password, which is what
        // silently changed the credential on every restart.
        data: { name, email, roles: ["super-admin"], ...(decision.write ? { pin } : {}) },
        overrideAccess: true,
      });
      payload.logger.warn(
        `[seed] director super-admin ensured: ${email} (pin ${decision.reason})${docs.length > 1 ? ` (removed ${docs.length - 1} duplicate match(es))` : ""}`,
      );
    } else {
      const created = await payload.create({
        collection: "users",
        data: { name, email, pin, roles: ["super-admin"] },
        overrideAccess: true,
      });
      directorId = created.id;
      payload.logger.warn(`[seed] director super-admin created: ${email}`);
    }

    if (reset && directorId) {
      const others = await payload.find({
        collection: "users",
        where: { id: { not_equals: directorId } },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      });
      let removed = 0;
      for (const u of others.docs as Array<{ id: string | number }>) {
        await payload.delete({ collection: "users", id: u.id, overrideAccess: true });
        removed++;
      }
      if (removed) {
        payload.logger.warn(
          `[seed] DIRECTOR_RESET: removed ${removed} other staff account(s) — the CMS now has a single super-admin (${email}).`,
        );
      }
    }
  } catch (e) {
    payload.logger.error(`[seed] ensureDirectorAccount failed: ${(e as Error).message}`);
  }
}

/**
 * One-shot migration (2026-07-06): drop the "first" claim from copy that was
 * seeded before the wording change. Exact-match / exact-fragment only, so
 * anything staff have already customised is never touched.
 */
async function dropFirstFromLegacyCopy(payload: Payload): Promise<void> {
  const OLD_EYEBROW = "India's first private Metallurgy & Materials R&D";
  const NEW_EYEBROW = "India's private Metallurgy & Materials R&D";
  try {
    const hp = (await payload.findGlobal({ slug: "homepage" })) as { eyebrow?: string };
    if (hp?.eyebrow === OLD_EYEBROW) {
      await payload.updateGlobal({ slug: "homepage", data: { eyebrow: NEW_EYEBROW } });
      payload.logger.info("[seed] homepage eyebrow: dropped the 'first' claim.");
    }
  } catch (e) {
    payload.logger.warn(`[seed] eyebrow migration failed: ${(e as Error).message}`);
  }
  const OLD_FRAG = "India's first private metallurgy & materials R&D company";
  const NEW_FRAG = "India's private metallurgy & materials R&D company";
  try {
    const res = await payload.find({
      collection: "faqs",
      where: { answer: { contains: "India's first private" } },
      limit: 20,
    });
    for (const doc of res.docs) {
      const answer = ((doc as { answer?: string }).answer ?? "");
      if (answer.includes(OLD_FRAG)) {
        await payload.update({
          collection: "faqs",
          id: doc.id,
          data: { answer: answer.replace(OLD_FRAG, NEW_FRAG) },
        });
        payload.logger.info(`[seed] faq ${doc.id}: dropped the 'first' claim.`);
      }
    }
  } catch (e) {
    payload.logger.warn(`[seed] faq migration failed: ${(e as Error).message}`);
  }
}

/**
 * One-shot rebrand (2026-07-09): the homepage hero was seeded with the old
 * "India's private…" positioning. Move any still-default Homepage global forward
 * to the new copy — eyebrow → the "Research. Design. Build. Scale." tagline, the
 * new company-description subtitle, and the 5-stat band. Exact-match only, so a
 * value a staffer has customised in the admin is never overwritten. Reads the
 * NEW values from seedHomepage so this stays a single source of truth.
 */
/**
 * Persist the international pricing mode on rows written before the field.
 *
 * Mode used to be IMPLIED by whether usdPrice was set. The collection hook
 * derives it on save and the storefront derives it on read, so behaviour is
 * already correct without this — but "correct because three places agree to
 * guess the same way" is not a state to leave a catalogue in. This writes the
 * derivation down once so the stored data says what it means.
 *
 * Deliberately NOT a price change: AUTO_CONVERT for everything without a USD
 * figure, FIXED_USD for everything with one. Every product keeps exactly the
 * price it had.
 */
async function backfillPricingMode(payload: Payload): Promise<void> {
  const missing = await payload.find({
    collection: "products",
    where: { internationalPricing: { exists: false } },
    limit: 1000,
    depth: 0,
  });
  if (missing.docs.length === 0) return;

  let auto = 0;
  let fixed = 0;
  for (const doc of missing.docs) {
    const usd = Number((doc as { usdPrice?: number }).usdPrice);
    const mode = Number.isFinite(usd) && usd > 0 ? "FIXED_USD" : "AUTO_CONVERT";
    await payload.update({
      collection: "products",
      id: doc.id,
      data: { internationalPricing: mode },
      // The row is otherwise untouched, so republishing it would be a lie in
      // the version history.
      draft: false,
    });
    mode === "FIXED_USD" ? fixed++ : auto++;
  }
  payload.logger.info(
    `[seed] backfillPricingMode: ${auto} AUTO_CONVERT, ${fixed} FIXED_USD (no price changed)`,
  );
}

async function rebrandHomepageCopy(payload: Payload): Promise<void> {
  const OLD_EYEBROW = "India's private Metallurgy & Materials R&D";
  const OLD_SUBTITLE =
    "Customized turnkey R&D solutions for metallurgy & materials industries — from lab-scale prototype to full industrial scale, making your process cheaper, cleaner and stronger.";
  const OLD_STATS = [
    { value: "100+", label: "R&D projects delivered" },
    { value: "2018", label: "Innovating since" },
    { value: "91–93%", label: "IACS conductivity" },
  ];
  const statKey = (arr?: { value?: string; label?: string }[]) =>
    JSON.stringify((arr ?? []).map((s) => [s.value, s.label]));
  try {
    const hp = (await payload.findGlobal({ slug: "homepage" })) as {
      eyebrow?: string;
      subtitle?: string;
      stats?: { value?: string; label?: string }[];
    };
    const data: Record<string, unknown> = {};
    if (hp?.eyebrow === OLD_EYEBROW) data.eyebrow = seedHomepage.eyebrow;
    if (hp?.subtitle === OLD_SUBTITLE) data.subtitle = seedHomepage.subtitle;
    if (statKey(hp?.stats) === statKey(OLD_STATS)) data.stats = seedHomepage.stats;
    if (Object.keys(data).length) {
      await payload.updateGlobal({ slug: "homepage", data });
      payload.logger.info(`[seed] homepage rebrand: updated ${Object.keys(data).join(", ")}.`);
    }
  } catch (e) {
    payload.logger.warn(`[seed] homepage rebrand failed: ${(e as Error).message}`);
  }
}

/**
 * One-shot (2026-07-09b): promote the "Research. Design. Build. Scale." tagline
 * from the eyebrow up into the headline. The eyebrow becomes a (rotating) kicker
 * term, and the tagline becomes titleLead + titleAccent. Exact-match only,
 * reading the new values from seedHomepage, so staff edits are never overwritten.
 */
async function refineHeroHeadline(payload: Payload): Promise<void> {
  const OLD_EYEBROW = "Research. Design. Build. Scale.";
  const OLD_TITLE_LEAD = "Turning materials science into";
  const OLD_TITLE_ACCENT = "industrial advantage";
  try {
    const hp = (await payload.findGlobal({ slug: "homepage" })) as {
      eyebrow?: string;
      titleLead?: string;
      titleAccent?: string;
    };
    const data: Record<string, unknown> = {};
    if (hp?.eyebrow === OLD_EYEBROW) data.eyebrow = seedHomepage.eyebrow;
    if (hp?.titleLead === OLD_TITLE_LEAD) data.titleLead = seedHomepage.titleLead;
    if (hp?.titleAccent === OLD_TITLE_ACCENT) data.titleAccent = seedHomepage.titleAccent;
    if (Object.keys(data).length) {
      await payload.updateGlobal({ slug: "homepage", data });
      payload.logger.info(`[seed] hero headline: updated ${Object.keys(data).join(", ")}.`);
    }
  } catch (e) {
    payload.logger.warn(`[seed] hero headline migration failed: ${(e as Error).message}`);
  }
}

/**
 * One-shot (2026-09-03): clear the cutover-era maintenance banner.
 *
 * `maintenance.enabled` was switched on in the admin on 2026-07-04 during the
 * AWS cutover and never switched back off, so for two months every page on
 * www.metnmat.com server-rendered — above the <h1> — a notice that the site was
 * degraded and that visitors would do "better to use metnmat.in". Neither half
 * was doing us any good: the site was in fact fully healthy, and metnmat.in is
 * the legacy property the .com consolidation is trying to retire (see
 * docs/seo/AUDIT.md, "The one thing genuinely working against you"). So the
 * banner cost traffic twice over — it read as an outage to customers, and it
 * handed every crawler and answer engine a cross-domain recommendation before
 * any real content.
 *
 * The guard is the cross-domain recommendation itself rather than the usual
 * exact-match on the whole string: the stored copy has already drifted from the
 * field default (it carries a trailing space), and what makes it harmful is
 * precisely that it names the old domain. A genuine future maintenance notice
 * written by staff will not point at metnmat.in, so this reverts to a no-op
 * once it has fired, and a deliberate banner is never silently switched off.
 */
async function clearCutoverMaintenanceBanner(payload: Payload): Promise<void> {
  const NEUTRAL_MESSAGE =
    "We are currently performing scheduled maintenance. Some features may be temporarily unavailable.";
  try {
    const m = (await payload.findGlobal({ slug: "maintenance" })) as {
      enabled?: boolean;
      message?: string;
    };
    if (m?.enabled !== true) return;
    if (!/metnmat\.in/i.test(m?.message ?? "")) return;
    await payload.updateGlobal({
      slug: "maintenance",
      data: { enabled: false, message: NEUTRAL_MESSAGE },
    });
    payload.logger.info(
      `[seed] maintenance banner: switched OFF the 2026-07 cutover notice (it recommended metnmat.in) and restored the neutral default message.`,
    );
  } catch (e) {
    payload.logger.warn(`[seed] maintenance banner migration failed: ${(e as Error).message}`);
  }
}

/**
 * Default the homepage "Featured case study" to the Microstructure Control &
 * Heat Treatment project (the case study with a cover image, so a real photo
 * shows on the home page). Sets the relationship while it's empty, and does a
 * one-time move off the PREVIOUS default (the copper-alloy project) which no
 * staffer ever chose — the featuredProject field predates any staff use. A
 * deliberate staff pick of any OTHER project is left untouched: once the value
 * is neither empty nor the old default, this is a permanent no-op.
 */
const HOME_FEATURED_SLUG = "microstructure-control-heat-treatment";
const HOME_FEATURED_PREV_SLUG = "oxygen-free-copper-alloy";

async function ensureHomepageFeaturedProject(payload: Payload): Promise<void> {
  try {
    const hp = (await payload.findGlobal({ slug: "homepage", depth: 1 })) as {
      featuredProject?: { slug?: string } | string | null;
    };
    const current = hp?.featuredProject;
    const currentSlug = current && typeof current === "object" ? current.slug : undefined;
    // Set while empty, or move the old default forward once. Anything else (incl.
    // already pointing at the new default) is a deliberate/settled choice — leave it.
    if (current && currentSlug !== HOME_FEATURED_PREV_SLUG) return;
    const res = await payload.find({
      collection: "projects",
      where: { slug: { equals: HOME_FEATURED_SLUG } },
      limit: 1,
      overrideAccess: true,
    });
    const proj = res.docs[0];
    if (proj) {
      await payload.updateGlobal({ slug: "homepage", data: { featuredProject: proj.id } });
      payload.logger.info(`[seed] homepage featuredProject → ${HOME_FEATURED_SLUG}.`);
    }
  } catch (e) {
    payload.logger.warn(`[seed] featuredProject seed failed: ${(e as Error).message}`);
  }
}

/**
 * Bundled cover images for seeded projects. Attaches a cover only when the
 * project has none, so it's a no-op once set and a staff-uploaded cover is
 * never overwritten. STANDALONE (not inside ensureRealProjects, which
 * early-returns once the DB is migrated) so it still runs on prod. The media
 * create uploads to GCS on prod and to local disk on dev. Asset paths resolve
 * against process.cwd() (apps/dashboard, locally and in the container).
 */
const PROJECT_COVERS: { slug: string; asset: string; alt: string }[] = [
  {
    slug: "microstructure-control-heat-treatment",
    asset: "src/seed-assets/projects/microstructure-heat-treatment-cover.webp",
    alt: "Heat-treated metal billet glowing from hot to cool beside a gear and shaft, with a strip of micrographs showing the microstructure evolving through heat treatment.",
  },
  {
    slug: "ferritic-stainless-steel-texture",
    asset: "src/seed-assets/projects/ferritic-stainless-steel-texture-cover.webp",
    alt: "Deep-drawn stainless-steel cup, sheet and flange beside a thermo-mechanical processing temperature curve and micrographs of recrystallisation texture evolution.",
  },
  {
    slug: "casting-yield-optimization",
    asset: "src/seed-assets/projects/casting-yield-optimization-cover.webp",
    alt: "Molten metal pouring from a furnace with a thermoelectric module recycling waste process heat to lift casting yield.",
  },
  {
    slug: "alumina-insulation-fiber-board",
    asset: "src/seed-assets/projects/alumina-insulation-fiber-board-cover.webp",
    alt: "White high-temperature alumina insulation fiber boards with a fibre close-up, in front of a glowing furnace lining.",
  },
  {
    slug: "oxygen-free-copper-alloy",
    asset: "src/seed-assets/projects/oxygen-free-copper-alloy-cover.webp",
    alt: "Polished copper block, coil and rods with a grain-structure micrograph — oxygen-free high-strength electrical copper alloy at 91-93% IACS.",
  },
  {
    slug: "modeling-simulations",
    asset: "src/seed-assets/projects/modeling-simulations-cover.webp",
    alt: "Finite-element simulation of a valve body: meshed CAD model on one half, von-Mises stress colour map on the other, with solver code and result charts.",
  },
  // The remaining nine, completing covers for all 15 case studies. Same
  // text-left / art-right composition as the originals, so the object-left crop
  // used on the card, detail hero and home feature keeps the wording readable.
  {
    slug: "casting-defects",
    asset: "src/seed-assets/projects/casting-defects-cover.webp",
    alt: "Foundry ladle pouring molten metal into a mould beside a thermoelectric waste-heat recovery unit, with a temperature-monitoring screen reading a stable 820 °C.",
  },
  {
    slug: "waste-heat-recycling-system",
    asset: "src/seed-assets/projects/waste-heat-recycling-system-cover.webp",
    alt: "Thermoelectric modules clamped in an array around a hot exhaust pipe, recovering 20–50 per cent of the waste heat passing through it.",
  },
  {
    slug: "wear-resistant-composites",
    asset: "src/seed-assets/projects/wear-resistant-composites-cover.webp",
    alt: "Metal-matrix composite blocks, discs and a sleeve showing coarse ceramic reinforcement particles, on a steel bench beside tooling.",
  },
  {
    slug: "new-aluminum-alloy",
    asset: "src/seed-assets/projects/new-aluminum-alloy-cover.webp",
    alt: "Molten aluminium poured into an ingot mould beside cast billets and ingots, with a hydraulic press behind for thermo-mechanical processing.",
  },
  {
    slug: "material-synthesis",
    asset: "src/seed-assets/projects/material-synthesis-cover.webp",
    alt: "Laboratory tube furnace at 800 °C with vials of thermoelectric powders, sintered pellets and an assembled module, against a whiteboard of ZT equations.",
  },
  {
    slug: "surface-casting-improvement",
    asset: "src/seed-assets/projects/surface-casting-improvement-cover.webp",
    alt: "Continuous casting line pouring molten metal, with an instrumented thermoelectric recovery module mounted on the mould conveyor.",
  },
  {
    slug: "composite-materials",
    asset: "src/seed-assets/projects/composite-materials-cover.webp",
    alt: "Carbon-fibre and honeycomb-cored composite panels beside a speckled composite block, engineered for thermoelectric conductivity and durability.",
  },
  {
    slug: "aluminum-foam",
    asset: "src/seed-assets/projects/aluminum-foam-cover.webp",
    alt: "Closed-cell aluminium foam panels and a cylinder showing the porous structure, beside a crucible pouring molten aluminium.",
  },
  {
    slug: "high-temperature-ceramic",
    asset: "src/seed-assets/projects/high-temperature-ceramic-cover.webp",
    alt: "High-temperature ceramic tiles and a disc in front of a glowing furnace mouth, with heat-flow lines curving across to them.",
  },
];

/**
 * Run one seed step in isolation.
 *
 * The numbered steps below used to be bare sequential awaits inside a single
 * try/catch in onInit, which meant one throwing step silently skipped EVERY
 * later step — the CMS booted looking healthy while, say, project covers were
 * never attached, and the only trace was one log line. Each step is independent,
 * so a failure in one is isolated and named here.
 */
async function step(payload: Payload, name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    payload.logger.error(`[seed] step "${name}" failed (later steps still run): ${(e as Error).message}`);
  }
}

async function ensureProjectCovers(payload: Payload): Promise<void> {
  for (const { slug, asset, alt } of PROJECT_COVERS) {
    try {
      const res = await payload.find({
        collection: "projects",
        where: { slug: { equals: slug } },
        limit: 1,
        // depth 1: the decision below needs the attached cover's FILENAME.
        depth: 1,
        overrideAccess: true,
      });
      const doc = res.docs[0] as
        | { id: string | number; coverImage?: { filename?: string } | string | null }
        | undefined;
      if (!doc) continue;

      const filename = path.basename(asset);
      // Same rule as the category banners: compare the attached FILENAME with
      // the asset being shipped, rather than asking whether a cover exists at
      // all. Every one of these projects had a cover set and every one of those
      // files 404s — the media rows outlived the GCS bucket — so "a cover is
      // already set" was true and useless.
      const currentFile =
        doc.coverImage && typeof doc.coverImage === "object" ? doc.coverImage.filename : undefined;
      if (currentFile === filename) continue;
      const filePath = path.resolve(process.cwd(), asset);
      if (!existsSync(filePath)) {
        payload.logger.warn(`[seed] project cover asset missing: ${filePath}`);
        continue;
      }
      // Reuse an already-uploaded copy instead of minting a new Media row. This
      // keeps the attach idempotent across retries after a partial failure,
      // concurrent boots, and a staff clear+reboot — none of which would leave
      // an orphaned upload in the GCS bucket. Payload auto-increments filenames
      // on collision, so a bare create would otherwise silently duplicate.
      const existingMedia = await payload.find({
        collection: "media",
        where: { filename: { equals: filename } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const mediaId =
        (existingMedia.docs[0] as { id: string | number } | undefined)?.id ??
        (
          await payload.create({
            collection: "media",
            filePath,
            // Category MUST be explicit. Media.category defaults to "product",
            // and that is precisely the category enforceProductImageSpec polices
            // (4:3, >=2400px master). A project banner is not product
            // photography, so leaving it to the default made every cover upload
            // fail validation — silently, because the catch below logs a warning
            // and moves on. That is why nine covers never attached.
            data: { alt, category: "hero-banner" },
            overrideAccess: true,
          })
        ).id;
      await payload.update({
        collection: "projects",
        id: doc.id,
        data: { coverImage: mediaId, coverImageAlt: alt },
        overrideAccess: true,
      });
      payload.logger.info(`[seed] projects: cover attached (${slug}).`);
    } catch (e) {
      payload.logger.warn(`[seed] project cover for ${slug} failed: ${(e as Error).message}`);
    }
  }
}

/**
 * Bundled explanatory diagrams for the seeded blog articles, injected into the
 * article body as Lexical `upload` nodes (the website renders them as captioned,
 * auto-numbered figures; the admin editor shows them inline and lets staff add
 * more). STANDALONE + idempotent: it only injects while the body has NO figure
 * yet, and it splices into the EXISTING body (never rebuilds from seed text), so
 * staff text edits are preserved and re-runs are no-ops. Media create dedupes by
 * filename (uploads to GCS on prod / local disk on dev).
 */
const BLOG_FIGURES: {
  slug: string;
  figures: { afterParagraph: number; asset: string; alt: string; caption: string }[];
}[] = [
  {
    slug: "ion-exchange-membranes",
    figures: [
      {
        afterParagraph: 2,
        asset: "src/seed-assets/blog/iem-figure-proton-transport.webp",
        alt: "Proton transport across a proton exchange membrane by the vehicular and Grotthuss mechanisms.",
        caption:
          "Proton (H⁺) transport across a PEM. In the vehicular mechanism the whole H₃O⁺ ion diffuses bodily across; in the Grotthuss mechanism the proton is relayed along a hydrogen-bonded water chain.",
      },
    ],
  },
  {
    slug: "anion-exchange-membrane-water-electrolysis",
    figures: [
      {
        afterParagraph: 2,
        asset: "src/seed-assets/blog/aemwe-figure-cell-construction.webp",
        alt: "Cross-section of an AEMWE cell showing endplates, current collectors, gaskets, catalyst electrodes and the central anion exchange membrane carrying OH⁻ ions.",
        caption:
          "AEMWE cell construction and working principle — endplates, current collectors with flow channels, gaskets and catalyst-coated electrodes around a central anion exchange membrane that carries OH⁻ from cathode to anode.",
      },
    ],
  },
  {
    slug: "co2-fuel-cells",
    figures: [
      {
        afterParagraph: 4,
        asset: "src/seed-assets/blog/co2-figure-cell-principle.webp",
        alt: "Schematic of a metal–CO₂ cell: a lithium metal anode and a porous CO₂-fed gas cathode in a non-aqueous electrolyte, with the discharge (CRR) and charge (CER) reactions.",
        caption:
          "Working principle of a metal–CO₂ cell (Li–CO₂ archetype). On discharge, CO₂ is reduced at the porous gas cathode to Li₂CO₃ + C (CRR); on charge the reaction reverses (CER). Li₂CO₃ is an insulator, which drives the large charge overpotential at the heart of the field's research.",
      },
    ],
  },
];

type LexNode = { type?: string; children?: LexNode[]; [k: string]: unknown };

const lexHasUpload = (n: LexNode): boolean =>
  n?.type === "upload" || (n?.children ?? []).some(lexHasUpload);

/**
 * Article cover images.
 *
 * Separate from ensureRealBlogArticles, which attaches a cover when it first
 * creates an article and then never runs again — it is a one-shot migration, so
 * an article whose cover later breaks can never be repaired through it. Every
 * one of these had a cover set and every file 404s, which is exactly that case.
 *
 * Named -hero to distinguish them from the dead -cover rows; the attach test is
 * a filename comparison, so reusing the old name would match and skip.
 */
const BLOG_COVERS: { slug: string; asset: string; alt: string }[] = [
  {
    slug: "co2-fuel-cells",
    asset: "src/seed-assets/blog/co2-fuel-cells-hero.webp",
    alt: "Exploded view of a CO2 electrolyser stack — flow plates, porous gas diffusion and catalyst layers either side of a proton-conducting membrane, with the external electron path above. CO2 enters on the left and the product stream leaves on the right, labelled carbon monoxide, formate, hydrocarbons and alcohols.",
  },
  {
    slug: "anion-exchange-membrane-water-electrolysis",
    asset: "src/seed-assets/blog/aemwe-hero.webp",
    alt: "Exploded view of an anion exchange membrane water electrolyser — end plates, porous transport layers and catalyst layers around a central anion exchange membrane carrying hydroxide ions. Water and hydrogen are shown at the cathode side, oxygen at the anode side.",
  },
  {
    slug: "ion-exchange-membranes",
    asset: "src/seed-assets/blog/iem-hero.webp",
    alt: "A three-layer ion exchange membrane shown edge-on, with protons migrating in from the left and hydroxide ions from the right into the central junction layer.",
  },
];

/**
 * Attach the bundled cover when the article is not already showing it.
 *
 * Compares the attached FILENAME with the asset being shipped rather than
 * asking whether a cover exists, for the same reason as the category banners
 * and project covers: after the storage move every article had a cover and
 * none of the files existed, so "a cover is set" was true and meaningless.
 */
/**
 * Retire the peristaltic pumps the MBT/MPP/MSTP range replaced.
 *
 * Removing them from the seed data stops them being CREATED on a fresh
 * database but does nothing to the rows already in production — the catalogue
 * belongs to CMS staff and boot never deletes from it.
 *
 * Drafted rather than deleted. Orders snapshot the SKU as text so purchase
 * history reads correctly either way, but StockLedger holds a REQUIRED
 * relationship to the product, and deleting would orphan those rows. Drafting
 * takes the product off the shop, keeps every reference intact, and is undone
 * by publishing again.
 */
const SUPERSEDED_PUMP_SLUGS = [
  "intelligent-peristaltic-pump-dual-channel-dc-24v",
  "kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-17-50-ml-min",
  "kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control",
  "kamoer-m1-stp-intelligent-peristaltic-pump-dc-24v-48w-by-metnmat",
];

async function retireSupersededPumps(payload: Payload): Promise<void> {
  for (const slug of SUPERSEDED_PUMP_SLUGS) {
    try {
      const res = await payload.find({
        collection: "products",
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const doc = res.docs[0] as { id: string | number; _status?: string } | undefined;
      // Already drafted — including by staff, deliberately. Re-writing it every
      // boot would be pointless churn on a collection staff own.
      if (!doc || doc._status === "draft") continue;
      await payload.update({
        collection: "products",
        id: doc.id,
        data: { _status: "draft" },
        overrideAccess: true,
      });
      payload.logger.info(`[seed] products: retired superseded pump (${slug}).`);
    } catch (e) {
      payload.logger.warn(`[seed] retiring ${slug} failed: ${(e as Error).message}`);
    }
  }
}
async function ensureBlogCovers(payload: Payload): Promise<void> {
  for (const { slug, asset, alt } of BLOG_COVERS) {
    try {
      const res = await payload.find({
        collection: "posts",
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      });
      const doc = res.docs[0] as
        | { id: string | number; coverImage?: { filename?: string } | string | null }
        | undefined;
      if (!doc) continue;

      const filename = path.basename(asset);
      const currentFile =
        doc.coverImage && typeof doc.coverImage === "object" ? doc.coverImage.filename : undefined;
      if (currentFile === filename) continue;

      const filePath = path.resolve(process.cwd(), asset);
      if (!existsSync(filePath)) {
        payload.logger.warn(`[seed] blog cover asset missing: ${filePath}`);
        continue;
      }
      const existingMedia = await payload.find({
        collection: "media",
        where: { filename: { equals: filename } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const mediaId =
        (existingMedia.docs[0] as { id: string | number } | undefined)?.id ??
        (
          await payload.create({
            collection: "media",
            filePath,
            // Explicit category: the "product" default would put a 16:9 hero
            // through the 4:3 product-master check and reject it.
            data: { alt, category: "hero-banner" },
            overrideAccess: true,
          })
        ).id;
      await payload.update({
        collection: "posts",
        id: doc.id,
        data: { coverImage: mediaId, coverImageAlt: alt },
        overrideAccess: true,
      });
      payload.logger.info(`[seed] posts: cover attached (${slug}).`);
    } catch (e) {
      payload.logger.warn(`[seed] blog cover for ${slug} failed: ${(e as Error).message}`);
    }
  }
}
async function ensureBlogFigures(payload: Payload): Promise<void> {
  const { randomBytes } = await import("crypto");
  for (const { slug, figures } of BLOG_FIGURES) {
    try {
      const res = await payload.find({
        collection: "posts",
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const doc = res.docs[0] as { id: string | number; body?: { root?: { children?: LexNode[] } } } | undefined;
      const children = doc?.body?.root?.children;
      if (!doc || !Array.isArray(children)) continue; // no article, or empty body

      // Idempotency by WHICH figures are embedded, not whether any are.
      //
      // "The body already contains an upload" was true for these articles and
      // told us nothing: the uploads pointed at media whose files never survived
      // the storage move, so every figure was a broken image and the seed
      // skipped them all as already done. Comparing filenames distinguishes
      // "these are the figures we ship" from "these are figures".
      const embeddedIds = children
        .filter((c) => c?.type === "upload")
        .map((c) => (c as { value?: unknown }).value)
        .filter(Boolean);
      const embeddedFiles = new Set<string>();
      if (embeddedIds.length) {
        const found = await payload.find({
          collection: "media",
          where: { id: { in: embeddedIds } },
          limit: 50,
          depth: 0,
          overrideAccess: true,
        });
        for (const m of found.docs) {
          const fn = (m as { filename?: string }).filename;
          if (fn) embeddedFiles.add(fn);
        }
      }
      const expected = figures.map((f) => path.basename(f.asset));
      if (expected.every((f) => embeddedFiles.has(f))) continue; // already ours

      // Resolve (dedupe-by-filename) each figure's media id.
      const built: { afterParagraph: number; node: LexNode }[] = [];
      for (const fig of figures) {
        const filePath = path.resolve(process.cwd(), fig.asset);
        if (!existsSync(filePath)) {
          payload.logger.warn(`[seed] blog figure asset missing: ${filePath}`);
          continue;
        }
        const filename = path.basename(fig.asset);
        const existing = await payload.find({
          collection: "media",
          where: { filename: { equals: filename } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });
        const mediaId =
          (existing.docs[0] as { id: string | number } | undefined)?.id ??
          (await payload.create({ collection: "media", filePath, data: { alt: fig.alt, category: "other" }, overrideAccess: true })).id;
        built.push({
          afterParagraph: fig.afterParagraph,
          // Payload Lexical v3 upload node: block-level sibling of paragraphs,
          // `value` is the raw media id, `id` a fresh 24-char hex, unique per node.
          node: {
            type: "upload",
            version: 3,
            id: randomBytes(12).toString("hex"),
            relationTo: "media",
            value: mediaId,
            fields: { caption: fig.caption },
            format: "",
          },
        });
      }
      if (!built.length) continue;

      // Splice each figure in after its Nth paragraph. Descending order so an
      // earlier insertion never shifts a later target index.
      // Drop the stale figure nodes first, or the article ends up with both the
      // broken originals and the new ones. Only top-level upload siblings are
      // removed — an upload nested inside a paragraph is someone's inline image,
      // not one of ours.
      const out = children.filter((c) => c?.type !== "upload");
      for (const ins of [...built].sort((a, b) => b.afterParagraph - a.afterParagraph)) {
        let count = 0;
        let at = out.length - 1;
        for (let i = 0; i < out.length; i++) {
          if (out[i]?.type === "paragraph") {
            count += 1;
            if (count === ins.afterParagraph) {
              at = i;
              break;
            }
          }
        }
        out.splice(at + 1, 0, ins.node);
      }
      const newBody = { ...doc.body, root: { ...doc.body!.root, children: out } };
      await payload.update({ collection: "posts", id: doc.id, data: { body: newBody }, overrideAccess: true });
      payload.logger.info(`[seed] posts: injected ${built.length} figure(s) into ${slug}.`);
    } catch (e) {
      payload.logger.warn(`[seed] blog figures for ${slug} failed: ${(e as Error).message}`);
    }
  }
}

/**
 * Blog articles added AFTER the one-shot migration (ensureRealBlogArticles
 * early-returns once the DB is seeded, so a new seedPosts entry would never be
 * created on dev/prod). This creates each listed slug if it is missing and
 * attaches its cover — create-if-missing, so it also brings the article back if
 * a boot half-created it. Add a slug here when introducing a new seeded article.
 */
const EXTRA_ARTICLE_SLUGS = ["co2-fuel-cells"];

async function ensureExtraBlogArticles(payload: Payload): Promise<void> {
  const idBySlug = async (
    collection: "blog-categories" | "blog-content-types",
    slug?: string,
  ): Promise<string | undefined> => {
    if (!slug) return undefined;
    const r = await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true });
    return r.docs[0] ? String(r.docs[0].id) : undefined;
  };
  for (const slug of EXTRA_ARTICLE_SLUGS) {
    try {
      const post = seedPosts.find((p) => p.slug === slug);
      if (!post) continue;
      const existing = await payload.find({ collection: "posts", where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true });
      if (existing.docs[0]) continue; // already present — never overwrite

      const { bodyText, categorySlug, contentTypeSlug, coverAsset, coverAlt, ...rest } = post as typeof post & {
        categorySlug?: string;
        contentTypeSlug?: string;
        coverAsset?: string;
        coverAlt?: string;
      };
      const [categoryId, contentTypeId] = await Promise.all([
        idBySlug("blog-categories", categorySlug),
        idBySlug("blog-content-types", contentTypeSlug),
      ]);
      const created = await payload.create({
        collection: "posts",
        data: {
          ...rest,
          body: plainTextToLexical(bodyText),
          ...(categoryId ? { primaryCategory: categoryId } : {}),
          ...(contentTypeId ? { contentType: contentTypeId } : {}),
          workflowStatus: "approved",
          allowReactions: true,
          _status: "published",
        },
        overrideAccess: true,
      });
      if (coverAsset) {
        const filePath = path.resolve(process.cwd(), coverAsset);
        if (existsSync(filePath)) {
          const filename = path.basename(coverAsset);
          const em = await payload.find({ collection: "media", where: { filename: { equals: filename } }, limit: 1, depth: 0, overrideAccess: true });
          const mediaId =
            (em.docs[0] as { id: string | number } | undefined)?.id ??
            (await payload.create({ collection: "media", filePath, data: { alt: coverAlt ?? "", category: "hero-banner" }, overrideAccess: true })).id;
          await payload.update({ collection: "posts", id: created.id, data: { coverImage: mediaId, coverImageAlt: coverAlt ?? "" }, overrideAccess: true });
        }
      }
      payload.logger.info(`[seed] posts: + ${slug} (extra article, published).`);
    } catch (e) {
      payload.logger.warn(`[seed] extra article ${slug} failed: ${(e as Error).message}`);
    }
  }
}

/**
 * One-shot, idempotent backfill: assign an MNM-U-YY code to every customer that
 * predates the field. Runs via the raw Mongo model (bypasses collection hooks)
 * and advances the SAME atomic per-year counter the live signup hook uses, so
 * backfilled and future codes never collide. Ordered by createdAt so codes
 * roughly follow signup order. Once every row has a code this is a no-op.
 */
async function backfillCustomerCodes(payload: Payload): Promise<void> {
  type CustomerRow = { _id: unknown; createdAt?: string | Date };
  type CustomersModel = {
    find: (
      filter: Record<string, unknown>,
      projection: Record<string, unknown>,
    ) => {
      sort: (s: Record<string, number>) => { lean: () => Promise<CustomerRow[]> };
    };
    updateOne: (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
    ) => Promise<{ modifiedCount?: number }>;
  };
  const UNCODED = { $or: [{ userCode: { $exists: false } }, { userCode: null }, { userCode: "" }] };
  const collections = (payload.db as unknown as { collections: Record<string, unknown> }).collections;
  const Customers = collections?.["customers"] as CustomersModel | undefined;
  if (!Customers || !collections?.["counters"]) return;

  let missing: CustomerRow[] = [];
  try {
    missing = await Customers.find(UNCODED, { _id: 1, createdAt: 1 }).sort({ createdAt: 1 }).lean();
  } catch (e) {
    payload.logger.warn(`[seed] customer-code backfill skipped (query failed): ${(e as Error).message}`);
    return;
  }
  if (!missing.length) return;

  const counters = countersModel(payload.db);
  let assigned = 0;
  for (const row of missing) {
    try {
      const created = row.createdAt ? new Date(row.createdAt) : new Date();
      const year2 = istYear2(created);
      const seq = await bumpCounter(counters, userCodeCounterKey(year2));
      // Conditional write: only code a row that is STILL un-coded, so two
      // instances booting at once can't double-write it (last one loses the race,
      // modifiedCount 0). No duplicates, crash-safe (a re-run finishes the rest).
      const res = await Customers.updateOne(
        { _id: row._id, ...UNCODED },
        { $set: { userCode: formatUserCode(year2, seq) } },
      );
      if (res?.modifiedCount === 1) assigned++;
    } catch (e) {
      payload.logger.warn(`[seed] customer-code backfill: one row failed — ${(e as Error).message}`);
    }
  }
  payload.logger.info(`[seed] Backfilled ${assigned}/${missing.length} customer code(s).`);
}

/**
 * DB-level uniqueness backstop for userCode. A PARTIAL unique index (only over
 * docs where userCode is a string) so legacy null/unset rows never block the
 * build, while any duplicate real code fails loudly with an 11000 instead of
 * being silently accepted (the field's own index is non-unique). Idempotent.
 */
async function ensureUserCodeIndex(payload: Payload): Promise<void> {
  type IndexableModel = {
    collection?: { createIndex: (keys: Record<string, number>, opts: Record<string, unknown>) => Promise<unknown> };
  };
  const Customers = (payload.db as unknown as { collections: Record<string, IndexableModel> }).collections?.["customers"];
  const coll = Customers?.collection;
  if (!coll) return;
  try {
    await coll.createIndex(
      { userCode: 1 },
      { unique: true, name: "userCode_unique", partialFilterExpression: { userCode: { $type: "string" } } },
    );
  } catch (e) {
    payload.logger.warn(`[seed] userCode unique index not ensured: ${(e as Error).message}`);
  }
}

/**
 * The part of seeding that boot must WAIT for.
 *
 * Without these nobody can sign in to a fresh deployment, so they stay on the
 * critical path. It is a handful of round trips, not two hundred.
 */
export async function seedCritical(payload: Payload): Promise<void> {
  await ensureSuperAdmin(payload);
  // Before the director bootstrap, which now matches on the derived lookup: a
  // legacy account still holding only a cleartext PIN would otherwise be found
  // by email alone, and one holding neither would look like a fresh install.
  await migratePinsOutOfCleartext(payload);
  await ensureDirectorAccount(payload);
  await scrubPinBearingEmails(payload);
  await cleanupMalformed(payload);
}

/**
 * Everything else: catalogue, content, media and the one-shot migrations.
 *
 * WHY THIS IS SEPARATE
 * This is roughly two hundred database round trips — a find-then-maybe-create
 * for each of ~68 products and ~26 categories, plus globals, covers, figures and
 * backfills. It ran inside onInit, which Payload awaits before the server
 * accepts traffic, so the first request after ANY CMS restart waited for all of
 * it. A PM2 memory-restart is a restart, so this was not only a deploy-time cost.
 *
 * On an already-populated database every one of those round trips is a no-op:
 * products are create-if-missing, globals seed only when unset, and the
 * migrations are one-shot. So the work that blocked the door was, in steady
 * state, work that changed nothing.
 *
 * It is now started after boot rather than awaited. Nothing here is required for
 * the CMS to serve correctly — on a fresh database the site briefly shows less
 * content and then has it, which is strictly better than not being up at all.
 */
export async function seedContentAndCatalogue(payload: Payload): Promise<void> {
  const catSlugs = new Set(ALL_SEED_CATEGORIES.map((c) => c.slug));
  const prodSlugs = new Set(seedProducts.map((p) => p.slug));

  // CATALOG OWNERSHIP = CMS STAFF (decision 2026-07-13). Boot must NEVER delete
  // or overwrite staff-managed data. So: prune only when EXPLICITLY opted in
  // (SEED_PRUNE_PLACEHOLDERS=true — a deliberate one-off, never on normal boot),
  // products are create-if-missing only, and the four settings globals seed only
  // when unset. catalog-data.ts is initial seed data, not a live source of truth.
  const allowPrune = process.env.SEED_PRUNE_PLACEHOLDERS === "true";

  // 1) (Opt-in only) remove placeholder products first (they reference categories).
  if (allowPrune) await pruneStale(payload, "products", prodSlugs);

  // 2) Upsert categories (parents before children so parent ids resolve).
  const ids: Record<string, string> = {};
  for (const c of ALL_SEED_CATEGORIES.filter((c) => !c.parentSlug)) await ensureCategory(payload, c, ids);
  for (const c of ALL_SEED_CATEGORIES.filter((c) => c.parentSlug)) await ensureCategory(payload, c, ids);

  // Departments now exist → attach their banners, then retire the ones the
  // category document dropped (empty ones only).
  await ensureCategoryImages(payload);
  await retireDepartments(payload);

  // 3) (Opt-in only) remove stale categories (now that no products reference them).
  if (allowPrune) await pruneStale(payload, "categories", catSlugs);

  // 4) Create catalog products that don't exist yet — NEVER update existing ones,
  //    so staff edits to price/stock/featured/specs/images persist across boots.
  let created = 0;
  let skipped = 0;
  for (const p of seedProducts) {
    // Per-product guard: a transient error on one product logs and continues
    // instead of aborting the whole seed (and, since seed is awaited in onInit,
    // the container boot).
    try {
      const found = await payload.find({ collection: "products", where: { slug: { equals: p.slug } }, limit: 1, depth: 0 });
      if (found.docs[0]) {
        skipped++;
        continue; // staff-owned — do not overwrite
      }
      const categoryId = ids[p.categorySlug];
      if (!categoryId) {
        payload.logger.warn(`[seed] product ${p.slug} has unknown category ${p.categorySlug} — skipped.`);
        continue;
      }
      await payload.create({
        collection: "products",
        data: {
          name: p.name, slug: p.slug, brand: p.brand, sku: p.sku, category: categoryId,
          price: p.price, mrp: p.mrp, unit: p.unit, moq: p.moq,
          inStock: p.inStock, featured: p.featured, badges: p.badges ?? [], priceTiers: p.priceTiers ?? [],
          sizes: (p.sizes ?? []).map((label) => ({ label })),
          specs: p.specs, shortDesc: p.shortDesc, _status: "published" as const,
        },
      });
      created++;
    } catch (e) {
      payload.logger.warn(`[seed] product ${p.slug} create failed: ${(e as Error).message}`);
    }
  }
  payload.logger.info(`[seed] Products: ${created} created, ${skipped} kept (staff-owned).`);

  // Settings globals: seed only when unset so staff edits are never reverted
  // (gate on a key field of each global — set on first-ever boot, preserved after).
  await seedGlobalIfUnset(payload, "company", ["name", "legalName", "tagline"], { name: "METNMAT", legalName: "METNMAT INNOVATIONS PRIVATE LIMITED", tagline: "Research. Design. Build. Scale.", description: "METNMAT supplies electrochemistry lab equipment — electrodes, membranes, cells, reactors, equipment and accessories — and turnkey materials R&D from prototype to industrial scale.", foundedYear: 2018 });
  await seedGlobalIfUnset(payload, "contact", ["email", "phone"], { email: "contact@metnmat.com", email2: "mk@metnmat.com", phone: "+91 78726 86501", whatsapp: "+91 78726 86501", shippingNote: "Shipping across India & worldwide · ISO-aligned R&D" });
  await seedGlobalIfUnset(payload, "social", ["linkedin", "youtube", "facebook", "amazon"], { linkedin: "https://in.linkedin.com/company/metnmat", youtube: "https://www.youtube.com/@metnmatresearchinnovations628", facebook: "https://www.facebook.com/metnmat", amazon: "https://www.amazon.in/l/27943762031?ie=UTF8&marketplaceID=A21TJRUUN4KGV&me=AV4YEPJ3X45CF" });
  await seedGlobalIfUnset(payload, "seo", ["defaultTitle", "description"], { defaultTitle: "METNMAT — Electrochemical Systems | Reference Electrodes | metnmat.com", titleTemplate: "%s · METNMAT", description: "Electrodes, membranes, electrochemical cells, reactors & lab equipment for research — plus turnkey materials R&D." });

  // 5) Seed website content (services / projects / posts / faqs + homepage/nav).
  await step(payload, "seedContent", () => seedContent(payload));

  // 6) Legacy copy fix-ups (exact-match, one-shot).
  await step(payload, "dropFirstFromLegacyCopy", () => dropFirstFromLegacyCopy(payload));
  await step(payload, "rebrandHomepageCopy", () => rebrandHomepageCopy(payload));
  await step(payload, "refineHeroHeadline", () => refineHeroHeadline(payload));
  await step(payload, "clearCutoverMaintenanceBanner", () => clearCutoverMaintenanceBanner(payload));
  await step(payload, "backfillPricingMode", () => backfillPricingMode(payload));

  // 7) Default the homepage featured case study (only while unset).
  await step(payload, "ensureHomepageFeaturedProject", () => ensureHomepageFeaturedProject(payload));

  // 8) Attach bundled project cover images (only while unset).
  await step(payload, "ensureProjectCovers", () => ensureProjectCovers(payload));

  // 9) Create post-migration blog articles (create-if-missing) before figures.
  await step(payload, "ensureExtraBlogArticles", () => ensureExtraBlogArticles(payload));

  // 10) Inject bundled diagrams into the seeded blog articles (only while none).
  await step(payload, "retireSupersededPumps", () => retireSupersededPumps(payload));
  await step(payload, "ensureBlogCovers", () => ensureBlogCovers(payload));
  await step(payload, "ensureBlogFigures", () => ensureBlogFigures(payload));

  // 11) Backfill MNM-U customer codes for accounts created before the field,
  //     then establish the partial-unique index backstop.
  await step(payload, "backfillCustomerCodes", () => backfillCustomerCodes(payload));
  await step(payload, "ensureUserCodeIndex", () => ensureUserCodeIndex(payload));

  payload.logger.info(`[seed] Done. ${prodSlugs.size} catalog products, ${catSlugs.size} categories.`);
}

/**
 * The whole seed, in order, awaited.
 *
 * Kept for scripts and any caller that genuinely wants to block until the
 * database is fully populated. onInit deliberately does NOT use this — see
 * seedContentAndCatalogue.
 */
export async function seed(payload: Payload): Promise<void> {
  await seedCritical(payload);
  await seedContentAndCatalogue(payload);
}
