import { cn } from "@/frontend/lib/utils";
import { rulerTicks, rulerWindow, type RulerWindow } from "@/frontend/lib/potential-convert";

/**
 * One scale of the slide rule. The ticks are laid out once around the scale's
 * own zero, and the whole strip moves by a single transform, so changing the
 * electrode or dragging the pH slider slides the ruler instead of redrawing it.
 */
function Scale({ zero, view, flip }: { zero: number; view: RulerWindow; flip?: boolean }) {
  const span = view.max - view.min;
  const left = (volts: number) => `${((volts - view.min) / span) * 100}%`;
  return (
    <div className="relative h-9 overflow-hidden">
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${(zero / span) * 100}%)` }}
      >
        {rulerTicks(view, zero).map((t) => (
          <span key={t.volts} className="absolute inset-y-0" style={{ left: left(t.volts) }}>
            <span
              className={cn(
                "absolute -translate-x-1/2",
                flip ? "bottom-0" : "top-0",
                t.volts === 0 ? "h-4 w-0.5 bg-background" : t.label ? "h-3 w-px bg-background/70" : "h-1.5 w-px bg-background/40",
              )}
            />
            {t.label && (
              <span
                className={cn(
                  "absolute -translate-x-1/2 text-[0.6875rem] leading-none tabular-nums",
                  flip ? "bottom-[1.15rem]" : "top-[1.15rem]",
                  t.volts === 0 ? "font-bold text-background" : "text-background/70",
                )}
              >
                {t.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

type Reading = { label: string; zero: number; reading: string };

/**
 * Two rulers on one axis, read through one cursor, like a slide rule. The top
 * ruler is numbered from the reference you measured against and the bottom one
 * from the scale you want. The cursor reads the same point on both, which is
 * all a conversion is: the same potential, counted from a different zero.
 */
export function PotentialRuler({ point, top, bottom }: { point: number; top: Reading; bottom: Reading }) {
  const view = rulerWindow([point, top.zero, bottom.zero]);
  const cursor = ((point - view.min) / (view.max - view.min)) * 100;
  return (
    <figure
      className="m-0"
      role="img"
      aria-label={`Slide rule: this potential reads ${top.reading} on the ${top.label} scale and ${bottom.reading} on the ${bottom.label} scale.`}
    >
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-background/70">{top.label}</span>
        <span className="shrink-0 font-medium tabular-nums">{top.reading}</span>
      </div>
      <div className="relative my-1.5 border-y border-background/25">
        <Scale zero={top.zero} view={view} />
        <div className="h-px bg-background/25" />
        <Scale zero={bottom.zero} view={view} flip />
        <span
          aria-hidden
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-brand transition-[left] duration-300 ease-out motion-reduce:transition-none"
          style={{ left: `${cursor}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-background/70">{bottom.label}</span>
        <span className="shrink-0 font-medium tabular-nums">{bottom.reading}</span>
      </div>
    </figure>
  );
}
