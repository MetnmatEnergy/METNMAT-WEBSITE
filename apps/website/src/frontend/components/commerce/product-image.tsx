import Image from "next/image";
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
 */
export function ProductImage({
  src,
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
  alt: string;
  /** Per-location responsive hint — see the table in the PR description. */
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
  /** Classes for the <Image> itself (e.g. padding, hover transforms). */
  imageClassName?: string;
  /** Placeholder caption when there's no image. */
  label?: string;
}) {
  if (!src) {
    return <MediaPlaceholder className={cn("aspect-[4/3]", className)} label={label} />;
  }

  return (
    <div className={cn("relative aspect-[4/3] w-full overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        // Leave `loading` undefined when priority is set — next/image throws on
        // priority combined with an explicit loading value.
        loading={!priority && eager ? "eager" : undefined}
        className={cn("object-contain", imageClassName)}
      />
    </div>
  );
}
