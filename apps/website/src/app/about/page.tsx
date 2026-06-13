import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { Card, MediaPlaceholder } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { CtaBand } from "@/frontend/components/home/cta";
import { getHomepage, getTeam } from "@/frontend/lib/cms";
import {
  Microscope,
  Cpu,
  Atom,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
  Handshake,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "METNMAT Research & Innovations — India's first private R&D company delivering customized turnkey solutions in Metallurgy & Materials, from lab-scale prototype to industrial scale.",
};

const expertise = [
  {
    icon: Microscope,
    title: "Microstructure Control & Heat Treatment",
    body: "Tuning volume fraction, morphology and phase distribution to engineer multi-phase microstructures for target properties.",
  },
  {
    icon: Cpu,
    title: "Modeling & Simulations",
    body: "Process and product design backed by advanced computational modeling and simulation before a single sample is made.",
  },
  {
    icon: Atom,
    title: "Advanced Alloy Development",
    body: "Developing materials like our oxygen-free, high-strength electrical copper alloy reaching 91–93% IACS conductivity.",
  },
];

const values = [
  {
    icon: Lightbulb,
    title: "Innovation first",
    body: "We stay current with industry trends and advancements so our solutions are always a step ahead.",
  },
  {
    icon: ShieldCheck,
    title: "Quality & reliability",
    body: "Rigorous, repeatable processes and benchmarking ensure every solution meets real-world demands.",
  },
  {
    icon: Handshake,
    title: "True partnership",
    body: "Turnkey, end-to-end collaboration — we own the problem with you from prototype to industrial scale.",
  },
];

export default async function AboutPage() {
  const [home, team] = await Promise.all([getHomepage(), getTeam()]);
  const stats = home.stats;
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="India's first private R&D in Metallurgy & Materials"
        description="METNMAT Research & Innovations provides customized turnkey solutions to the problems industries face in Metallurgy & Materials — from lab-scale prototype to full industrial scale."
      />

      {/* Story */}
      <section className="section">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title="Our story" />
            <div className="mt-5 space-y-4 text-muted-foreground">
              <p>
                METNMAT is a leading private R&amp;D company that gives the Metallurgy and Materials
                industries tailored, problem-first solutions. Where most labs stop at a report, we
                take ideas all the way from a lab-scale prototype to a working, industrial-scale process.
              </p>
              <p>
                Our expert team of researchers and engineers combines deep materials science with
                hands-on process engineering — covering product &amp; process development, applied
                research and consultancy, quality improvement, benchmarking, heat treatment and simulation.
              </p>
              <p>
                The result is turnkey solutions that make our partners&apos; processes better in cost,
                quality and efficiency — trusted by leading names like Tata Steel, Vedanta, JSL,
                Eastern Copper and Mescab.
              </p>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href="/services" size="md">Explore our services</Button>
              <Button href="/contact" variant="outline" size="md">Talk to our team</Button>
            </div>
          </div>
          <div className="grid gap-4">
            <MediaPlaceholder
              className="aspect-[16/9]"
              src="/site/factory.png"
              alt="Metallurgical furnace with a materials microstructure analysis"
              label="Metallurgy"
            />
            <MediaPlaceholder
              className="aspect-[16/9]"
              src="/site/se.png"
              alt="Computational simulation of a materials process"
              label="Research & simulation"
            />
          </div>
        </Container>
      </section>

      {/* Stats */}
      <section className="section border-y border-border bg-surface/40">
        <Container>
          <dl className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-display text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                  {s.value}
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Expertise */}
      <section className="section">
        <Container>
          <SectionHeading
            eyebrow="Specialized expertise"
            title="Where we go deep"
            description="Focused capabilities that turn hard materials problems into manufacturable solutions."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {expertise.map((e) => (
              <Card key={e.title} className="group transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                  <e.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{e.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Values */}
      <section className="section border-t border-border bg-surface/40">
        <Container>
          <SectionHeading
            eyebrow="What drives us"
            title="Our values"
            align="center"
            className="mx-auto"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v) => (
              <Card key={v.title} className="group transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <v.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-lg font-semibold">{v.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
              </Card>
            ))}
          </div>
          <p className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
            Customized, turnkey, end-to-end — that&apos;s how we work on every engagement.
          </p>
        </Container>
      </section>

      {/* Team (only renders when the CMS has members) */}
      {team.length > 0 && (
        <section className="section">
          <Container>
            <SectionHeading
              eyebrow="Our people"
              title="Meet the team"
              description="The researchers and engineers behind METNMAT."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((m) => (
                <Card key={m.name} className="text-center">
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photoUrl}
                      alt={m.name}
                      className="mx-auto h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand/10 font-display text-2xl font-bold text-brand">
                      {m.name.charAt(0)}
                    </span>
                  )}
                  <h3 className="mt-4 font-display text-base font-semibold">{m.name}</h3>
                  {m.role && <p className="text-sm text-brand-soft">{m.role}</p>}
                  {m.bio && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.bio}</p>}
                </Card>
              ))}
            </div>
          </Container>
        </section>
      )}

      <CtaBand />
    </>
  );
}
