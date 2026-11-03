import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { IMAGE_PATH, mediaFileForImageSegment } from "@/frontend/lib/merchant-feed";

/**
 * JPEG copy of a CMS product photo, for the Merchant Center feed only — see
 * merchantImageUrl() in frontend/lib/merchant-feed.ts for why.
 *
 * /merchant-image/<cms media filename>.jpg → the CMS file at
 * /api/media/file/<cms media filename>, flattened onto white (Google shows a
 * transparent area as black or grey) and re-encoded as JPEG. CMS media
 * filenames never change for a given upload, so the copy caches for a year.
 *
 * The web host is 2 burstable vCPUs that also serve the shop, and nothing
 * caches in front of it: converting all 342 feed photos at once on 2026-11-03
 * took the home page from 0.2 s to 3 s. So each file is converted once and kept
 * on disk (the unit's private /tmp, emptied on restart), conversions run one at
 * a time, and the encoder is plain libjpeg (mozjpeg cost 3× the CPU).
 */
const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const MAX_BYTES = 20 * 1024 * 1024;
const CACHE_DIR = path.join(tmpdir(), "merchant-image");

let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

const readCached = (file: string) => readFile(file).catch(() => null);

/** The JPEG, or the HTTP status to answer with instead. */
async function convert(file: string, cached: string): Promise<Buffer | number> {
  // A request queued behind another for the same photo finds it done.
  const done = await readCached(cached);
  if (done) return done;

  const upstream = await fetch(`${CMS}/api/media/file/${file}`, { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok) return upstream?.status === 404 ? 404 : 502;
  if (!upstream.headers.get("content-type")?.startsWith("image/")) return 404;
  if (Number(upstream.headers.get("content-length") || 0) > MAX_BYTES) return 502;

  let jpeg: Buffer;
  try {
    jpeg = await sharp(Buffer.from(await upstream.arrayBuffer()), { limitInputPixels: 64_000_000 })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return 502;
  }
  // Best effort: without the cache the route still works, only slower.
  await mkdir(CACHE_DIR, { recursive: true })
    .then(() => writeFile(cached, jpeg))
    .catch(() => undefined);
  return jpeg;
}

export async function GET(req: Request) {
  // The raw path, not params: params arrive decoded, and the CMS needs the
  // filename exactly as encoded in the feed.
  const segment = new URL(req.url).pathname.slice(IMAGE_PATH.length + 1);
  const file = mediaFileForImageSegment(segment);
  if (!file) return new Response("Not found", { status: 404 });

  const cached = path.join(CACHE_DIR, `${createHash("sha256").update(file).digest("hex")}.jpg`);
  const jpeg = (await readCached(cached)) ?? (await oneAtATime(() => convert(file, cached)));
  if (typeof jpeg === "number") return new Response(jpeg === 404 ? "Not found" : "Unavailable", { status: jpeg });

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpeg.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
