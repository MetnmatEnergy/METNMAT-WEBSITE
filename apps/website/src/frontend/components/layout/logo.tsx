import Link from "next/link";
import { site } from "@/frontend/lib/site";

/**
 * Official METNMAT logo lockup. No plate — the dark-ink glyphs would vanish on
 * the dark theme, so a light-ink variant is swapped in for dark mode (red is
 * kept on both). Assets in /public. The Link carries the label, so the imgs
 * are decorative.
 */
export function Logo() {
  return (
    <Link href="/" className="flex items-center" aria-label={`${site.name} home`}>
      {/* One theme-adaptive lockup as a background-image: the browser only fetches
          the variant whose selector matches the applied theme class (set before
          paint), so we load ONE logo instead of downloading both PNGs on every
          page. aspect-[656/194] keeps the exact intrinsic ratio at h-8 / sm:h-9.
          Decorative — the Link carries the accessible name. */}
      <span
        aria-hidden
        className="block h-8 sm:h-9 aspect-[656/194] bg-[url('/logo-metnmat.png')] bg-contain bg-left bg-no-repeat dark:bg-[url('/logo-metnmat-dark.png')]"
      />
    </Link>
  );
}
