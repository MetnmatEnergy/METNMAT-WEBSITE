import type { Metadata } from "next";
import { Hero } from "@/frontend/components/home/hero";
import { TrustedBy } from "@/frontend/components/home/trusted-by";
import { ServicesPreview } from "@/frontend/components/home/services-preview";
import { FeaturedProjectsCarousel } from "@/frontend/components/home/featured-projects-carousel";
import { ProductsPreview } from "@/frontend/components/home/products-preview";
import { BlogTeaser } from "@/frontend/components/home/blog-teaser";
import { Faq } from "@/frontend/components/home/faq";
import { CtaBand } from "@/frontend/components/home/cta";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/frontend/components/seo/json-ld";
import { getHomepage, getServices, getClients, getFaqs, getProjects } from "@/frontend/lib/cms";
import { listBlogArticlesForFeed } from "@/frontend/lib/blog";

// Self-canonical for the homepage. The root layout no longer forces canonical
// "/" on every route (Next merges metadata down the tree), so each page sets its own.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [home, services, posts, logos, faqs, projects] = await Promise.all([
    getHomepage(),
    getServices(),
    // Same source as the /blog listing — latest public articles, covers included.
    listBlogArticlesForFeed(3).catch(() => []),
    getClients(),
    getFaqs(),
    getProjects().catch(() => []),
  ]);

  // Homepage projects carousel shows EVERY public project, cross-fading through
  // them so visitors see the full breadth of our work. The CMS-selected project
  // (else the first flagged Featured, else the first) leads the deck, preserving
  // the old "featured case study" behaviour as slide one. Only public projects
  // reach here (getProjects filters to published + active).
  const lead =
    projects.find((p) => p.slug === home.featuredProjectSlug) ??
    projects.find((p) => p.featured) ??
    projects[0];
  const orderedProjects = lead
    ? [lead, ...projects.filter((p) => p.slug !== lead.slug)]
    : projects;

  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />
      <Hero hero={home.hero} stats={home.stats} />
      {home.show.clients && (
        <TrustedBy companies={logos.companies} institutions={logos.institutions} />
      )}
      {home.show.services && <ServicesPreview services={services} />}
      {home.show.projects && orderedProjects.length > 0 && (
        <FeaturedProjectsCarousel projects={orderedProjects} />
      )}
      <ProductsPreview />
      {home.show.blog && <BlogTeaser posts={posts} />}
      <Faq faqs={faqs} />
      <CtaBand />
    </>
  );
}
