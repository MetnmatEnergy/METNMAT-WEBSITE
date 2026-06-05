"use client";

import * as React from "react";
import { X, ZoomIn } from "lucide-react";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { cn } from "@/frontend/lib/utils";

/** Product gallery: main image + thumbnails + click-to-zoom lightbox. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = React.useState(0);
  const [zoom, setZoom] = React.useState(false);
  const hasImages = images.length > 0;
  const current = hasImages ? images[active] : null;

  return (
    <div className="grid gap-3">
      {/* Main image */}
      {current ? (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="group relative block aspect-square overflow-hidden rounded-xl border border-border bg-white"
          aria-label="Zoom image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt={name} className="h-full w-full object-contain" />
          <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-4 w-4" />
          </span>
        </button>
      ) : (
        <MediaPlaceholder className="aspect-square" label="Product image" />
      )}

      {/* Thumbnails */}
      <div className="grid grid-cols-5 gap-3">
        {(hasImages ? images : [null, null, null, null, null]).slice(0, 5).map((src, i) =>
          src ? (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "aspect-square overflow-hidden rounded-lg border bg-white",
                i === active ? "border-brand" : "border-border hover:border-brand/40"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${name} ${i + 1}`} className="h-full w-full object-contain" />
            </button>
          ) : (
            <MediaPlaceholder key={i} className="aspect-square" label={`${i + 1}`} />
          )
        )}
      </div>

      {/* Lightbox */}
      {zoom && current && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
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
