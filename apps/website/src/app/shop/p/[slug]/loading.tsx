import { Container } from "@/frontend/components/ui/container";
import { Skeleton, SkeletonText } from "@/frontend/components/ui/skeleton";

/** Product detail loading state — gallery + buy-box shaped skeleton. */
export default function Loading() {
  return (
    <Container className="py-8">
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="mt-4 flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-28" />
          <SkeletonText lines={3} />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </Container>
  );
}
