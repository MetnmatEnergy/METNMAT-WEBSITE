import type { Metadata } from "next";
import Link from "next/link";
import { FileText, BadgeCheck, Truck } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { SearchBar } from "@/frontend/components/commerce/search-bar";
import { CategoryCard } from "@/frontend/components/commerce/category-card";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { GetQuoteButton } from "@/frontend/components/commerce/request-quote-button";
import { ShopShowcase } from "@/frontend/components/commerce/shop-showcase";
import { getTopCategories, getFeaturedProducts } from "@/frontend/lib/cms";

export const metadata: Metadata = {
  title: "Shop — Electrodes, Membranes, Cells & Lab Equipment",
  description:
    "Buy lab-grade electrochemistry equipment — reference/counter/working electrodes, ion-exchange membranes (PEM/AEM/BPM/CEM), electrochemical cells & reactors, peristaltic pumps, MEA fabrication presses and accessories. Bulk B2B pricing, GST invoice, pan-India + worldwide shipping.",
};

export default async function ShopHomePage() {
  const [categories, featured] = await Promise.all([
    getTopCategories(),
    getFeaturedProducts(8),
  ]);
  return (
    <>
      {/* Store title — stays at the top */}
      <section className="bg-surface/40">
        <Container className="pb-2 pt-4">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            METNMAT Store
          </h1>
        </Container>
      </section>

      {/* Brand poster / banners — moved to the top, right under the title */}
      <section className="border-b border-border bg-surface/40">
        <Container className="pb-8 pt-3">
          <ShopShowcase />
        </Container>
      </section>

      {/* Intro + search + badges — moved below the banner */}
      <section className="border-b border-border">
        <Container className="py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-muted-foreground lg:max-w-xl">
              Electrodes, membranes, electrochemical cells, reactors, lab equipment &amp;
              accessories for research labs — with bulk B2B pricing and GST invoicing.
            </p>
            <div className="w-full lg:w-[28rem] lg:flex-shrink-0">
              <SearchBar scope="products" placeholder="Search products…" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-brand" /> GST invoice</span>
            <span className="inline-flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /> India &amp; worldwide shipping</span>
            <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-brand" /> Datasheets &amp; SDS</span>
          </div>
        </Container>
      </section>

      {/* Departments */}
      <section className="section">
        <Container>
          <SectionHeading eyebrow="Browse" title="Shop by Categories" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:mt-10 lg:grid-cols-5">
            {categories.map((c) => (
              <CategoryCard key={c.slug} category={c} />
            ))}
          </div>
        </Container>
      </section>

      {/* Featured products */}
      <section className="section border-t border-border bg-surface/40">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Popular" title="Featured products" />
            <Link href="/search" className="text-sm font-medium text-foreground/90 hover:text-brand">
              View all →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:mt-10 lg:grid-cols-4">
            {featured.map((p) => (
              <CatalogProductCard key={p.slug} product={p} />
            ))}
          </div>
        </Container>
      </section>

      {/* B2B RFQ banner */}
      <section className="section">
        <Container>
          <div className="bg-hero-glow relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-10 text-center sm:px-8 sm:py-12">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Need bulk quantities or a custom spec?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Get tiered B2B pricing with a GST invoice. Share your requirement
              and we&apos;ll send a quote.
            </p>
            <div className="mt-6 flex justify-center">
              <GetQuoteButton label="Request a bulk quote" size="lg" withArrow />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
