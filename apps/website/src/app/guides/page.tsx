import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { JsonLd, itemListJsonLd } from "@/frontend/components/seo/json-ld";
import { GUIDES } from "@/frontend/lib/guides";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Electrochemistry Guides and Free Tools",
  description: "Practical electrochemistry guides and a free potential converter: choosing reference electrodes, PEM vs AEM, H-cells vs flow cells, and three-electrode setup.",
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <>
      <JsonLd
        data={itemListJsonLd("METNMAT electrochemistry guides", [
          { name: "Reference electrode potential converter", path: "/tools/potential-converter" },
          ...Object.entries(GUIDES).map(([slug, g]) => ({ name: g.h1, path: `/guides/${slug}` })),
        ])}
      />
      <PageHero
        eyebrow="Guides"
        title="Electrochemistry Guides and Free Tools"
        description="Plain answers to the questions researchers ask before they choose equipment."
        bordered={false}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
        ]}
      />
      <Container className="max-w-3xl pb-16">
        <ul className="divide-y divide-border border-y border-border">
          <li className="py-5">
            <Link href="/tools/potential-converter" className="font-display text-lg font-semibold hover:text-brand">
              Reference Electrode Potential Converter
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">Free tool: convert a potential to RHE, SHE or another reference electrode.</p>
          </li>
          {Object.entries(GUIDES).map(([slug, g]) => (
            <li key={slug} className="py-5">
              <Link href={`/guides/${slug}`} className="font-display text-lg font-semibold hover:text-brand">
                {g.h1}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
