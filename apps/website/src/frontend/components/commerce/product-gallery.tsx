"use client";

import * as React from "react";
import { useVisibleInViewport } from "@/frontend/lib/use-visible-in-viewport";
import { X, ZoomIn, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { ProductImage } from "@/frontend/components/commerce/product-image";
import { cn } from "@/frontend/lib/utils";

const SLIDE_MS = 4500;

// Slot widths for the browser's srcset pick: the stage is full-bleed on mobile
// and a 640px column on desktop; the lightbox is capped at max-w-5xl.
const STAGE_SIZES = "(max-width: 768px) 100vw, 640px";
const ZOOM_SIZES = "(max-width: 768px) 100vw, 1024px";

/** Extract the 11-char video id from any common YouTube URL form. */
function youTubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  return m ? m[1]! : null;
}

type Item = { kind: "image"; src: string; srcSet?: string } | { kind: "video"; id: string };

/**
 * Product gallery: auto-sliding main image (crossfade every ~4.5s, paused on
 * hover/zoom/video), prev/next arrows, touch swipe, thumbnails + click-to-zoom
 * lightbox with a caption (the image's CMS alt) and a position counter.
 * If the product has a YouTube link it's appended as a playable item — the
 * heavy iframe loads only when the customer clicks play (a lightweight facade),
 * so it never slows the page or shifts layout.
 *
 * Entirely data-driven: images, their order and their alt text come from the
 * product's CMS record — nothing here is specific to any one product.
 */
export function ProductGallery({
  images,
  fulls,
  fullSrcSets,
  srcSets,
  alts,
  name,
  videoUrl,
}: {
  /** Display URLs (subject-aware 4:3 derivatives) for stage, thumbs, crossfade. */
  images: string[];
  /** Widest UNCROPPED file per image, index-aligned — the complete photograph. */
  fulls?: string[];
  /**
   * The uncropped ladder per image as a `srcset`, for the lightbox only. Kept
   * separate from `srcSets` because that one includes the composed `display`
   * derivative — a subject-aware crop for product photography, and the widest
   * entry whenever the source was uploaded under 2400px. Omit it and the
   * lightbox uses `fulls` alone, which is still the complete photograph; it
   * must never silently fall back to `srcSets`.
   */
  fullSrcSets?: string[];
  /**
   * The CMS variant ladder per image as a `srcset`, index-aligned. Payload
   * generated every entry at upload, so the browser picks the right file for the
   * slot without the website process re-encoding anything. See mediaSrcSet().
   */
  srcSets?: string[];
  /** Media alt per image, index-aligned with `images` (optional, from the CMS). */
  alts?: string[];
  name: string;
  videoUrl?: string;
}) {
  const videoId = youTubeId(videoUrl);
  const items = React.useMemo<Item[]>(
    () => [
      ...images.map((src, i) => ({ kind: "image" as const, src, srcSet: srcSets?.[i] })),
      ...(videoId ? [{ kind: "video" as const, id: videoId }] : []),
    ],
    [images, srcSets, videoId]
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

  // Real media alt from the CMS when present; a neutral fallback otherwise.
  const altFor = React.useCallback(
    (i: number) => alts?.[i]?.trim() || `${name} — image ${i + 1}`,
    [alts, name]
  );

  // Touch swipe (main stage + lightbox), pointer-based — no library. The
  // surfaces set touch-action pan-y so vertical scrolling stays native while
  // horizontal gestures reach us; a recognised swipe suppresses the click that
  // follows it, so swiping never doubles as "open the lightbox" or "play".
  const rootRef = React.useRef<HTMLDivElement>(null);
  // Auto-advance only while the gallery is on screen in a foreground tab.
  const visible = useVisibleInViewport(rootRef);
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null);
  const swipedRef = React.useRef(false);
  const onSwipeDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const makeSwipeUp = (nav: (dir: 1 | -1) => void) => (e: React.PointerEvent) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s || e.pointerType === "mouse") return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipedRef.current = true;
      nav(dx < 0 ? 1 : -1);
    }
  };

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

  /*
   * Auto-slide the images only — never auto-jump to (or off) the video.
   *
   * Also only while someone can actually see it. The timer used to run for the
   * life of the page: a product tab left open in the background kept advancing
   * its gallery, re-rendering and decoding the next image every 4.5 s forever.
   * And reduced motion now stops the automatic advance, matching the sibling
   * shop carousel — the arrows and thumbnails still work, so nothing is lost.
   */
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  React.useEffect(() => {
    if (!manyImages || zoom || hovered || playing || activeKind !== "image") return;
    if (!visible || reduceMotion) return;
    const t = setInterval(() => setActive((a) => (a + 1) % imagesLen), SLIDE_MS);
    return () => clearInterval(t);
  }, [manyImages, zoom, hovered, playing, activeKind, imagesLen, visible, reduceMotion]);

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

  // The lightbox shows the COMPLETE photograph, so the src and the srcset both
  // come from the uncropped side of the CMS ladder (mediaVariants'
  // `uncroppedOnly`). `srcSets` includes the composed `display` derivative,
  // which is a subject-aware crop; for any source under 2400px wide it is the
  // widest candidate, so using it here handed the browser a cropped upscale in
  // the one view that promises the whole photo. No fallback to `srcSets`:
  // absent `fullSrcSets` means no srcset, and `zoomSrc` alone is correct.
  const zoomSrc = current?.kind === "image" ? fulls?.[active] || current.src : null;
  const zoomSrcSet = current?.kind === "image" ? fullSrcSets?.[active] : undefined;

  return (
    // self-start + content-start: don't stretch to the (taller) details column —
    // otherwise the grid distributes the extra height as a huge gap between the
    // main image and the thumbnails.
    <div ref={rootRef} className="grid content-start gap-2 self-start">
      {/* Main media — 4:3 frame */}
      {hasMedia ? (
        <div
          className="group relative aspect-[4/3] touch-pan-y overflow-hidden rounded-xl border border-border bg-white"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onPointerDown={onSwipeDown}
          onPointerUp={makeSwipeUp(go)}
        >
          {/* Image layers (crossfade) */}
          {images.map((src, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={src + i}
              src={src}
              {...(srcSets?.[i] ? { srcSet: srcSets[i], sizes: STAGE_SIZES } : {})}
              alt={altFor(i)}
              loading={i === 0 ? "eager" : "lazy"}
              decoding={i === 0 ? "sync" : "async"}
              fetchPriority={i === 0 ? "high" : undefined}
              className={cn(
                "absolute inset-0 h-full w-full object-contain transition-opacity duration-700",
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
                  onClick={() => {
                    if (swipedRef.current) { swipedRef.current = false; return; }
                    setPlaying(true);
                  }}
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
                onClick={() => {
                  if (swipedRef.current) { swipedRef.current = false; return; }
                  setZoom(true);
                }}
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
                  // Square thumb frame is the existing design; ProductImage's
                  // contain keeps the 4:3 master whole inside it (letterboxed,
                  // never cropped). aspect-square wins over the component's
                  // default 4:3 via twMerge.
                  <ProductImage
                    src={it.src}
                    srcSet={it.srcSet}
                    alt={altFor(i)}
                    sizes="128px"
                    className="aspect-square h-full w-full"
                  />
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
          {/* Zoom view: the complete photograph at the CMS `zoom` derivative
              (2400×1800), with the ladder as srcset so a phone still gets a
              sensibly sized file. No card or backing behind it — catalogue
              masters carry their own background, so the enlargement is just the
              photograph on the scrim. */}
          <div
            className="relative h-full w-full max-w-5xl touch-pan-y"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onSwipeDown}
            onPointerUp={makeSwipeUp(goImage)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomSrc}
              {...(zoomSrcSet ? { srcSet: zoomSrcSet, sizes: ZOOM_SIZES } : {})}
              alt={altFor(active)}
              decoding="async"
              className="absolute inset-0 h-full w-full rounded-lg object-contain"
            />
          </div>

          {/* Position counter only. The alt text stays on the <Image> for
              screen readers, but printing the product name over the enlarged
              photograph just covers the thing the reader zoomed in to see. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-1.5 px-16 text-center">
            {manyImages && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-white/80">
                {Math.min(active + 1, imagesLen)} / {imagesLen}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
