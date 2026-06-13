/** Download mapped product images from Supabase to _img_tmp (run with Bun). */
import path from "node:path";
import { mkdir } from "node:fs/promises";

const S3 = new Bun.S3Client({
  endpoint: process.env.SUPABASE_S3_ENDPOINT!,
  region: process.env.SUPABASE_S3_REGION!,
  accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  bucket: process.env.SUPABASE_BUCKET!,
  virtualHostedStyle: false,
});

const KEYS = [
  "shop banner.png",
  "shop banner 2.png",
  "shop by categories/electrodes.png",
  "shop by categories/Membranes.png",
  "shop by categories/Reactors & Cells.png",
  "shop by categories/Equipments.png",
  "shop by categories/Accessories.png",
];

function safeName(key: string): string {
  return key.replace(/^products\//, "").replace(/[:()/\\]/g, "_").replace(/\s+/g, " ").trim();
}

const TMP = path.join(import.meta.dir, "_img_tmp");
await mkdir(TMP, { recursive: true });
for (const key of KEYS) {
  const buf = await S3.file(key).arrayBuffer();
  await Bun.write(path.join(TMP, safeName(key)), buf);
  console.log("OK", safeName(key), buf.byteLength);
}
console.log("DOWNLOAD DONE");
