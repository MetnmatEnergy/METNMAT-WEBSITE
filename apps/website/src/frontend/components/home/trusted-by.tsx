import { Marquee } from "@/frontend/components/ui/marquee";
import { eduLogos } from "@/frontend/lib/placeholder";

/**
 * "Trusted partners" — a clean, professional light band.
 * Colour institution logos float directly on the white background (each logo's
 * white backing blends in, so there are no boxes — only the logo + its name),
 * auto-sliding. Names sit beneath; logos scale gently on hover.
 */
export function TrustedBy() {
  return (
    <section className="relative overflow-hidden border-y border-black/[0.06] bg-white py-16 sm:py-20">
      {/* Heading */}
      <div className="mx-auto mb-11 max-w-2xl px-4 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-black/45">
          Trusted Partners
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#0f1012] sm:text-3xl">
          In good company
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-black/55">
          Powering research at IITs, IISc, IISERs, Manipal &amp; universities worldwide — alongside
          India&apos;s leading metals &amp; manufacturing companies.
        </p>
        <span className="mx-auto mt-6 block h-px w-24 bg-gradient-to-r from-transparent via-brand/70 to-transparent" />
      </div>

      {/* Colour logos — no boxes, just logo + name */}
      <Marquee className="[mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]">
        {eduLogos.map((l, i) => (
          <span
            key={i}
            title={l.name}
            aria-label={l.name}
            className="group/logo flex w-44 shrink-0 flex-col items-center gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={l.src}
              alt={`${l.name} logo`}
              loading="lazy"
              className="h-16 w-auto max-w-full object-contain transition-transform duration-300 group-hover/logo:scale-[1.08]"
            />
            <span className="line-clamp-2 w-full text-center text-[10px] font-medium uppercase leading-tight tracking-[0.07em] text-black/50 transition-colors duration-300 group-hover/logo:text-black/80">
              {l.name}
            </span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}
