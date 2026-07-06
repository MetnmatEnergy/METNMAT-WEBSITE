"use client";

import { useRef, useState } from "react";
import { cn } from "@/frontend/lib/utils";

/**
 * InfoCard — image card whose border is a conic gradient that tracks the
 * cursor, with a brand-colour wipe over the title on hover. Adapted from the
 * provided 21st.dev component to this codebase: site theme tokens instead of
 * hardcoded colours (light/dark aware), fluid width instead of fixed 388px,
 * <img> error fallback to a brand gradient, and h3 semantics inside sections.
 */
export function InfoCard({
  image,
  title,
  description,
  className,
}: {
  image?: string;
  title: string;
  description: string;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const borderRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = borderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const angle = Math.atan2(
      e.clientY - rect.top - rect.height / 2,
      e.clientX - rect.left - rect.width / 2,
    );
    el.style.setProperty("--rotation", `${angle}rad`);
  };

  return (
    <div
      ref={borderRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        borderRef.current?.style.setProperty("--rotation", "0deg");
      }}
      className={cn("group h-full rounded-2xl p-[3px]", className)}
      style={{
        backgroundOrigin: "border-box",
        backgroundImage:
          "conic-gradient(from var(--rotation, 0deg), hsl(var(--brand)) 0deg, hsl(var(--brand)) 90deg, hsl(var(--border)) 90deg, hsl(var(--border)) 360deg)",
      }}
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-[13px] bg-surface"
        style={{
          backgroundImage:
            "linear-gradient(45deg, rgba(127,127,127,0.05) 25%, transparent 25%, transparent 75%, rgba(127,127,127,0.05) 75%), linear-gradient(-45deg, rgba(127,127,127,0.05) 25%, transparent 25%, transparent 75%, rgba(127,127,127,0.05) 75%)",
          backgroundSize: "21px 21px",
        }}
      >
        <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-44">
          {image && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              aria-hidden
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              aria-hidden
              className="h-full w-full bg-gradient-to-br from-brand/25 via-brand/10 to-transparent"
            />
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3
            className="relative w-fit overflow-hidden font-display text-lg font-semibold leading-snug"
            style={{
              color: hovered ? "hsl(var(--brand-foreground))" : "hsl(var(--foreground))",
              transition: "color 0.3s ease",
            }}
          >
            <span className="relative z-10 px-1">{title}</span>
            <span
              aria-hidden
              className="absolute -inset-y-0.5 inset-x-0 z-0"
              style={{
                backgroundColor: "hsl(var(--brand))",
                clipPath: hovered
                  ? "polygon(0 0, 100% 0, 100% 100%, 0 100%)"
                  : "polygon(0 50%, 100% 50%, 100% 50%, 0 50%)",
                transition: "clip-path 0.4s cubic-bezier(0.1, 0.5, 0.5, 1)",
              }}
            />
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
