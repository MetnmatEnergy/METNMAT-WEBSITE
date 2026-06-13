import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { Button } from "@/frontend/components/ui/button";
import { site } from "@/frontend/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing use of the METNMAT Research & Innovations website, catalog, quotes, and online orders.",
};

const LAST_UPDATED = "13 June 2026";

type Section = { heading: string; body: React.ReactNode };

export default function TermsPage() {
  const email = site.contact.email;

  const sections: Section[] = [
    {
      heading: "1. Agreement",
      body: (
        <p>
          These Terms govern your use of the {site.legalName} (&ldquo;METNMAT&rdquo;) website and our
          catalog, quotation, and ordering services. By using the site or placing an order, you agree
          to these Terms. If you are using the site on behalf of a business, you confirm you are
          authorised to do so.
        </p>
      ),
    },
    {
      heading: "2. About our products & services",
      body: (
        <p>
          METNMAT provides metallurgy &amp; materials R&amp;D solutions and supplies electrochemistry
          and laboratory equipment, primarily to businesses and institutions. Product descriptions,
          specifications, and images are provided in good faith; minor variations may occur, and some
          items are made to order or offered on a quote-only basis.
        </p>
      ),
    },
    {
      heading: "3. Quotes & orders",
      body: (
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Items marked &ldquo;On request&rdquo; / quote-only are not sold via instant checkout — request a quote and we&apos;ll confirm pricing and availability.</li>
          <li>For online orders, the price charged is computed and confirmed by us at checkout from current catalog data; placing an order is an offer that we may accept or decline (e.g. if stock or specifications change).</li>
          <li>We may cancel an order and reverse any charge if it was processed in error or could not be fulfilled.</li>
        </ul>
      ),
    },
    {
      heading: "4. Pricing, taxes & payment",
      body: (
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Prices are shown inclusive of GST where applicable. A GST invoice is provided on every order.</li>
          <li>Payments are processed securely by Razorpay. All orders are <strong>charged in Indian Rupees (INR)</strong>.</li>
          <li>Prices shown in US Dollars to international visitors are indicative for convenience only; the INR amount is the amount actually charged, and your bank sets the final converted figure.</li>
        </ul>
      ),
    },
    {
      heading: "5. Shipping",
      body: (
        <p>
          We ship across India and worldwide. Dispatch lead times vary by item and are indicated on
          the product page; bulk orders may take longer. Risk passes on delivery to your carrier or
          address as applicable.
        </p>
      ),
    },
    {
      heading: "6. Replacements — no refunds",
      body: (
        <p>
          All sales are final; we do not provide monetary refunds. Damaged, defective, or incorrect
          items are covered by our 7-day replacement policy. Please review our{" "}
          <a href="/replacement-policy" className="text-brand hover:underline">Replacement Policy</a>{" "}
          for full details and eligibility.
        </p>
      ),
    },
    {
      heading: "7. Intellectual property",
      body: (
        <p>
          All content on this site — text, images, logos, designs, and product data — is owned by or
          licensed to METNMAT and is protected by applicable laws. You may not reproduce, resell, or
          exploit it without our written permission.
        </p>
      ),
    },
    {
      heading: "8. Acceptable use",
      body: (
        <p>
          You agree not to misuse the site — including attempting to disrupt it, access it without
          authorisation, scrape it at scale, or use it for unlawful purposes.
        </p>
      ),
    },
    {
      heading: "9. Warranties & liability",
      body: (
        <p>
          Except where required by law, the site and its content are provided &ldquo;as is&rdquo; without
          warranties of any kind. Product warranties, where offered, are stated with the product or in
          your quotation. To the maximum extent permitted by law, METNMAT is not liable for indirect or
          consequential losses; our total liability for any claim is limited to the amount you paid for
          the relevant order.
        </p>
      ),
    },
    {
      heading: "10. Governing law",
      body: (
        <p>
          These Terms are governed by the laws of India, and disputes are subject to the exclusive
          jurisdiction of the competent courts of West Bengal, India.
        </p>
      ),
    },
    {
      heading: "11. Changes & contact",
      body: (
        <p>
          We may update these Terms from time to time; the &ldquo;last updated&rdquo; date below reflects the
          current version. Questions? Email{" "}
          <a href={`mailto:${email}`} className="text-brand hover:underline">{email}</a>.
        </p>
      ),
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        description="The terms that govern use of our website, catalog, quotes, and online orders."
      />
      <section className="section">
        <Container className="max-w-3xl">
          <div className="space-y-8">
            {sections.map((s) => (
              <div key={s.heading}>
                <h2 className="font-display text-lg font-semibold">{s.heading}</h2>
                <div className="mt-2 space-y-2 text-muted-foreground">{s.body}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-muted-foreground">Need clarification on these terms?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button href="/contact" size="md">Contact us</Button>
              <Button href="/replacement-policy" variant="outline" size="md">Replacement Policy</Button>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Last updated: {LAST_UPDATED}. {site.legalName}.
          </p>
        </Container>
      </section>
    </>
  );
}
