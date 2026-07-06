import path from "path";
import { existsSync } from "fs";
import type { Payload } from "payload";
import { seedCategories, seedProducts } from "./catalog-data";
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
  ids: Record<string, string>
): Promise<void> {
  const parent = c.parentSlug ? ids[c.parentSlug] : undefined;
  const found = await payload.find({ collection: "categories", where: { slug: { equals: c.slug } }, limit: 1 });
  if (found.docs[0]) {
    ids[c.slug] = String(found.docs[0].id);
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
  ids[c.slug] = String(doc.id);
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
      data: { alt: coverAlt ?? "" },
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
      await payload.create({
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
 * Director / super-admin bootstrap — env-driven so no credential is ever
 * committed to git. On boot, when DIRECTOR_EMAIL + DIRECTOR_PIN are set, ensure
 * that account exists as an ACTIVE super-admin. It is created through the local
 * API (not a raw insert), so the PIN-derived password is hashed with the real
 * production pepper — meaning the 4-digit PIN sign-in works in prod. When
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
      where: { or: [{ email: { equals: email } }, { pin: { equals: pin } }] },
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
      await payload.update({
        collection: "users",
        id: directorId,
        data: { name, email, pin, roles: ["super-admin"] },
        overrideAccess: true,
      });
      payload.logger.warn(
        `[seed] director super-admin ensured: ${email}${docs.length > 1 ? ` (removed ${docs.length - 1} duplicate match(es))` : ""}`,
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

export async function seed(payload: Payload): Promise<void> {
  await ensureSuperAdmin(payload);
  await ensureDirectorAccount(payload);
  await scrubPinBearingEmails(payload);
  await cleanupMalformed(payload);

  const catSlugs = new Set(seedCategories.map((c) => c.slug));
  const prodSlugs = new Set(seedProducts.map((p) => p.slug));

  // 1) Remove placeholder/stale products first (they reference categories).
  await pruneStale(payload, "products", prodSlugs);

  // 2) Upsert categories (parents before children so parent ids resolve).
  const ids: Record<string, string> = {};
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

  await payload.updateGlobal({ slug: "company", data: { name: "METNMAT", legalName: "METNMAT INNOVATIONS PRIVATE LIMITED", tagline: "India's private Metallurgy & Materials R&D", description: "METNMAT supplies electrochemistry lab equipment — electrodes, membranes, cells, reactors, equipment and accessories — and turnkey materials R&D from prototype to industrial scale.", foundedYear: 2018 } });
  await payload.updateGlobal({ slug: "contact", data: { email: "contact@metnmat.com", email2: "mk@metnmat.com", phone: "+91 78726 86501", whatsapp: "+91 78726 86501", shippingNote: "Shipping across India & worldwide · ISO-aligned R&D", addresses: [{ label: "West Bengal", line: "Howrah, West Bengal, India" }] } });
  await payload.updateGlobal({ slug: "social", data: { linkedin: "https://in.linkedin.com/company/metnmat", youtube: "https://www.youtube.com/@metnmatresearchinnovations628", facebook: "https://www.facebook.com/metnmat", amazon: "https://www.amazon.in/l/27943762031?ie=UTF8&marketplaceID=A21TJRUUN4KGV&me=AV4YEPJ3X45CF" } });
  await payload.updateGlobal({ slug: "seo", data: { defaultTitle: "METNMAT — Electrochemical Systems | Reference Electrodes | metnmat.com", titleTemplate: "%s · METNMAT", description: "Electrodes, membranes, electrochemical cells, reactors & lab equipment for research — plus turnkey materials R&D." } });

  // 5) Seed website content (services / projects / posts / faqs + homepage/nav).
  await seedContent(payload);

  // 6) Legacy copy fix-ups (exact-match, one-shot).
  await dropFirstFromLegacyCopy(payload);

  payload.logger.info(`[seed] Done. ${prodSlugs.size} catalog products, ${catSlugs.size} categories.`);
}
