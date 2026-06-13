import { cn } from "@/frontend/lib/utils";

/** Shimmer placeholder block used by route loading states (CLS-safe). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-muted/60", className)}
    />
  );
}

/** A few lines of "text". */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Standard content-card skeleton (image + text) for grid pages. */
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <Skeleton className="aspect-video rounded-none" />
      <div className="space-y-3 p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-full" />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

/** Full-page grid skeleton: page-hero strip + N cards. */
export function SkeletonGridPage({ cards = 6 }: { cards?: number }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="py-12">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-10 w-72 max-w-full" />
        <SkeletonText lines={2} className="mt-4 max-w-xl" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
