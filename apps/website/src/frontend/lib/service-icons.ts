import {
  Cpu,
  Factory,
  Flame,
  Gauge,
  Lightbulb,
  Microscope,
  Rocket,
  Target,
  type LucideIcon,
} from "lucide-react";

/**
 * The CMS `Services.icon` select value → the icon it names.
 *
 * Shared rather than copied. This lived inside `service-card-stack.tsx`, and a
 * second surface rendering the same services needed the same mapping — two
 * copies of a lookup is how the two drift and one silently starts falling back
 * to the default icon for a value the other renders fine.
 */
export const SERVICE_ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  lightbulb: Lightbulb,
  gauge: Gauge,
  target: Target,
  flame: Flame,
  cpu: Cpu,
  microscope: Microscope,
  factory: Factory,
};

/** The icon for a CMS value, falling back rather than rendering nothing. */
export function serviceIcon(name?: string): LucideIcon {
  return (name && SERVICE_ICONS[name]) || Rocket;
}

/**
 * How to break `count` cards into bento rows, widest row first.
 *
 * The layout has to survive whatever the CMS returns — services are editable,
 * and a grid tuned to exactly eight would leave an orphan card stranded in a
 * half-empty row the day someone adds a ninth. So rows are computed instead of
 * hardcoded, and every row is FULL: rows of three, with rows of two absorbing
 * the remainder.
 *
 *   n % 3 == 0  →  all threes
 *   n % 3 == 2  →  one two, then threes
 *   n % 3 == 1  →  two twos, then threes   (a single leftover is never left)
 *
 * Two and one are special-cased because they cannot be built from the above.
 * Eight — today's count — gives [2, 3, 3]: a wide feature row over two even
 * rows, with no gaps.
 */
export function bentoRows(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  if (count === 2) return [2];
  if (count === 4) return [2, 2];

  const remainder = count % 3;
  const twos = remainder === 0 ? [] : remainder === 2 ? [2] : [2, 2];
  const used = twos.reduce((n, r) => n + r, 0);
  const threes = Array.from({ length: (count - used) / 3 }, () => 3);

  return [...twos, ...threes];
}

/** Tailwind column span for a card sitting in a row of `size`, on a 6-col grid. */
export function bentoSpan(size: number): string {
  if (size === 1) return "lg:col-span-6";
  if (size === 2) return "lg:col-span-3";
  return "lg:col-span-2";
}
