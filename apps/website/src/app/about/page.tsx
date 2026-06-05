import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { Card, MediaPlaceholder } from "@/frontend/components/ui/card";
import { CtaBand } from "@/frontend/components/home/cta";
import { stats } from "@/frontend/lib/placeholder";

export const metadata: Metadata = {
  title: "About",
  description: "About METNMAT Research & Innovations.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="About METNMAT"
        description="Short positioning statement about who the company is. Replace with approved copy."
      />

      {/* Story */}
      <section className="section">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title="Our story" />
            {/* TODO(content): company history / mission narrative. */}
            <div className="mt-5 space-y-4 text-muted-foreground">
              <p>Paragraph one — what the company does and why it exists.</p>
              <p>Paragraph two — milestones, scope, and approach.</p>
            </div>
          </div>
          <MediaPlaceholder className="aspect-[4/3]" label="About image" />
        </Container>
      </section>

      {/* Stats */}
      <section className="section border-y border-border bg-surface/40">
        <Container>
          <dl className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-display text-4xl font-bold">{s.value}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Values */}
      <section className="section">
        <Container>
          <SectionHeading
            eyebrow="What drives us"
            title="Our values"
            align="center"
            className="mx-auto"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                {/* TODO(content): value title + description. */}
                <h3 className="font-display text-lg font-semibold">Value {i}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  One or two lines describing this value.
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
