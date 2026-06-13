import { cn } from "@/frontend/lib/utils";

/**
 * Infinite horizontal marquee. Renders its children twice and slides -50%
 * so the loop is seamless. GPU-accelerated (will-change), pauses on hover, and
 * respects reduced-motion. `durationSec` controls speed (higher = slower/smoother).
 */
export function Marquee({
  children,
  className,
  durationSec = 40,
}: {
  children: React.ReactNode;
  className?: string;
  durationSec?: number;
}) {
  return (
    <div className={cn("group relative overflow-hidden", className)}>
      <div
        className="animate-marquee flex w-max items-center gap-14 [animation-timing-function:linear] [will-change:transform] group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: `${durationSec}s` }}
      >
        <div className="flex shrink-0 items-center gap-14">{children}</div>
        <div className="flex shrink-0 items-center gap-14" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
