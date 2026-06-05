import { Marquee } from "@/frontend/components/ui/marquee";
import { clients } from "@/frontend/lib/placeholder";

export function TrustedBy() {
  return (
    <section className="border-b border-border bg-background py-10">
      <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Trusted by India&apos;s leading metals &amp; manufacturing companies
      </p>
      <Marquee>
        {clients.map((c, i) => (
          <span
            key={`${c.name}-${i}`}
            className="text-xl font-semibold text-muted-foreground/70"
          >
            {c.name}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
