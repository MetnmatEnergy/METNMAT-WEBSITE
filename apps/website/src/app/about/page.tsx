import type { Metadata } from "next";
import {
  ArrowRight,
  Atom,
  Workflow,
  Microscope,
  Layers,
  Zap,
  Beaker,
  FlaskConical,
  Factory,
  Wrench,
  GraduationCap,
  SlidersHorizontal,
  Gauge,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Card, MediaPlaceholder } from "@/frontend/components/ui/card";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { Reveal } from "@/frontend/components/ui/reveal";
import { HandWrittenTitle } from "@/frontend/components/ui/hand-writing-text";
import { ProcessOrbit } from "@/frontend/components/about/process-orbit";
import { AnimatedShaderBackground } from "@/frontend/components/ui/animated-shader-background";
import { getHomepage, getTeam } from "@/frontend/lib/cms";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "METNMAT Innovations — an advanced materials & engineering R&D company spanning metallurgy, materials science, electrochemistry, catalysts, membranes, reactors and custom research systems. Founded by IIT Kharagpur alumni; concept to industrial scale-up.",
  path: "/about",
});

const capabilities = [
  { icon: Atom, label: "Metallurgy & materials engineering" },
  { icon: Workflow, label: "Product & process development" },
  { icon: Microscope, label: "Materials testing & characterization" },
  { icon: Layers, label: "Alloy & composite development" },
  { icon: Zap, label: "Electrochemical systems & reactors" },
  { icon: Beaker, label: "Catalyst & membrane development" },
  { icon: FlaskConical, label: "Lab-scale prototype development" },
  { icon: Factory, label: "Industrial process scale-up" },
  { icon: Wrench, label: "Research equipment & custom systems" },
];

const why = [
  { icon: GraduationCap, title: "Founded by IIT Kharagpur alumni", body: "A research pedigree from one of the world's leading institutes, applied to real industrial problems." },
  { icon: Atom, title: "Deep materials expertise", body: "Strong command of metallurgy and materials engineering across metals, alloys and composites." },
  { icon: Wrench, title: "Applied, not academic", body: "Experience solving industrial problems — research that ends in a working result, not a report." },
  { icon: SlidersHorizontal, title: "Customized, never one-size-fits-all", body: "Every engagement is engineered around your material, process and constraints." },
  { icon: Workflow, title: "End-to-end capability", body: "Concept, design, development, validation and scale-up — supported under one roof." },
  { icon: Gauge, title: "Cost-effective & scalable", body: "Solutions designed to be practical, affordable and ready to grow with your production." },
];

const domains = ["Metallurgy", "Materials science", "Electrochemistry", "Process development"];

export default async function AboutPage() {
  const [home, team] = await Promise.all([getHomepage(), getTeam()]);
  const stats = home.stats;

  return (
    <>
      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Brand WebGL plasma (recolored red/dark), dimmed under a scrim for legibility */}
        <AnimatedShaderBackground className="absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/50 via-background/65 to-background" />
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(80%_60%_at_50%_0%,black,transparent)]" />

        <Container className="relative py-16 text-center sm:py-20 lg:py-24">
          <Reveal className="flex justify-center">
            <Badge variant="dot">About METNMAT</Badge>
          </Reveal>

          {/* Hand-drawn brand title — this is the page's single h1 */}
          <HandWrittenTitle
            title="METNMAT Innovations"
            subtitle="Turning materials science into scalable technologies."
          />

          <Reveal delay={0.1}>
            <p className="mx-auto mt-2 max-w-2xl text-base leading-relaxed text-foreground/75 sm:text-lg">
              METNMAT Innovations develops advanced materials, electrochemical systems, reactors,
              catalysts, membranes, and research equipment for industry, academia, and R&amp;D laboratories.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/contact" size="lg" className="w-full sm:w-auto">
                Start a conversation <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/services" variant="outline" size="lg" className="w-full sm:w-auto">
                Explore our services
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-x-6 border-t border-border pt-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="font-display text-2xl font-bold tracking-tight tabular-nums sm:text-3xl lg:text-4xl">
                    {s.value}
                  </dt>
                  <dd className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">{s.label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </Container>
      </section>

      {/* ───────────── Company introduction (story) ───────────── */}
      <section className="section">
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <Reveal className="order-2 lg:order-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-soft">Our story</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                From a hard materials problem to a working result
              </h2>
              <div className="mt-6 space-y-5 text-base leading-relaxed text-foreground/75">
                <p>
                  <span className="font-semibold text-foreground">METNMAT Innovations Private Limited</span> is an
                  advanced materials and engineering R&amp;D company focused on solving complex challenges in
                  metallurgy, materials science, electrochemistry, catalysts, membranes, reactors, and customized
                  research systems.
                </p>
                <p>
                  Founded by <span className="font-semibold text-foreground">IIT Kharagpur alumni</span> with strong
                  industrial and research experience, METNMAT provides customized turnkey solutions for industries,
                  research institutions, and academic laboratories — spanning applied research, product and process
                  development, materials testing and characterization, prototype development, process improvement,
                  alloy development, electrochemical system development, and industrial scale-up.
                </p>
                <p>
                  We help clients move from concept to practical implementation by combining scientific expertise,
                  engineering design, experimental validation, and manufacturing knowledge — to make advanced
                  materials research more{" "}
                  <span className="font-medium text-foreground">accessible, affordable, and scalable</span>.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="order-1 grid gap-4 lg:order-2">
              <MediaPlaceholder
                className="aspect-[16/10]"
                src="/site/factory.png"
                alt="METNMAT metallurgical processing and industrial scale-up"
                label="Industrial scale-up"
              />
              <div className="grid grid-cols-2 gap-4">
                <MediaPlaceholder
                  className="aspect-square"
                  src="/site/se.png"
                  alt="Materials characterization and electron microscopy"
                  label="Characterization"
                />
                <MediaPlaceholder
                  className="aspect-square"
                  src="/site/melted.png"
                  alt="Molten metal and advanced alloy development"
                  label="Alloy development"
                />
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ───────────── Who we are ───────────── */}
      <section className="section border-y border-border bg-surface/40">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <SectionHeading eyebrow="Who we are" title="Working at the intersection of disciplines" />
              <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/75">
                METNMAT is a private R&amp;D and engineering company working at the intersection of metallurgy,
                materials science, electrochemistry, and industrial process development. We support organizations
                that need customized materials solutions, specialized laboratory systems, and technology
                development support.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="flex flex-wrap gap-3">
                {domains.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-sm font-medium text-foreground/90"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-brand" /> {d}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ───────────── What we do (capabilities) ───────────── */}
      <section className="section">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What we do"
              title="Customized R&D, engineering & turnkey solutions"
              description="One partner across the materials and process lifecycle — from first concept to industrial production."
            />
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c, i) => (
              <Reveal key={c.label} delay={(i % 3) * 0.06}>
                <div className="group flex h-full items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-[15px] font-semibold leading-snug">{c.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── Our approach (flow) ───────────── */}
      <section className="section border-y border-border bg-surface/40">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Our approach"
              title="Concept → Design → Validation → Scale-up"
              align="center"
              className="mx-auto"
              description="A continuous orbit, not a checklist — explore each stage of how we turn a hard materials problem into a working, scalable result."
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-12">
            <ProcessOrbit />
          </Reveal>
        </Container>
      </section>

      {/* ───────────── Why METNMAT ───────────── */}
      <section className="section">
        <Container>
          <Reveal>
            <SectionHeading eyebrow="Why METNMAT" title="Built to turn research into reliable results" />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {why.map((w, i) => (
              <Reveal key={w.title} delay={(i % 3) * 0.06}>
                <Card className="group h-full transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                    <w.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-base font-semibold">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── Founder / team ───────────── */}
      <section className="section border-t border-border bg-surface/40">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <Badge variant="brand">Our people</Badge>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Founded by IIT Kharagpur alumni
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/75">
                METNMAT was founded by IIT Kharagpur alumni with strong industrial and research experience. That
                background shapes how we work — rigorous science paired with hands-on engineering, focused on
                solutions that hold up in the real world and scale on the factory floor.
              </p>
              <div className="mt-7">
                <Button href="/contact" size="md">
                  Work with our team <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="rounded-3xl border border-border bg-background/60 p-8">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <GraduationCap className="h-7 w-7" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold">IIT Kharagpur heritage</p>
                    <p className="text-sm text-muted-foreground">Research-grade rigor, industry focus</p>
                  </div>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-foreground/80">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" /> Applied research &amp; industrial
                    problem-solving
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" /> Materials, electrochemistry &amp; process
                    engineering
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" /> Concept → design → validation → scale-up
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>

          {team.length > 0 && (
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((m, i) => (
                <Reveal key={m.name} delay={(i % 4) * 0.05}>
                  <Card className="text-center">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.photoUrl}
                        alt={m.name}
                        loading="lazy"
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
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* ───────────── Contact CTA ───────────── */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="bg-hero-glow pointer-events-none absolute inset-0" />
        <Container className="relative py-16 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Have a materials, electrochemical, or research system challenge?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-foreground/75">
              Connect with METNMAT to discuss customized R&amp;D, product development, testing, or turnkey
              engineering support.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/contact" size="lg" className="w-full sm:w-auto">
                Talk to METNMAT <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/shop" variant="outline" size="lg" className="w-full sm:w-auto">
                Browse products
              </Button>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
