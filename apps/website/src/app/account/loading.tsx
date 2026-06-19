import { Skeleton, SkeletonText } from "@/frontend/components/ui/skeleton";

/**
 * Account-area skeleton. As the `/account` segment's loading boundary it also
 * covers child routes (orders, RFQs, profile, addresses) that don't define
 * their own — a header, a few summary cards, and a list of rows.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="py-12">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-9 w-64 max-w-full" />
        <SkeletonText lines={1} className="mt-4 max-w-md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-24" />
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-b-0"
          >
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
