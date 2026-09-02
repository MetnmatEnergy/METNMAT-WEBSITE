"use client";

import dynamic from "next/dynamic";
import type { CardItem } from "./card-fan-carousel";

/**
 * GSAP, off the critical path.
 *
 * `card-fan-carousel.tsx` imports gsap statically and /services imported it
 * directly, so ~29 KB gzip of animation engine sat in that route's initial
 * JavaScript for a fanned deck of images.
 *
 * Safe to defer: the deck is a showcase sitting under an `sr-only` heading, and
 * every service name and description is separately rendered as real HTML in the
 * grid further down the same page — so nothing here is what a crawler reads.
 */
const CardFanCarousel = dynamic(() => import("./card-fan-carousel"), {
  ssr: false,
  // Reserves the deck's height so the content below does not jump when it
  // arrives. Matches the component's own min-height.
  loading: () => <div aria-hidden className="min-h-[420px] w-full" />,
});

export function LazyCardFanCarousel({ cards }: { cards: CardItem[] }) {
  return <CardFanCarousel cards={cards} />;
}

export default LazyCardFanCarousel;
