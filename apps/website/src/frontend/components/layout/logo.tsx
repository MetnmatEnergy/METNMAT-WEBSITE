import Link from "next/link";
import { site } from "@/frontend/lib/site";

/**
 * Official METNMAT logo lockup (red + black on a white plate so it stays
 * visible on both the dark and light themes). Asset in /public.
 */
export function Logo() {
  return (
    <Link href="/" className="flex items-center" aria-label={`${site.name} home`}>
      <span className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-metnmat.png"
          alt={`${site.legalName} logo`}
          className="h-8 w-auto sm:h-9"
          width={163}
          height={48}
        />
      </span>
    </Link>
  );
}
