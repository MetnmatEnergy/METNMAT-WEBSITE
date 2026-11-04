import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { JsonLd, faqJsonLd } from "@/frontend/components/seo/json-ld";
import { PotentialConverter } from "@/frontend/components/tools/potential-converter";
import { REFERENCE_ELECTRODES } from "@/frontend/lib/potential-convert";
import { pageMetadata } from "@/frontend/lib/seo";
import { site } from "@/frontend/lib/site";

const PATH = "/tools/potential-converter";

export const metadata: Metadata = pageMetadata({
  title: "Reference Electrode Converter: Potential to RHE and SHE",
  description:
    "Free calculator: convert a potential from Ag/AgCl, SCE, Hg/HgO or Hg/Hg₂SO₄ to RHE and SHE, with the formula and reference electrode potentials at 25 °C.",
  path: PATH,
  keywords: ["Ag/AgCl to RHE", "Hg/HgO to RHE", "SCE to RHE", "reference electrode conversion", "RHE calculator", "potential vs RHE", "reference electrode potential table"],
});

const FAQS = [
  {
    q: "How do I convert Ag/AgCl to RHE?",
    a: "At 25 °C, E(RHE) = E(Ag/AgCl) + 0.197 V + 0.0592 × pH, for an Ag/AgCl electrode in saturated KCl. In 3 M KCl, use 0.210 V instead of 0.197 V.",
  },
  {
    q: "How do I convert Hg/HgO to RHE?",
    a: "At 25 °C, E(RHE) = E(Hg/HgO) + 0.098 V + 0.0592 × pH, using 0.098 V for Hg/HgO in 1 M KOH. In 1 M KOH the pH is about 14, so the sum is close to E(Hg/HgO) + 0.927 V.",
  },
  {
    q: "How do I convert SCE to RHE?",
    a: "At 25 °C, E(RHE) = E(SCE) + 0.241 V + 0.0592 × pH.",
  },
  {
    q: "What is the difference between SHE and RHE?",
    a: "The standard hydrogen electrode (SHE) is fixed at pH 0. The reversible hydrogen electrode (RHE) moves with the pH of your electrolyte, so results at different pH can be compared directly. That makes RHE the usual scale for electrocatalysis.",
  },
  {
    q: "Are these values exact for my electrode?",
    a: "No. They are textbook values at 25 °C, and a real electrode can differ by a few millivolts. For precise work, calibrate your reference against a reversible hydrogen electrode in your own electrolyte.",
  },
];

const toolJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Reference electrode potential converter",
  url: `${site.url}${PATH}`,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: 0, priceCurrency: "INR" },
  provider: { "@type": "Organization", "@id": `${site.url}/#organization`, name: site.legalName },
};

export default function PotentialConverterPage() {
  return (
    <>
      <JsonLd data={toolJsonLd} />
      <JsonLd data={faqJsonLd(FAQS)} />
      <PageHero
        eyebrow="Free tool"
        title="Reference Electrode Potential Converter"
        description="Convert a measured potential to RHE, SHE or another reference electrode."
        bordered={false}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: "Potential converter", path: PATH },
        ]}
      />
      <Container className="max-w-4xl pb-16">
        <PotentialConverter />

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">The formula</h2>
          <p className="mt-3 text-muted-foreground">
            A potential measured against a reference electrode converts to the reversible hydrogen electrode scale at
            25 °C with E(RHE) = E(measured) + E(reference vs SHE) + 0.0592 × pH. Without the pH term, the same sum gives
            the potential against SHE.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Reference electrode potentials at 25 °C</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Reference electrode potentials against the standard hydrogen electrode</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">Electrode</th>
                  <th scope="col" className="py-2 pr-4 font-medium">vs SHE</th>
                  <th scope="col" className="py-2 font-medium">Use in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {REFERENCE_ELECTRODES.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 text-foreground">{r.label}</td>
                    <td className="whitespace-nowrap py-2 pr-4 font-medium">{r.vsShe === 0 ? "0.000 V" : `+${r.vsShe.toFixed(3)} V`}</td>
                    <td className="py-2 text-muted-foreground">{r.useIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Textbook values. Published figures vary a little, and Ag/Ag⁺ is left out because its potential depends on the
            solvent and salt.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Frequently asked questions</h2>
          <div className="mt-5 space-y-5">
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 className="font-medium text-foreground">{f.q}</h3>
                <p className="mt-1 text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-surface/40 p-5">
          <h2 className="font-display text-lg font-bold">Need a reference electrode?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            See <Link href="/shop/c/reference-electrodes" className="text-brand-soft hover:underline">reference electrodes with prices</Link>,
            or read <Link href="/guides/reference-electrode-comparison" className="text-brand-soft hover:underline">which reference electrode to use</Link>.
          </p>
        </section>
      </Container>
    </>
  );
}
