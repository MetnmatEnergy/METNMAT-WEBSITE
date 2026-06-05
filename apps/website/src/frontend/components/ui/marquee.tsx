import { cn } from "@/frontend/lib/utils";

/**
 * Infinite horizontal marquee. Renders its children twice and slides -50%
 * so the loop is seamless. Used for the "trusted by" client strip.
 */
export function Marquee({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group relative overflow-hidden", className)}>
      <div className="flex w-max animate-marquee items-center gap-12 group-hover:[animation-play-state:paused]">
        <div className="flex shrink-0 items-center gap-12">{children}</div>
        <div className="flex shrink-0 items-center gap-12" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
