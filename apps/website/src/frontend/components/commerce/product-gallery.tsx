"use client";

import * as React from "react";
import Image from "next/image";
import { X, ZoomIn, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { cn } from "@/frontend/lib/utils";

const SLIDE_MS = 4500;

/** Extract the 11-char video id from any common YouTube URL form. */
function youTubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  return m ? m[1]! : null;
}

type Item = { kind: "image"; src: string } | { kind: "video"; id: string };

/**
 * Product gallery: auto-sliding main image (crossfade every ~4.5s, paused on
 * hover/zoom/video), prev/next arrows, thumbnails + click-to-zoom lightbox.
 * If the product has a YouTube link it's appended as a playable item — the
 * heavy iframe loads only when the customer clicks play (a lightweight facade),
 * so it never slows the page or shifts layout.
 */
export function ProductGallery({
  images,
  name,
  videoUrl,
}: {
  images: string[];
  name: string;
  videoUrl?: string;
}) {
  const videoId = youTubeId(videoUrl);
  const items = React.useMemo<Item[]>(
    () => [
      ...images.map((src) => ({ kind: "image" as const, src })),
      ...(videoId ? [{ kind: "video" as const, id: videoId }] : []),
    ],
    [images, videoId]
  );
  const imagesLen = images.length;

  const [active, setActive] = React.useState(0);
  const [zoom, setZoom] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);

  const closeBtnRef = React.useRef<HTMLButtonElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const wasOpen = React.useRef(false);

  const current = items[active] ?? null;
  const activeKind = current?.kind;
  const hasMedia = items.length > 0;
  const manyItems = items.length > 1;
  const manyImages = imagesLen > 1;

  // Manual nav cycles every item (images + video); the slideshow only images.
  const go = React.useCallback(
    (dir: 1 | -1) => setActive((a) => (a + dir + items.length) % items.length),
    [items.length]
  );
  const goImage = React.useCallback(
    (dir: 1 | -1) => setActive((a) => (imagesLen ? ((a >= imagesLen ? 0 : a) + dir + imagesLen) % imagesLen : 0)),
    [imagesLen]
  );

  // Stop the video whenever the active item is no longer the video.
  React.useEffect(() => {
    if (activeKind !== "video") setPlaying(false);
  }, [activeKind]);

  // Auto-slide the images only — never auto-jump to (or off) the video.
  React.useEffect(() => {
    if (!manyImages || zoom || hovered || playing || activeKind !== "image") return;
    const t = setInterval(() => setActive((a) => (a + 1) % imagesLen), SLIDE_MS);
    return () => clearInterval(t);
  }, [manyImages, zoom, hovered, playing, activeKind, imagesLen]);

  // Arrow-key navigation (images) + focus trap while the lightbox is open.
  React.useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      else if (e.key === "ArrowRight") goImage(1);
      else if (e.key === "ArrowLeft") goImage(-1);
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
  }, [zoom, goImage]);

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

  const zoomSrc = current?.kind === "image" ? current.src : null;

  return (
    // self-start + content-start: don't stretch to the (taller) details column —
    // otherwise the grid distributes the extra height as a huge gap between the
    // main image and the thumbnails.
    <div className="grid content-start gap-2 self-start">
      {/* Main media — 4:3 frame */}
      {hasMedia ? (
        <div
          className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-white"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Image layers (crossfade) */}
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
                activeKind === "image" && i === active ? "opacity-100" : "opacity-0"
              )}
            />
          ))}

          {/* Video layer — lazy facade: poster + play, swaps to the iframe on click */}
          {current?.kind === "video" && (
            <div className="absolute inset-0 z-20 bg-black">
              {playing ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${current.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                  title={`${name} — product video`}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="group/play relative block h-full w-full"
                  aria-label={`Play ${name} video`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://i.ytimg.com/vi/${current.id}/hqdefault.jpg`}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover/play:bg-black/40">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-xl transition-transform group-hover/play:scale-110">
                      <Play className="ml-0.5 h-7 w-7 fill-current" />
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Click-to-zoom (images only) */}
          {current?.kind === "image" && (
            <>
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
            </>
          )}

          {/* Prev / next arrows (hidden while a video is playing) */}
          {manyItems && !playing && (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-neutral-700 opacity-0 shadow-md transition-all hover:bg-white hover:text-brand group-hover:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-neutral-700 opacity-0 shadow-md transition-all hover:bg-white hover:text-brand group-hover:opacity-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Slide indicator dots */}
              <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 gap-1.5">
                {items.map((_, i) => (
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
        {hasMedia
          ? items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border bg-white transition-colors",
                  i === active ? "border-brand" : "border-border hover:border-brand/40"
                )}
                aria-label={it.kind === "video" ? "Play product video" : `View image ${i + 1}`}
              >
                {it.kind === "image" ? (
                  <Image src={it.src} alt={`${name} ${i + 1}`} fill sizes="80px" className="object-contain" />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white">
                        <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                      </span>
                    </span>
                  </>
                )}
              </button>
            ))
          : [0, 1, 2, 3, 4].map((i) => (
              <MediaPlaceholder key={i} className="aspect-square" label={`${i + 1}`} />
            ))}
      </div>

      {/* Lightbox (images only) */}
      {zoom && zoomSrc && (
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
          {manyImages && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => { e.stopPropagation(); goImage(-1); }}
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => { e.stopPropagation(); goImage(1); }}
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomSrc}
            alt={name}
            className="max-h-full max-w-full rounded-lg bg-white object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
