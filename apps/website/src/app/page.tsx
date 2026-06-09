import { Hero } from "@/frontend/components/home/hero";
import { TrustedBy } from "@/frontend/components/home/trusted-by";
import { ServicesPreview } from "@/frontend/components/home/services-preview";
import { FeaturedCaseStudy } from "@/frontend/components/home/featured-case-study";
import { ProductsPreview } from "@/frontend/components/home/products-preview";
import { BlogTeaser } from "@/frontend/components/home/blog-teaser";
import { Faq } from "@/frontend/components/home/faq";
import { CtaBand } from "@/frontend/components/home/cta";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/frontend/components/seo/json-ld";

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />
      <Hero />
      <TrustedBy />
      <ServicesPreview />
      <FeaturedCaseStudy />
      <ProductsPreview />
      <BlogTeaser />
      <Faq />
      <CtaBand />
    </>
  );
}
