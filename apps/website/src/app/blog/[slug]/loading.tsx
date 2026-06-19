import { Skeleton, SkeletonText } from "@/frontend/components/ui/skeleton";

/** Article skeleton — mirrors a blog post: back link, title, meta, hero, prose. */
export default function Loading() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="py-12">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-3/4" />
        <div className="mt-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <div className="mt-10 space-y-6">
        <SkeletonText lines={4} />
        <SkeletonText lines={4} />
        <SkeletonText lines={3} />
      </div>
    </article>
  );
}
