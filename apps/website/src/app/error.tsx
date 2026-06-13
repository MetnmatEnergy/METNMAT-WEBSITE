"use client";

import Link from "next/link";
import { RefreshCw, Home } from "lucide-react";

/**
 * Global error boundary — friendly, branded recovery screen instead of a
 * blank crash. Offers retry (re-renders the segment) and a way home.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 font-display text-2xl font-bold text-brand">
          M
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          An unexpected error occurred while loading this page. It&apos;s usually
          temporary — try again, or head back to the homepage.
        </p>
        {error?.digest && (
          <p className="mt-2 text-xs text-muted-foreground/60">Ref: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand/90 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-surface"
          >
            <Home className="h-4 w-4" /> Home
          </Link>
        </div>
      </div>
    </main>
  );
}
