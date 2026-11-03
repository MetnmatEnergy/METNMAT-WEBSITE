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
 */
const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const MAX_BYTES = 20 * 1024 * 1024;

export async function GET(req: Request) {
  // The raw path, not params: params arrive decoded, and the CMS needs the
  // filename exactly as encoded in the feed.
  const segment = new URL(req.url).pathname.slice(IMAGE_PATH.length + 1);
  const file = mediaFileForImageSegment(segment);
  if (!file) return new Response("Not found", { status: 404 });

  const upstream = await fetch(`${CMS}/api/media/file/${file}`, { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok) return new Response("Not found", { status: upstream?.status === 404 ? 404 : 502 });
  if (!upstream.headers.get("content-type")?.startsWith("image/")) return new Response("Not found", { status: 404 });
  if (Number(upstream.headers.get("content-length") || 0) > MAX_BYTES) {
    return new Response("Too large", { status: 502 });
  }

  let jpeg: Buffer;
  try {
    jpeg = await sharp(Buffer.from(await upstream.arrayBuffer()), { limitInputPixels: 64_000_000 })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    return new Response("Unreadable image", { status: 502 });
  }

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpeg.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
