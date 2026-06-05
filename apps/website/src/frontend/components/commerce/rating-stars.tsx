import { Star } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

export function RatingStars({
  rating,
  count,
  size = 14,
  className,
}: {
  rating: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="flex items-center" aria-label={`${rating} out of 5`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={
              i < Math.round(rating)
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/40"
            }
          />
        ))}
      </span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </span>
  );
}
