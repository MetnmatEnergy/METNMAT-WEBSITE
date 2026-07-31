import Image from "next/image";
import { cn } from "@/frontend/lib/utils";

/** Generic surface card (dark) used across content sections. */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 transition-colors",
        className
      )}
      {...props}
    />
  );
}

/**
 * Media block. Pass `src` once you have a real image (a path under /public,
 * e.g. "/images/furnace.jpg", or a remote URL allowed in next.config) and it
 * renders an optimized next/image. With no `src` it shows a labelled placeholder.
 */
export function MediaPlaceholder({
  className,
  label = "Image",
  src,
  alt,
  sizes = "(max-width: 768px) 100vw, 33vw",
  imageClassName,
}: {
  className?: string;
  label?: string;
  src?: string;
  alt?: string;
  sizes?: string;
  /** Extra classes for the inner next/image (e.g. "object-left" when the art's text anchors left). */
  imageClassName?: string;
}) {
  return (
    <div
      className={cn(
        "bg-grid relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40",
        className
      )}
    >
      {src ? (
        <Image src={src} alt={alt ?? label} fill sizes={sizes} className={cn("object-cover", imageClassName)} />
      ) : (
        <>
          {/* Branded placeholder: soft brand wash + watermark, instead of a flat gray box. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-brand/[0.07] via-transparent to-brand/[0.12]"
          />
          {/* The M is drawn with CSS content, not DOM text. At 4% opacity it is
              a watermark, but as real text it counted toward the visible label
              of any link wrapping this placeholder — so a card reading
              "M<product name>" never matched its accessible name and failed
              WCAG 2.5.3. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-6 select-none font-display text-[7rem] font-bold leading-none text-foreground/[0.04] before:content-['M']"
          />
          {/* Decorative filler, not a label. When this placeholder sits inside a
              link that already carries an aria-label (every product card without
              a photo — currently most of the catalogue), this span counted as
              the link's visible text and disagreed with its accessible name,
              failing WCAG 2.5.3. The card's own heading names the product. */}
          <span
            aria-hidden
            className="relative text-xs font-medium uppercase tracking-widest text-muted-foreground"
          >
            {label}
          </span>
        </>
      )}
    </div>
  );
}
