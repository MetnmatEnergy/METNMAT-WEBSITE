import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { ProjectCard } from "@/frontend/components/cards/project-card";
import { CtaBand } from "@/frontend/components/home/cta";
import { getProjects } from "@/frontend/lib/cms";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Projects",
  description:
    "METNMAT case studies and delivered R&D projects — high-conductivity oxygen-free copper alloys, microstructure & heat-treatment optimization, and lab-to-industrial scale-ups.",
  path: "/projects",
});

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <>
      <PageHero
        eyebrow="Projects"
        title="Case studies"
        description="Selected engagements showing the problems we solved and the outcomes we delivered — from high-conductivity copper alloys to full industrial scale-ups."
      />

      <section className="section">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.slug} id={project.slug} className="scroll-mt-28">
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
