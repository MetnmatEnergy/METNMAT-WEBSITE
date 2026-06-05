import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/** Static pagination UI (wire to real paging when the catalog is data-backed). */
export function Pagination({ current = 1, total = 1 }: { current?: number; total?: number }) {
  const pages = Array.from({ length: Math.max(1, total) }, (_, i) => i + 1).slice(0, 5);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface" aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={cn(
            "h-9 min-w-9 rounded-lg border px-3 text-sm",
            p === current
              ? "border-brand bg-brand text-brand-foreground"
              : "border-border hover:bg-surface"
          )}
        >
          {p}
        </button>
      ))}
      <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface" aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
