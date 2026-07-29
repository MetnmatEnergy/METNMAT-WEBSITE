/**
 * Normalise product photos to the site's master spec.
 *
 * Default (web):    2400 × 1800 WebP q90, TRANSPARENT canvas, artwork fitted
 *                   inside 2040 × 1530 so nothing touches the edge.
 * --amazon:         2000 × 2000 JPEG on pure white #FFFFFF for marketplaces
 *                   (Amazon requires a square, opaque white background).
 *
 * The image is never cropped — it is scaled down to fit and centred, so the
 * whole product survives whatever ratio the source was.
 *
 * Run: cd apps/dashboard && npx tsx scripts/normalize-product-images.ts <in> <out> [--amazon] [--concurrency N]
 */
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";

const WEB = { canvasW: 2400, canvasH: 1800, fitW: 2040, fitH: 1530 };
const AMAZON = { canvas: 2000, fit: 1700 };
const EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".tif", ".tiff"]);

type Row = { file: string; from: string; to: string; kb: string; note: string };

function parseArgs(argv: string[]) {
  const flags = argv.filter((a) => a.startsWith("--"));
  const pos = argv.filter((a) => !a.startsWith("--"));
  const cIdx = flags.findIndex((f) => f.startsWith("--concurrency"));
  const concurrency =
    cIdx >= 0 ? Number(flags[cIdx].split("=")[1] ?? argv[argv.indexOf(flags[cIdx]) + 1]) || 4 : 4;
  return {
    inDir: pos[0],
    outDir: pos[1],
    amazon: flags.includes("--amazon"),
    concurrency: Math.max(1, Math.min(16, concurrency)),
  };
}

async function processOne(inPath: string, outDir: string, amazon: boolean): Promise<Row> {
  const base = path.basename(inPath, path.extname(inPath));
  const src = sharp(inPath).rotate(); // honour EXIF orientation before measuring
  const meta = await src.metadata();
  const from = `${meta.width ?? "?"}×${meta.height ?? "?"}`;

  let buf: Buffer;
  let outName: string;

  if (amazon) {
    const inner = await src
      .resize(AMAZON.fit, AMAZON.fit, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    buf = await sharp({
      create: {
        width: AMAZON.canvas,
        height: AMAZON.canvas,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: inner, gravity: "centre" }])
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
    outName = `${base}.jpg`;
  } else {
    const inner = await src
      .resize(WEB.fitW, WEB.fitH, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    buf = await sharp({
      create: {
        width: WEB.canvasW,
        height: WEB.canvasH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: inner, gravity: "centre" }])
      .webp({ quality: 90 })
      .toBuffer();
    outName = `${base}.webp`;
  }

  await fs.writeFile(path.join(outDir, outName), buf);
  const kb = buf.length / 1024;
  return {
    file: outName,
    from,
    to: amazon ? `${AMAZON.canvas}×${AMAZON.canvas}` : `${WEB.canvasW}×${WEB.canvasH}`,
    kb: kb.toFixed(0),
    note: kb > 500 ? "OVER 500 KB" : "",
  };
}

async function main(): Promise<void> {
  const { inDir, outDir, amazon, concurrency } = parseArgs(process.argv.slice(2));
  if (!inDir || !outDir) {
    console.error(
      "Usage: npx tsx scripts/normalize-product-images.ts <inputDir> <outputDir> [--amazon] [--concurrency N]"
    );
    process.exit(1);
  }
  if (!existsSync(inDir)) {
    console.error(`Input directory not found: ${inDir}`);
    process.exit(1);
  }
  await fs.mkdir(outDir, { recursive: true });

  const files = (await fs.readdir(inDir))
    .filter((f) => EXTS.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(inDir, f));

  if (files.length === 0) {
    console.error(`No images found in ${inDir}`);
    process.exit(1);
  }

  console.log(
    `Normalising ${files.length} image(s) → ${
      amazon ? `${AMAZON.canvas}×${AMAZON.canvas} JPEG on white` : `${WEB.canvasW}×${WEB.canvasH} WebP, transparent`
    } (concurrency ${concurrency})\n`
  );

  const rows: Row[] = [];
  const failures: string[] = [];
  let cursor = 0;

  // Simple worker pool — keeps memory flat on a 200-image batch.
  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= files.length) return;
        try {
          rows.push(await processOne(files[i], outDir, amazon));
        } catch (e) {
          failures.push(`${path.basename(files[i])}: ${(e as Error).message}`);
        }
      }
    })
  );

  rows.sort((a, b) => a.file.localeCompare(b.file));
  const w = Math.max(4, ...rows.map((r) => r.file.length));
  console.log(`${"FILE".padEnd(w)}  ${"BEFORE".padEnd(11)}  ${"AFTER".padEnd(11)}  ${"SIZE".padStart(8)}  NOTE`);
  console.log("-".repeat(w + 42));
  for (const r of rows) {
    console.log(
      `${r.file.padEnd(w)}  ${r.from.padEnd(11)}  ${r.to.padEnd(11)}  ${(r.kb + " KB").padStart(8)}  ${r.note}`
    );
  }

  const over = rows.filter((r) => r.note).length;
  console.log(`\n${rows.length} written to ${outDir}${over ? ` · ${over} over 500 KB` : ""}`);
  if (failures.length) {
    console.log(`\n${failures.length} failed:`);
    failures.forEach((f) => console.log(`  ${f}`));
    process.exitCode = 1;
  }
}

void main();
