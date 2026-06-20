"use client";

import * as React from "react";
import Image from "next/image";
import { X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { cn } from "@/frontend/lib/utils";

const SLIDE_MS = 4500;

/**
 * Product gallery: auto-sliding main image (crossfade every ~4.5s, paused on
 * hover/zoom), prev/next arrows, thumbnails + click-to-zoom lightbox.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = React.useState(0);
  const [zoom, setZoom] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const wasOpen = React.useRef(false);
  const hasImages = images.length > 0;
  const many = images.length > 1;
  const current = hasImages ? images[active] : null;

  const go = React.useCallback(
    (dir: 1 | -1) => setActive((a) => (a + dir + images.length) % images.length),
    [images.length]
  );

  // Auto-slide; pauses while the customer is interacting (hover or zoom).
  React.useEffect(() => {
    if (!many || zoom || hovered) return;
    const t = setInterval(() => go(1), SLIDE_MS);
    return () => clearInterval(t);
  }, [many, zoom, hovered, go]);

  // Arrow-key navigation + focus trap while the lightbox is open.
  React.useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        const f = dialogRef.current?.querySelectorAll<HTMLElement>("button");
        if (!f || f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        const a = document.activeElement;
        if (!dialogRef.current?.contains(a)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && a === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && a === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, go]);

  // Move focus into the dialog on open; restore it to the trigger on close.
  React.useEffect(() => {
    if (zoom) {
      wasOpen.current = true;
      closeBtnRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [zoom]);

  return (
    // self-start + content-start: don't stretch to the (taller) details column —
    // otherwise the grid distributes the extra height as a huge gap between the
    // main image and the thumbnails.
    <div className="grid content-start gap-2 self-start">
      {/* Main image — 4:3, crossfading slides */}
      {current ? (
        <div
          className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-white"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {images.map((src, i) => (
            <Image
              key={src + i}
              src={src}
              alt={`${name} — image ${i + 1}`}
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority={i === 0}
              className={cn(
                "object-contain transition-opacity duration-700",
                i === active ? "opacity-100" : "opacity-0"
              )}
            />
          ))}

          {/* Click-to-zoom layer */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setZoom(true)}
            className="absolute inset-0 cursor-zoom-in"
            aria-label="Zoom image"
          />
          <span className="pointer-events-none absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-4 w-4" />
          </span>

          {/* Prev / next arrows */}
          {many && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-neutral-700 opacity-0 shadow-md transition-all hover:bg-white hover:text-brand group-hover:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-neutral-700 opacity-0 shadow-md transition-all hover:bg-white hover:text-brand group-hover:opacity-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Slide indicator dots */}
              <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === active ? "w-5 bg-brand" : "w-1.5 bg-neutral-300"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <MediaPlaceholder className="aspect-[4/3]" label="Product image" />
      )}

      {/* Thumbnails */}
      <div className="grid grid-cols-5 gap-2">
        {(hasImages ? images : [null, null, null, null, null]).slice(0, 5).map((src, i) =>
          src ? (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg border bg-white transition-colors",
                i === active ? "border-brand" : "border-border hover:border-brand/40"
              )}
            >
              <Image src={src} alt={`${name} ${i + 1}`} fill sizes="80px" className="object-contain" />
            </button>
          ) : (
            <MediaPlaceholder key={i} className="aspect-square" label={`${i + 1}`} />
          )
        )}
      </div>

      {/* Lightbox */}
      {zoom && current && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${name} — image viewer`}
        >
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); setZoom(false); }}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {many && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => { e.stopPropagation(); go(1); }}
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt={name}
            className="max-h-full max-w-full rounded-lg bg-white object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
