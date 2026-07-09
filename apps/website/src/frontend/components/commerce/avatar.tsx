import {
  isPhotoAvatar,
  isIllustrationAvatar,
  illustrationSrc,
  illustrationLabel,
  gradientFor,
} from "@/frontend/lib/avatar-presets";
import { cn } from "@/frontend/lib/utils";

/**
 * Renders a customer's profile picture: an uploaded photo (data URI), a bundled
 * Noto Emoji illustration on a colourful gradient, or — as a fallback — the
 * member's initial. Purely presentational, so it works in server and client
 * components alike.
 */
export function Avatar({
  value,
  name,
  email,
  sizeClass = "h-11 w-11",
  textClass = "text-lg",
  className,
}: {
  value?: string | null;
  name?: string;
  email?: string;
  sizeClass?: string;
  textClass?: string;
  className?: string;
}) {
  const base = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full", sizeClass, className);

  if (isPhotoAvatar(value)) {
    return (
      <span className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI avatar; next/image can't optimize it */}
        <img src={value!} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  if (isIllustrationAvatar(value)) {
    return (
      <span className={cn(base, "bg-gradient-to-br", gradientFor(value!))}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny bundled SVG illustration */}
        <img src={illustrationSrc(value!)} alt={illustrationLabel(value!)} className="h-[72%] w-[72%] object-contain" />
      </span>
    );
  }

  const initial = (name || email || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(base, "bg-gradient-to-br from-brand to-brand/70 font-display font-bold text-white", textClass)}
      aria-hidden
    >
      {initial}
    </span>
  );
}
