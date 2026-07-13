import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { Button } from "@/frontend/components/ui/button";
import { site } from "@/frontend/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How METNMAT Research & Innovations collects, uses, shares, and protects your personal data, and the rights you have over it.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "13 June 2026";

type Section = { heading: string; body: React.ReactNode };

export default function PrivacyPolicyPage() {
  const email = site.contact.email;

  const sections: Section[] = [
    {
      heading: "1. Who we are",
      body: (
        <p>
          {site.legalName} (&ldquo;METNMAT&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates this website and the
          associated B2B catalog and enquiry services. This policy explains what personal data we
          handle and why. For any privacy question, contact us at{" "}
          <a href={`mailto:${email}`} className="text-brand hover:underline">{email}</a>.
        </p>
      ),
    },
    {
      heading: "2. Information we collect",
      body: (
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Contact &amp; account details</strong> — name, email, phone, company, and role when you enquire, request a quote, raise a support ticket, or place an order.</li>
          <li><strong>Order &amp; billing details</strong> — shipping address, GSTIN/business name, and the items ordered. Card and bank details are entered directly with our payment partner and are never stored on our servers.</li>
          <li><strong>Enquiry &amp; support content</strong> — messages, specifications, and any files you upload for customization requests or support.</li>
          <li><strong>Technical &amp; usage data</strong> — IP address (used to detect your country for currency display), device/browser information, and basic analytics about how pages are used.</li>
          <li><strong>First-party analytics</strong> — we measure site usage ourselves (pages viewed, how you arrived, device type) using a random identifier stored in your browser. This data stays on our own systems, is never shared with advertising or third-party analytics companies, and your IP address is not stored with it.</li>
        </ul>
      ),
    },
    {
      heading: "3. How we use your information",
      body: (
        <ul className="list-disc space-y-1.5 pl-5">
          <li>To process and fulfil orders, quotes, and customization requests.</li>
          <li>To provide support and respond to your enquiries.</li>
          <li>To issue GST-compliant invoices and meet legal, tax, and accounting obligations.</li>
          <li>To operate, secure, and improve the website (including showing prices in your local currency).</li>
          <li>To send transactional emails (order confirmations, ticket updates). We do not send marketing email without your consent.</li>
        </ul>
      ),
    },
    {
      heading: "4. Who we share it with",
      body: (
        <>
          <p>We do not sell your personal data. We share it only with trusted service providers who process it on our behalf, under contract:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Payments</strong> — Razorpay, to process payments securely (PCI-DSS compliant).</li>
            <li><strong>Email</strong> — our transactional email provider, to deliver confirmations and updates.</li>
            <li><strong>Hosting &amp; storage</strong> — our cloud hosting and file-storage providers.</li>
          </ul>
          <p className="mt-2">We may also disclose data where required by law or to protect our legal rights.</p>
        </>
      ),
    },
    {
      heading: "5. Cookies & local storage",
      body: (
        <p>
          We use essential cookies and browser storage to keep the site working — for example, your
          cart, and a cached country/currency preference. These are necessary for core functionality.
          We do not use them to build advertising profiles.
        </p>
      ),
    },
    {
      heading: "6. Data retention",
      body: (
        <p>
          We keep personal data only as long as needed for the purposes above, or as required by law
          (for example, tax and invoicing records are retained for the statutory period). When no
          longer needed, data is securely deleted or anonymised.
        </p>
      ),
    },
    {
      heading: "7. Security",
      body: (
        <p>
          We apply appropriate technical and organisational measures to protect your data, including
          encrypted connections (HTTPS), access controls, and keeping payment details with our PCI-DSS
          compliant processor rather than on our own systems. No method of transmission is perfectly
          secure, but we work to protect your information.
        </p>
      ),
    },
    {
      heading: "8. Your rights",
      body: (
        <p>
          Subject to applicable law (including India&apos;s data-protection regulations), you may request
          access to, correction of, or deletion of your personal data, and may withdraw consent where
          processing is based on it. To exercise these rights, email{" "}
          <a href={`mailto:${email}`} className="text-brand hover:underline">{email}</a>. We may need to
          verify your identity before acting on a request.
        </p>
      ),
    },
    {
      heading: "9. International visitors",
      body: (
        <p>
          We are based in India and operate primarily here. If you access the site from elsewhere,
          your data may be processed in India. Prices may be shown in your local currency for
          convenience, but orders are charged in Indian Rupees (INR).
        </p>
      ),
    },
    {
      heading: "10. Changes to this policy",
      body: (
        <p>
          We may update this policy from time to time. The &ldquo;last updated&rdquo; date below reflects the
          current version; material changes will be highlighted on this page.
        </p>
      ),
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="How we collect, use, share, and protect your personal data — and the choices you have."
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
            <p className="text-muted-foreground">Questions about your data or this policy?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button href="/contact" size="md">Contact us</Button>
              <Button href={`mailto:${email}`} variant="outline" size="md">Email {email}</Button>
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
