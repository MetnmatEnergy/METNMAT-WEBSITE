import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { cn } from "@/frontend/lib/utils";

/**
 * THE single way to render a product photo.
 *
 * One uploaded master (2400×1800, 4:3, transparent) renders correctly here in
 * every location — grid, PDP gallery, thumbnails, zoom, search, cart, wishlist —
 * with no per-location cropping or re-uploading.
 *
 * Two rules make that work, and both are deliberate:
 *  - a fixed 4:3 box, so every card in a grid is exactly the same height and
 *    nothing shifts as images stream in (CLS), and
 *  - object-fit: CONTAIN, never cover. `cover` crops to fill — on a catalogue
 *    photo that silently eats the edges of the product. `contain` letterboxes
 *    instead, so the whole item is always visible whatever the source ratio.
 *
 * A missing image falls back to the site's branded placeholder at the SAME 4:3
 * box, so a product without a photo can never break grid alignment.
 *
 * ── Why a plain <img> and not next/image ──────────────────────────────────────
 * Payload already renders the whole 4:3 ladder at upload time (micro 192 · thumb
 * 320 · card 800 · pdp/display 1600 · zoom 2400 — see Media.ts). Routing those
 * through `/_next/image` made the website process re-decode a 2400×1800 master
 * with sharp on every cold width, and sharp allocates OUTSIDE the V8 heap, so
 * PM2's memory cap could not bound it: a burst of concurrent optimiser requests
 * restarted the process and Caddy served 502s. Handing the browser the CMS
 * ladder as a plain `srcset` keeps the responsive selection — the browser still
 * picks per viewport and DPR — and moves the cost to upload time, once.
 */
export function ProductImage({
  src,
  srcSet,
  alt,
  sizes = "400px",
  priority = false,
  eager = false,
  className,
  imageClassName,
  label = "Product",
}: {
  /** Absolute or CMS-relative URL. When absent, the branded placeholder renders. */
  src?: string | null;
  /** The CMS ladder as `srcset` (see mediaSrcSet). Without it `src` is used alone. */
  srcSet?: string | null;
  alt: string;
  /** Per-location responsive hint — only meaningful alongside `srcSet`. */
  sizes?: string;
  /** Only the PDP's first gallery slide should set this. */
  priority?: boolean;
  /**
   * De-lazy WITHOUT emitting a <head> preload — for an above-the-fold image
   * that only exists at SOME breakpoints. The homepage mosaic is `hidden
   * lg:block`, so `priority` there would preload a large image on mobile,
   * where it never renders and is not the LCP.
   */
  eager?: boolean;
  /** Classes for the 4:3 wrapper (rounding, background, borders). */
  className?: string;
  /** Classes for the <img> itself (e.g. padding, hover transforms). */
  imageClassName?: string;
  /** Placeholder caption when there's no image. */
  label?: string;
}) {
  if (!src) {
    return <MediaPlaceholder className={cn("aspect-[4/3]", className)} label={label} />;
  }

  return (
    <div className={cn("relative aspect-[4/3] w-full overflow-hidden", className)}>
      {/* React hoists and dedupes this into <head>, which is what next/image's
          `priority` did for us. Same selection inputs as the <img> below, so the
          preload and the element resolve to the same file. */}
      {priority && (
        <link
          rel="preload"
          as="image"
          href={src}
          {...(srcSet ? { imageSrcSet: srcSet, imageSizes: sizes } : {})}
          fetchPriority="high"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        {...(srcSet ? { srcSet, sizes } : {})}
        alt={alt}
        loading={priority || eager ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : undefined}
        className={cn("absolute inset-0 h-full w-full object-contain", imageClassName)}
      />
    </div>
  );
}
