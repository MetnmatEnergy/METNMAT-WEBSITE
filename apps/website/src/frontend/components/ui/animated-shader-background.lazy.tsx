"use client";

import dynamic from "next/dynamic";

/**
 * three.js, off the critical path.
 *
 * WHAT WAS WRONG
 * `animated-shader-background.tsx` imports all of three.js statically, and
 * /about imported it directly. Because the page is a Server Component the whole
 * library landed in that route's initial JavaScript: /about shipped 415 KB gzip
 * against a 280 KB site baseline, and the browser had to download and parse
 * ~127 KB of WebGL engine before it could hydrate a page whose actual content is
 * text.
 *
 * The background is decorative — it renders at opacity 60 behind a heading — so
 * it has no SEO value and nothing depends on it being in the HTML. Loading it
 * after hydration costs the visitor nothing and takes the library out of the
 * initial download entirely.
 *
 * `ssr: false` is why this file exists at all: it is not permitted in a Server
 * Component, so the boundary has to be a client module.
 */
const AnimatedShaderBackground = dynamic(
  () => import("./animated-shader-background").then((m) => m.AnimatedShaderBackground),
  {
    ssr: false,
    // A still gradient in the same palette, so the hero is never a blank box
    // while the shader loads and there is no visible pop when it arrives.
    loading: () => (
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(216,31,38,0.18),transparent_60%)]"
      />
    ),
  }
);

export function LazyShaderBackground({ className }: { className?: string }) {
  return <AnimatedShaderBackground className={className} />;
}

export default LazyShaderBackground;
