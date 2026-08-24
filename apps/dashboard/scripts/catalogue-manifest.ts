/**
 * Turn a folder of product photographs into a manifest you can fill in.
 *
 * The images are the only thing that exists at the start of a catalogue load;
 * pricing, SKUs and categories are not in a photograph. So this reads the
 * folder, works out which files belong to the same product, and writes a JSON
 * file with those groupings already done and the commercial fields left blank
 * for you — rather than asking anyone to type 68 filenames by hand.
 *
 * Nothing here touches the database or the network. Its only output is a file.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/catalogue-manifest.ts <image-dir> [--out catalogue.json] [--merge]
 *
 * --merge  keep the values already filled in for slugs present in the existing
 *          --out file, and add only what is new. This is what makes the manifest
 *          survive a second pass when more photographs arrive later.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { slugify } from "../src/lib/blog";
import { PRODUCT_IMAGE_SPEC, checkProductMaster } from "../src/hooks/product-image-spec";

const EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".tif", ".tiff"]);

export type ManifestProduct = {
  slug: string;
  name: string;
  /** Blank fields are the ones a human has to supply; the importer refuses without them. */
  categorySlug: string;
  sku: string;
  price: number | null;
  mrp?: number | null;
  moq: number;
  unit: string;
  shortDesc: string;
  inStock: boolean;
  featured: boolean;
  /** Filenames relative to the image directory, primary first. */
  images: string[];
  /** Falls back to `name` when blank. Required on every media row by the CMS. */
  alt: string;
};

/**
 * Group files that are views of one product.
 *
 * The convention already in this catalogue is a base name plus an optional
 * trailing index — "Titanium Felt Electrode.webp", "Titanium Felt Electrode
 * 2.webp". So the group key is the base name with any trailing number removed,
 * and the unnumbered file (or the lowest number) becomes the primary image,
 * which is the one the shop grid and Open Graph tags use.
 */
export function groupKey(filename: string): { key: string; index: number } {
  const base = path.basename(filename, path.extname(filename)).trim();
  const m = base.match(/^(.*?)[\s_-]+(\d+)$/);
  if (m) return { key: m[1].trim(), index: Number(m[2]) };
  return { key: base, index: 0 };
}

/** "Zero gap photocatalyst pannel reactor" → "Zero Gap Photocatalyst Pannel Reactor" */
function titleCase(s: string): string {
  return s
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 2 && w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dir = argv.find((a) => !a.startsWith("--"));
  const outArg = argv.find((a) => a.startsWith("--out"));
  const out = outArg?.includes("=") ? outArg.split("=")[1] : argv[argv.indexOf("--out") + 1];
  const outPath = path.resolve(out && !out.startsWith("--") ? out : "catalogue.json");
  const merge = argv.includes("--merge");

  if (!dir || !fs.existsSync(dir)) {
    console.error("Usage: npx tsx scripts/catalogue-manifest.ts <image-dir> [--out catalogue.json] [--merge]");
    process.exit(2);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => EXTS.has(path.extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error(`No images in ${dir} (looked for ${[...EXTS].join(" ")}).`);
    process.exit(2);
  }

  const groups = new Map<string, { file: string; index: number }[]>();
  for (const f of files) {
    const { key, index } = groupKey(f);
    const list = groups.get(key) ?? [];
    list.push({ file: f, index });
    groups.set(key, list);
  }

  // Existing answers are worth more than anything regenerated, so a --merge run
  // reads them back before writing.
  let previous = new Map<string, ManifestProduct>();
  if (merge && fs.existsSync(outPath)) {
    try {
      const old = JSON.parse(fs.readFileSync(outPath, "utf8")) as { products?: ManifestProduct[] };
      previous = new Map((old.products ?? []).map((p) => [p.slug, p]));
      console.log(`merging with ${previous.size} product(s) already in ${path.basename(outPath)}`);
    } catch {
      console.error(`--merge: could not parse ${outPath}; refusing to overwrite it.`);
      process.exit(2);
    }
  }

  const products: ManifestProduct[] = [];
  const offSpec: string[] = [];

  for (const [key, entries] of [...groups.entries()].sort()) {
    entries.sort((a, b) => a.index - b.index);
    const name = titleCase(key);
    const slug = slugify(name);
    const prev = previous.get(slug);

    // Measure every file now, on the machine holding them, so an off-spec photo
    // is reported here — with the fix — rather than by the CMS rejecting an
    // upload a third of the way through the import.
    for (const e of entries) {
      try {
        const { width, height } = await sharp(path.join(dir, e.file)).metadata();
        if (width && height && !checkProductMaster(width, height).ok) {
          offSpec.push(`${e.file} — ${width}x${height}`);
        }
      } catch {
        offSpec.push(`${e.file} — unreadable`);
      }
    }

    products.push({
      slug,
      name: prev?.name ?? name,
      categorySlug: prev?.categorySlug ?? "",
      sku: prev?.sku ?? "",
      price: prev?.price ?? null,
      mrp: prev?.mrp ?? null,
      moq: prev?.moq ?? 1,
      unit: prev?.unit ?? "pc",
      shortDesc: prev?.shortDesc ?? "",
      inStock: prev?.inStock ?? true,
      featured: prev?.featured ?? false,
      images: entries.map((e) => e.file),
      alt: prev?.alt ?? "",
    });
  }

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        note: "Fill in categorySlug, sku, price and shortDesc. Blank price or categorySlug is refused by the importer.",
        generatedFrom: path.resolve(dir),
        products,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`\n${files.length} image(s) → ${products.length} product(s) → ${outPath}\n`);

  const needsWork = products.filter((p) => !p.price || !p.categorySlug || !p.sku);
  if (needsWork.length) {
    console.log(`${needsWork.length} product(s) still need categorySlug / sku / price:`);
    for (const p of needsWork.slice(0, 10)) console.log(`  ${p.slug}`);
    if (needsWork.length > 10) console.log(`  ... and ${needsWork.length - 10} more`);
  }

  if (offSpec.length) {
    const w = PRODUCT_IMAGE_SPEC.minWidth;
    console.log(`\n${offSpec.length} image(s) are OFF-SPEC and the CMS will reject them.`);
    console.log(`Product masters must be 4:3 and at least ${w} x ${(w * 3) / 4} px.\n`);
    for (const s of offSpec.slice(0, 12)) console.log(`  ${s}`);
    if (offSpec.length > 12) console.log(`  ... and ${offSpec.length - 12} more`);
    console.log(`\nFix all of them at once, without cropping:`);
    console.log(`  npx tsx scripts/normalize-product-images.ts "${dir}" "${dir}-normalized"`);
    console.log(`then re-run this against the -normalized folder.`);
  } else {
    console.log(`\nAll images meet the 4:3 / >=${PRODUCT_IMAGE_SPEC.minWidth}px master spec.`);
  }
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
