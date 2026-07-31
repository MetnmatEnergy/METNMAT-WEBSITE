"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";

/**
 * An image that genuinely waits until it is needed.
 *
 * `loading="lazy"` is not as lazy as it reads. Chrome fetches anything within
 * roughly 1250 px of the viewport, so on /shop all ten category tiles — sitting
 * 134–1093 px below the fold — were pulled in the same burst as the LCP hero
 * banner. Measured at Lighthouse's mobile width that is ~202 KB competing with a
 * 36 KB banner for the same pipe, which is what pushed LCP out.
 *
 * So the <img> is kept out of the DOM entirely until after the load event, at
 * which point a real IntersectionObserver arms and reveals it on approach. The
 * wrapper reserves the exact box the image will occupy, so nothing shifts — CLS
 * stays at 0.
 *
 * Only worth using for images that are reliably below the fold. Anything that
 * could be the LCP element should stay a plain next/image with `priority`.
 */
// `alt` is destructured rather than left in the spread so it is visibly
// required at this boundary — ImageProps already enforces it, but a linter
// reading `{...props}` cannot see that.
export function DeferredImage({ className, alt, ...props }: ImageProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (show) return;
    let io: IntersectionObserver | undefined;

    const arm = () => {
      const el = ref.current;
      // No observer support (or the node vanished) — just show it rather than
      // leaving a permanently blank box.
      if (!el || typeof IntersectionObserver === "undefined") {
        setShow(true);
        return;
      }
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setShow(true);
            io?.disconnect();
          }
        },
        // Start fetching a screen early so it is decoded by the time it scrolls in.
        { rootMargin: "300px 0px" }
      );
      io.observe(el);
    };

    // Wait for load so this never competes with the LCP element.
    if (document.readyState === "complete") {
      arm();
    } else {
      window.addEventListener("load", arm, { once: true });
    }

    return () => {
      window.removeEventListener("load", arm);
      io?.disconnect();
    };
  }, [show]);

  return (
    <span ref={ref} className="absolute inset-0 block">
      {show ? <Image className={className} alt={alt} {...props} /> : null}
    </span>
  );
}
