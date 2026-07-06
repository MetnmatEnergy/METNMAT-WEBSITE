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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-metnmat.png"
        alt=""
        aria-hidden
        className="h-8 w-auto sm:h-9 dark:hidden"
        width={656}
        height={194}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-metnmat-dark.png"
        alt=""
        aria-hidden
        className="hidden h-8 w-auto sm:h-9 dark:block"
        width={656}
        height={194}
      />
    </Link>
  );
}
