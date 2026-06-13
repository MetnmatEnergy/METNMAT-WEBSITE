import { Marquee } from "@/frontend/components/ui/marquee";
import {
  clients as phClients,
  eduLogos as phEduLogos,
  type Client,
  type EduLogo,
} from "@/frontend/lib/placeholder";

// All partners in one smooth sliding row, with the companies spread evenly
// among the institutions (deterministic, so SSR & client render identically).
function buildPartners(companies: Client[], institutions: EduLogo[]): { src: string; name: string }[] {
  const comp = companies.map((c) => ({ src: c.logo, name: c.name }));
  const edu = [...institutions];
  if (!comp.length) return edu;
  const gap = Math.max(1, Math.floor(edu.length / comp.length));
  const out: { src: string; name: string }[] = [];
  let ci = 0;
  edu.forEach((e, i) => {
    out.push(e);
    if (ci < comp.length && (i + 1) % gap === 0) out.push(comp[ci++]);
  });
  while (ci < comp.length) out.push(comp[ci++]);
  return out;
}

/**
 * "Trusted partners" — premium, theme-aware partner wall.
 * Full-colour partner logos (research institutes, university labs & industry)
 * sit on clean white cards so the colours stay vivid in BOTH light and dark
 * themes, and glide in one smooth, slow row. Each card lifts + gains a brand
 * ring on hover; the institute / lab name sits beneath.
 */
export function TrustedBy({
  companies = phClients,
  institutions = phEduLogos,
}: {
  companies?: Client[];
  institutions?: EduLogo[];
} = {}) {
  const partners = buildPartners(companies, institutions);
  return (
    <section className="relative isolate overflow-hidden border-y border-border bg-surface py-16 sm:py-20">
      {/* Premium depth */}
      <div className="bg-hero-glow pointer-events-none absolute inset-0 opacity-40 dark:opacity-70" />

      {/* Heading */}
      <div className="relative z-10 mx-auto mb-11 max-w-2xl px-4 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
          Trusted Partners
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Trusted by researchers &amp; industry alike
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Premier research institutes, university laboratories and industry leaders across India and
          worldwide rely on METNMAT for electrochemistry &amp; materials R&amp;D.
        </p>
        <span className="mx-auto mt-6 block h-px w-24 bg-gradient-to-r from-transparent via-brand/70 to-transparent" />
      </div>

      {/* Smooth sliding row — colour logos on white cards + names */}
      <Marquee
        durationSec={70}
        className="relative z-10 [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]"
      >
        {partners.map((p, i) => (
          <span
            key={i}
            title={p.name}
            aria-label={p.name}
            className="group/logo flex w-44 shrink-0 flex-col items-center gap-3"
          >
            <span className="flex h-[88px] w-full items-center justify-center rounded-2xl border border-black/[0.06] bg-white px-6 shadow-md ring-1 ring-black/[0.03] transition-all duration-300 group-hover/logo:-translate-y-1.5 group-hover/logo:shadow-xl group-hover/logo:ring-brand/25 dark:border-white/10 dark:shadow-[0_10px_26px_-12px_rgba(0,0,0,0.7)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={`${p.name} logo`}
                loading="lazy"
                className="h-12 w-auto max-w-full object-contain transition-transform duration-300 group-hover/logo:scale-[1.07]"
              />
            </span>
            <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight tracking-[0.02em] text-muted-foreground transition-colors duration-300 group-hover/logo:text-foreground">
              {p.name}
            </span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}
