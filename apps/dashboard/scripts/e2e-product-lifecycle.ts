/**
 * Phase 2I — prove a product created in the CMS reaches the website unaided.
 *
 * The acceptance criterion is end to end: an authorized employee creates a
 * product, uploads its image, publishes it, and it appears correctly on the
 * site with no code or database intervention. This exercises that chain against
 * the DEV database using the Payload LOCAL API, which is the same path the
 * admin's REST layer ultimately calls — every collection hook, every field
 * hook, validation, saveVersion and the afterChange revalidate/sync all run.
 *
 * WHAT THIS DOES NOT PROVE, stated plainly rather than implied: it does not
 * drive the authenticated admin UI. It goes through the server-side pipeline,
 * not the browser form, so it says nothing about the login screen or the React
 * admin. The employee-facing UI walkthrough remains a human step.
 *
 * It refuses to run against anything but the dev database, and it removes
 * everything it creates.
 */
import { assertTarget, loadEnv } from "./_bootstrap";

loadEnv();
/*
 * The target comes from the COMMAND LINE, not from a constant in here.
 * Hardcoding ["dev"] would have satisfied the guard while defeating it — the
 * whole point of _bootstrap's two-sided check is that the operator states which
 * database they mean and it is verified against the actual URI.
 *
 * Prod is then refused outright: this creates and deletes a product and an
 * image, which is not something to rehearse on the live catalogue.
 */
const { target, dbName } = assertTarget(process.argv.slice(2));
if (target !== "dev") {
  console.error("e2e-product-lifecycle writes and deletes test data — it runs against dev only.");
  process.exit(1);
}

/*
 * payload.config.ts reads process.env.PAYLOAD_SECRET at MODULE SCOPE, and ES
 * imports are hoisted above the loadEnv() call — so importing it statically
 * evaluated the config before the environment existed. These are deferred to
 * run time for that reason, not stylistically.
 */
import sharp from "sharp";

const STAMP = process.env.E2E_STAMP || "e2e";
const SLUG_BASE = `zz-e2e-test-product-${STAMP}`;

type Step = { name: string; ok: boolean; detail: string };
const steps: Step[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/** The website's public read path: unauthenticated REST, exactly as it fetches. */
async function publicProduct(slug: string): Promise<Record<string, unknown> | null> {
  const url = `http://localhost:3001/api/products?depth=1&limit=1&where[slug][equals]=${encodeURIComponent(slug)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { docs?: Record<string, unknown>[] };
  return json.docs?.[0] ?? null;
}

async function main(): Promise<void> {
  console.log(`\n=== Phase 2I end-to-end — database: ${dbName} ===\n`);
  const { getPayload } = await import("payload");
  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  let mediaId: string | undefined;
  let productId: string | undefined;
  let categoryId: string | undefined;

  try {
    // ── a real category to file it under ───────────────────────────────────
    const cats = await payload.find({ collection: "categories", limit: 1, overrideAccess: true });
    categoryId = String(cats.docs[0]?.id ?? "");
    check("a category exists to file the product under", Boolean(categoryId), `id ${categoryId}`);

    // ── upload an image, as the employee would ─────────────────────────────
    // 1200x900 is above the product resolution floor (shortest side >= 900).
    const png = await sharp({
      create: { width: 1200, height: 900, channels: 3, background: { r: 20, g: 90, b: 160 } },
    })
      .png()
      .toBuffer();

    const media = await payload.create({
      collection: "media",
      data: { alt: "E2E test image", category: "product" },
      file: { data: png, mimetype: "image/png", name: `${SLUG_BASE}.png`, size: png.length },
      overrideAccess: true,
    });
    mediaId = String(media.id);
    const sizes = (media as { sizes?: Record<string, { url?: string }> }).sizes ?? {};
    check("image uploads and stores", Boolean(mediaId), `filename ${(media as { filename?: string }).filename}`);
    check(
      "derivatives are generated at upload time",
      Object.keys(sizes).length > 0,
      `sizes: ${Object.keys(sizes).join(", ")}`,
    );

    // ── create as a DRAFT with a BLANK slug ────────────────────────────────
    const created = await payload.create({
      collection: "products",
      data: {
        name: `ZZ E2E Test Product ${STAMP}`,
        slug: "",
        category: categoryId,
        price: 1800,
        moq: 10,
        unit: "pc",
        productType: "in-stock",
        inStock: true,
        priceTiers: [
          { minQty: 100, price: 1450 },
          { minQty: 25, price: 1650 },
        ],
        images: [{ image: mediaId }],
        _status: "draft",
      } as never,
      overrideAccess: true,
    });
    productId = String(created.id);
    const slug = String((created as { slug?: string }).slug ?? "");
    check("a blank slug is generated from the name", slug.length > 0, slug);
    check("the generated slug is URL-safe", /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), slug);

    // ── a draft must not be public ─────────────────────────────────────────
    check("a DRAFT does not appear on the public API", (await publicProduct(slug)) === null);

    // ── publish ────────────────────────────────────────────────────────────
    await payload.update({
      collection: "products",
      id: productId,
      data: { _status: "published" } as never,
      overrideAccess: true,
    });

    const live = await publicProduct(slug);
    check("a PUBLISHED product appears on the public API", live !== null);

    if (live) {
      const cat = live.category as { slug?: string; name?: string } | string | null;
      check(
        "the category resolves through the API, not just as an id",
        typeof cat === "object" && cat !== null && Boolean(cat.name),
        typeof cat === "object" && cat ? String(cat.name) : String(cat),
      );

      const imgs = (live.images as Array<{ image?: { url?: string; sizes?: Record<string, { url?: string }> } }>) ?? [];
      const img = imgs[0]?.image;
      check("the image resolves through the API", Boolean(img?.url), String(img?.url ?? ""));
      check(
        "a display derivative is present for the storefront",
        Boolean(img?.sizes && Object.keys(img.sizes).length > 0),
        Object.keys(img?.sizes ?? {}).join(", "),
      );
      check("the price survives the round trip", Number(live.price) === 1800, String(live.price));
      check(
        "the tier rows survive the round trip",
        Array.isArray(live.priceTiers) && (live.priceTiers as unknown[]).length === 2,
      );
    }

    // ── the derivative actually loads over HTTP ────────────────────────────
    const imgUrl = (live?.images as Array<{ image?: { url?: string } }> | undefined)?.[0]?.image?.url;
    if (imgUrl) {
      const abs = imgUrl.startsWith("http") ? imgUrl : `http://localhost:3001${imgUrl}`;
      const r = await fetch(abs);
      check("the image file is actually served", r.ok, `${r.status} ${r.headers.get("content-type") ?? ""}`);
    }

    // ── the WEBSITE renders it, which is the actual acceptance criterion ───
    // Skipped rather than failed when the site is not running, so the script
    // stays useful for the CMS half alone.
    const siteRes = await fetch(`http://localhost:3000/shop/p/${slug}`).catch(() => null);
    if (siteRes) {
      /*
       * React SSR writes `<!-- -->` between adjacent JSX expressions, so
       * `{t.minQty}+ {product.unit}` arrives as `25<!-- -->+ <!-- -->pc`.
       * A naive substring check for "25+" therefore fails against a page that
       * is entirely correct — which is exactly what happened the first time
       * this ran. Strip the separators before matching text.
       */
      const html = (await siteRes.text()).replace(/<!-- -->/g, "");
      check("the website serves the product page", siteRes.ok, `HTTP ${siteRes.status}`);
      check("the page carries the product name", html.includes(`ZZ E2E Test Product ${STAMP}`));
      check("the page carries the product image", html.includes("/api/media/file/zz-e2e-test-product"));
      check(
        "the page shows the GST-inclusive base price, not the raw one",
        html.includes("2,124"),
        "1800 + 18% GST = 2124",
      );
      check(
        "the bulk table shows the lowest break first",
        html.indexOf("25+") > -1 && (html.indexOf("100+") === -1 || html.indexOf("25+") < html.indexOf("100+")),
        "tiers were stored deepest-first",
      );
      check(
        "the base row stops at the lowest break, not at the stored first row",
        html.includes("10–24") || html.includes("10-24"),
        "moq 10, lowest break 25",
      );
    } else {
      console.log("SKIP  website checks — http://localhost:3000 not reachable");
    }

    // ── editing a published product reaches the API ────────────────────────
    await payload.update({
      collection: "products",
      id: productId,
      data: { price: 1900 } as never,
      overrideAccess: true,
    });
    const edited = await publicProduct(slug);
    check("an edit to a published product reaches the API", Number(edited?.price) === 1900, String(edited?.price));

    // ── unpublishing removes it again ──────────────────────────────────────
    await payload.update({
      collection: "products",
      id: productId,
      data: { _status: "draft" } as never,
      overrideAccess: true,
    });
    check("unpublishing removes it from the public API", (await publicProduct(slug)) === null);
  } finally {
    // ── clean up: the product first, then the image it was holding ─────────
    if (productId) {
      await payload
        .delete({ collection: "products", id: productId, overrideAccess: true })
        .then(() => check("the test product deletes cleanly", true))
        .catch((e: Error) => check("the test product deletes cleanly", false, e.message));
    }
    if (mediaId) {
      await payload
        .delete({ collection: "media", id: mediaId, overrideAccess: true })
        .then(() => check("the test image deletes cleanly, leaving no orphan", true))
        .catch((e: Error) => check("the test image deletes cleanly, leaving no orphan", false, e.message));
    }
  }

  const failed = steps.filter((s) => !s.ok);
  console.log(`\n=== ${steps.length - failed.length}/${steps.length} passed ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAILED: ${f.name} ${f.detail}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("E2E ERROR:", e);
  process.exit(1);
});
