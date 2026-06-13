import { Hero } from "@/frontend/components/home/hero";
import { TrustedBy } from "@/frontend/components/home/trusted-by";
import { ServicesPreview } from "@/frontend/components/home/services-preview";
import { FeaturedCaseStudy } from "@/frontend/components/home/featured-case-study";
import { ProductsPreview } from "@/frontend/components/home/products-preview";
import { BlogTeaser } from "@/frontend/components/home/blog-teaser";
import { Faq } from "@/frontend/components/home/faq";
import { CtaBand } from "@/frontend/components/home/cta";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/frontend/components/seo/json-ld";
import { getHomepage, getServices, getBlogPosts, getClients, getFaqs } from "@/frontend/lib/cms";

export default async function HomePage() {
  const [home, services, posts, logos, faqs] = await Promise.all([
    getHomepage(),
    getServices(),
    getBlogPosts(),
    getClients(),
    getFaqs(),
  ]);

  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />
      <Hero hero={home.hero} stats={home.stats} />
      {home.show.clients && (
        <TrustedBy companies={logos.companies} institutions={logos.institutions} />
      )}
      {home.show.services && <ServicesPreview services={services} />}
      {home.show.projects && <FeaturedCaseStudy />}
      <ProductsPreview />
      {home.show.blog && <BlogTeaser posts={posts} />}
      <Faq faqs={faqs} />
      <CtaBand />
    </>
  );
}
