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
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
