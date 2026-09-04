/**
 * Server-to-server catalog reads that need more than the public API exposes.
 * Never reachable from the browser: the internal key lives only in this
 * process. Same shape as blog.service.ts.
 */
import { outboundKey } from "@/backend/lib/internal-key";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const KEY = () => outboundKey("CMS_PREVIEW_KEY");

/**
 * The latest DRAFT version of a product, for the admin Preview flow.
 *
 * The public product API only ever returns `_status: published` — which is why
 * previewing an unpublished product used to 404. `draft=true` makes Payload
 * query the versions collection and return the newest version per document.
 * depth=1 matches getProductBySlug(), so the preview maps through exactly the
 * same normaliser. Mirrors getDraftArticleRaw().
 */
export async function getDraftProductRaw(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const params = new URLSearchParams({
      draft: "true",
      depth: "1",
      limit: "1",
      "where[slug][equals]": slug,
    });
    const res = await fetch(`${CMS}/api/products?${params}`, {
      headers: { "x-internal-key": KEY() },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { docs?: Record<string, unknown>[] };
    return data.docs?.[0] ?? null;
  } catch {
    return null;
  }
}
