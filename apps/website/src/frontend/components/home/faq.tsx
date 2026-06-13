import { ChevronDown } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { JsonLd, faqJsonLd } from "@/frontend/components/seo/json-ld";

/** Concise, factual Q&A — good for users and for AI answer engines (GEO).
 *  Used as the fallback when the CMS has no FAQ entries. */
const DEFAULT_FAQS = [
  {
    q: "What does METNMAT Research & Innovations do?",
    a: "METNMAT is India's first private metallurgy & materials R&D company. We deliver customized turnkey solutions — from lab-scale prototype to full industrial scale — across product and process development, applied research, benchmarking, heat treatment and simulation.",
  },
  {
    q: "What products can I buy from METNMAT?",
    a: "Our shop offers lab-grade electrochemistry equipment: electrodes (reference, counter and working), ion-exchange membranes (PEM, AEM, bipolar and cation), electrochemical cells & reactors, lab equipment (peristaltic pumps, MEA fabrication presses, specialised research setups) and accessories — with bulk B2B pricing and GST invoicing.",
  },
  {
    q: "Do you ship across India and worldwide?",
    a: "Yes. We ship across India and worldwide, with a GST invoice provided on every order.",
  },
  {
    q: "Can I request a customized product?",
    a: "Yes. Use the 'Request for Customization' option on any product to share your design, size, material and quantity — you can also attach PDFs or photos — and our team will get back to you with a quote.",
  },
  {
    q: "What is your oxygen-free high-strength copper alloy?",
    a: "It is a copper alloy developed by METNMAT using alloying, rapid quenching, de-oxidation, 60–90% cold reduction and aging treatment to achieve 91–93% IACS electrical conductivity together with high strength.",
  },
];

export function Faq({ faqs }: { faqs?: { q: string; a: string }[] } = {}) {
  const items = faqs && faqs.length ? faqs : DEFAULT_FAQS;
  return (
    <section className="section border-t border-border">
      <Container>
        <JsonLd data={faqJsonLd(items)} />
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Quick answers about METNMAT, our products and how we work."
        />
        <div className="mx-auto mt-8 max-w-3xl divide-y divide-border rounded-2xl border border-border bg-surface/40">
          {items.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-semibold">
                {f.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
