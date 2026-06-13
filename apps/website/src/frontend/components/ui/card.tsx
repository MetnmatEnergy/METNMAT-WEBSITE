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
}: {
  className?: string;
  label?: string;
  src?: string;
  alt?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "bg-grid relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40",
        className
      )}
    >
      {src ? (
        <Image src={src} alt={alt ?? label} fill sizes={sizes} className="object-cover" />
      ) : (
        <>
          {/* Branded placeholder: soft brand wash + watermark, instead of a flat gray box. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-brand/[0.07] via-transparent to-brand/[0.12]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-6 select-none font-display text-[7rem] font-bold leading-none text-foreground/[0.04]"
          >
            M
          </span>
          <span className="relative text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        </>
      )}
    </div>
  );
}
