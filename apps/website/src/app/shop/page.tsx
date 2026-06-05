import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, BadgeCheck, Truck } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { SearchBar } from "@/frontend/components/commerce/search-bar";
import { CategoryCard } from "@/frontend/components/commerce/category-card";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { deals } from "@/frontend/lib/catalog";
import { getTopCategories, getFeaturedProducts } from "@/frontend/lib/cms";

export const metadata: Metadata = {
  title: "Shop — Lab Equipment, Materials & Consumables",
  description:
    "Buy lab-grade equipment, crucibles, instruments, consumables and materials. Bulk B2B pricing, GST invoice, pan-India + worldwide shipping.",
};

export default async function ShopHomePage() {
  const [categories, featured] = await Promise.all([
    getTopCategories(),
    getFeaturedProducts(8),
  ]);
  return (
    <>
      {/* Catalog hero + search */}
      <section className="border-b border-border bg-surface/40">
        <Container className="py-10">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            METNMAT Store
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Lab equipment, crucibles, instruments, consumables &amp; materials —
            with bulk B2B pricing and GST invoicing.
          </p>
          <div className="mt-6 max-w-2xl">
            <SearchBar />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-brand" /> GST invoice</span>
            <span className="inline-flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /> India &amp; worldwide shipping</span>
            <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-brand" /> Datasheets &amp; SDS</span>
          </div>
        </Container>
      </section>

      {/* Deals strip */}
      <section className="border-b border-border">
        <Container className="grid gap-4 py-6 md:grid-cols-3">
          {deals.map((d) => (
            <Link
              key={d.title}
              href={d.href}
              className="bg-hero-glow group flex items-center justify-between rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-brand/40"
            >
              <span>
                <span className="block font-display font-semibold">{d.title}</span>
                <span className="text-sm text-muted-foreground">{d.subtitle}</span>
              </span>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-brand" />
            </Link>
          ))}
        </Container>
      </section>

      {/* Departments */}
      <section className="section">
        <Container>
          <SectionHeading eyebrow="Browse" title="Shop by Categories" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <CatalogProductCard key={p.slug} product={p} />
            ))}
          </div>
        </Container>
      </section>

      {/* B2B RFQ banner */}
      <section className="section">
        <Container>
          <div className="bg-hero-glow relative overflow-hidden rounded-3xl border border-border bg-surface px-8 py-12 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Need bulk quantities or a custom spec?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Get tiered B2B pricing with a GST invoice. Share your requirement
              and we&apos;ll send a quote.
            </p>
            <Link
              href="/quote"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Request a bulk quote <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
