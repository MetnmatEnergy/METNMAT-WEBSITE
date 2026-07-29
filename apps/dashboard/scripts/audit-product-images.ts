/**
 * Report the image health of every product: which have no photo, which are off
 * the 4:3 / ≥2400px master spec, and which are missing alt text.
 *
 * Reads through the Payload local API (same DB the site reads), so it reflects
 * exactly what customers see.
 *
 * Run: cd apps/dashboard && npx tsx scripts/audit-product-images.ts [--csv]
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, "..");
for (const line of fs.readFileSync(path.join(APP_DIR, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

import { getPayload } from "payload";
import { PRODUCT_IMAGE_SPEC, checkProductMaster } from "../src/hooks/product-image-spec";

type MediaDoc = { width?: number; height?: number; filesize?: number; alt?: string };
type Row = {
  slug: string;
  hasImage: boolean;
  count: number;
  dims: string;
  ratio: string;
  size: string;
  alt: boolean;
  flags: string[];
};

const ratioLabel = (w?: number, h?: number): string => {
  if (!w || !h) return "—";
  const { ratio, ratioOk } = checkProductMaster(w, h);
  return `${ratio.toFixed(3)}${ratioOk ? " ✓" : " ✗"}`;
};

async function main(): Promise<void> {
  const csv = process.argv.includes("--csv");
  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const res = await payload.find({
    collection: "products",
    limit: 1000,
    depth: 1,
    sort: "slug",
    overrideAccess: true,
  });

  const rows: Row[] = [];
  for (const p of res.docs as Array<{ slug?: string; images?: { image?: MediaDoc | string }[] }>) {
    const images = (p.images ?? []).filter((i) => i?.image && typeof i.image === "object");
    const first = images[0]?.image as MediaDoc | undefined;
    const flags: string[] = [];

    if (images.length === 0) flags.push("NO IMAGE");
    if (first?.width && first.height) {
      const { ratioOk, wideEnough } = checkProductMaster(first.width, first.height);
      if (!ratioOk) flags.push("NOT 4:3");
      if (!wideEnough) flags.push("TOO SMALL");
    }
    if (images.length > 0 && !first?.alt?.trim()) flags.push("NO ALT");
    if (first?.filesize && first.filesize > PRODUCT_IMAGE_SPEC.warnBytes) flags.push("OVER 500KB");

    rows.push({
      slug: p.slug ?? "(no slug)",
      hasImage: images.length > 0,
      count: images.length,
      dims: first?.width && first?.height ? `${first.width}×${first.height}` : "—",
      ratio: ratioLabel(first?.width, first?.height),
      size: first?.filesize ? `${(first.filesize / 1024).toFixed(0)} KB` : "—",
      alt: Boolean(first?.alt?.trim()),
      flags,
    });
  }

  if (csv) {
    console.log("slug,has_image,image_count,dimensions,ratio,file_size,alt_present,flags");
    for (const r of rows) {
      console.log(
        `${r.slug},${r.hasImage},${r.count},"${r.dims}","${r.ratio}","${r.size}",${r.alt},"${r.flags.join(" ")}"`
      );
    }
  } else {
    const w = Math.max(4, ...rows.map((r) => r.slug.length));
    console.log(
      `${"SLUG".padEnd(w)}  IMG  CNT  ${"DIMENSIONS".padEnd(11)}  ${"RATIO".padEnd(9)}  ${"SIZE".padStart(8)}  ALT  FLAGS`
    );
    console.log("-".repeat(w + 56));
    for (const r of rows) {
      console.log(
        `${r.slug.padEnd(w)}  ${r.hasImage ? " ✓ " : " ✗ "}  ${String(r.count).padStart(3)}  ${r.dims.padEnd(11)}  ${r.ratio.padEnd(9)}  ${r.size.padStart(8)}  ${r.alt ? " ✓ " : " ✗ "}  ${r.flags.join(", ")}`
      );
    }
  }

  const noImage = rows.filter((r) => !r.hasImage).length;
  const bad = rows.filter((r) => r.flags.some((f) => f === "NOT 4:3" || f === "TOO SMALL")).length;
  const noAlt = rows.filter((r) => r.hasImage && !r.alt).length;
  console.error(
    `\n${rows.length} product(s) · ${noImage} with no image · ${bad} off-spec · ${noAlt} missing alt text`
  );
  process.exit(0);
}

void main();
