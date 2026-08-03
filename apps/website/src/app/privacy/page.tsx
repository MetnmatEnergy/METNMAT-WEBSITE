import { pageMetadata } from "@/frontend/lib/seo";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { Button } from "@/frontend/components/ui/button";
import { site } from "@/frontend/lib/site";
import { getPrivacySettings } from "@/frontend/lib/cms";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How METNMAT collects, uses, shares and protects your personal data, your rights under India's Digital Personal Data Protection Act, 2023, and how to exercise them.",
  path: "/privacy",
});

const LAST_UPDATED = "3 August 2026";

type Section = { heading: string; body: React.ReactNode };

export default async function PrivacyPolicyPage() {
  const email = site.contact.email;
  const privacy = await getPrivacySettings();

  const sections: Section[] = [
    {
      heading: "1. Who we are, and what this notice is",
      body: (
        <>
          <p>
            {site.legalName} (&ldquo;METNMAT&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates this
            website and the associated B2B catalogue, enquiry and order services. Under India&apos;s{" "}
            <strong className="text-foreground">Digital Personal Data Protection Act, 2023</strong>{" "}
            (the &ldquo;DPDP Act&rdquo;) we are the <em>Data Fiduciary</em> for the personal data
            described below, and you are the <em>Data Principal</em>.
          </p>
          <p className="mt-2">
            This page is our notice under section 5 of the Act: what personal data we process and
            why, how you exercise your rights, and how to complain.
          </p>
        </>
      ),
    },
    {
      heading: "2. What we collect, and the purpose for each",
      body: (
        <>
          <p>We collect only what a given purpose needs:</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-start">
                  <th scope="col" className="py-2 pe-4 text-start font-semibold text-foreground">
                    Personal data
                  </th>
                  <th scope="col" className="py-2 text-start font-semibold text-foreground">
                    Purpose it is processed for
                  </th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[
                  [
                    "Name, email, phone, company, role",
                    "To answer an enquiry, quote, support ticket or order you initiated.",
                  ],
                  [
                    "Shipping address, GSTIN / business name, items ordered",
                    "To fulfil the order and issue a GST-compliant invoice.",
                  ],
                  [
                    "Account credentials, or your Google account identifier if you sign in with Google",
                    "To create and secure your account.",
                  ],
                  [
                    "Enquiry content and any files you upload",
                    "To scope and respond to a customisation or support request.",
                  ],
                  [
                    "IP address, at the moment of the request",
                    "To detect your country for currency display and to rate-limit abuse. It is not stored against your analytics record.",
                  ],
                  [
                    "A random visitor identifier, pages viewed, referrer, device and browser type",
                    "First-party analytics — only if you accept. See section 3.",
                  ],
                ].map(([data, purpose]) => (
                  <tr key={data} className="border-b border-border/60">
                    <td className="py-2.5 pe-4 text-foreground/90">{data}</td>
                    <td className="py-2.5">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            We do not process personal data for advertising, we do not sell it, and we do not use it
            to build profiles about you.
          </p>
        </>
      ),
    },
    {
      heading: "3. Consent, and how to withdraw it",
      body: (
        <>
          <p>
            <strong className="text-foreground">Analytics runs only if you accept it.</strong> When
            you first visit we ask, and nothing is measured until you choose. Declining changes
            nothing about how the site works.
          </p>
          <p className="mt-2">
            You can change your mind at any time using{" "}
            <span className="whitespace-nowrap">&ldquo;Privacy choices&rdquo;</span> in the footer of
            every page. Withdrawing takes effect immediately and erases the identifier from your
            browser. Section 6(4) of the Act requires withdrawal to be as easy as giving consent, and
            that link is how we meet it.
          </p>
          <p className="mt-2">
            Where you give us data to complete something you asked for — an order, a quote, a support
            ticket — we process it for that purpose without a separate consent prompt, because it is
            the certain legitimate use recognised by section 7(a) of the Act. You can still ask us to
            erase it once the purpose is served.
          </p>
        </>
      ),
    },
    {
      heading: "4. Storage in your browser",
      body: (
        <>
          <p>
            The site stores a small amount of data in your browser. Only the last item below depends
            on your consent; the rest are necessary to deliver what you asked for, and are not used
            for tracking:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 ps-5">
            <li>Your cart and wishlist, so they survive a refresh.</li>
            <li>Your light/dark theme choice.</li>
            <li>Your signed-in session, if you have an account.</li>
            <li>Your country/currency preference, so prices display correctly.</li>
            <li>Your privacy choice itself, so we do not ask again on every page.</li>
            <li>
              <strong className="text-foreground">If you accepted analytics:</strong> a random
              visitor and session identifier. No name, email or IP address is stored with them.
            </li>
          </ul>
        </>
      ),
    },
    {
      heading: "5. Who we share it with",
      body: (
        <>
          <p>
            We share personal data only with processors who handle it on our behalf, under contract,
            and only for the purposes above:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 ps-5">
            <li>
              <strong className="text-foreground">Payments</strong> — Razorpay. Card and bank details
              are entered directly with them and never reach our servers.
            </li>
            <li>
              <strong className="text-foreground">Transactional email</strong> — our email delivery
              provider, for order confirmations and ticket updates.
            </li>
            <li>
              <strong className="text-foreground">Hosting, database and file storage</strong> — our
              cloud infrastructure providers.
            </li>
          </ul>
          <p className="mt-2">
            We may also disclose data where the law requires it. Our analytics are first-party: usage
            data is never sent to an advertising network or a third-party analytics company.
          </p>
        </>
      ),
    },
    {
      heading: "6. How long we keep it",
      body: (
        <p>
          We keep personal data only as long as the purpose needs, or as long as the law requires —
          invoices and tax records, for example, must be retained for the statutory period, and we
          cannot erase those on request while that obligation stands. When neither applies, the data
          is deleted or anonymised. Analytics identifiers expire from your browser as soon as you
          withdraw consent.
        </p>
      ),
    },
    {
      heading: "7. Security",
      body: (
        <p>
          We apply reasonable technical and organisational safeguards, as section 8(5) of the Act
          requires: encrypted connections (HTTPS) everywhere, role-based access control over the
          admin system, rate limiting on public endpoints, and keeping payment credentials with a
          PCI-DSS compliant processor rather than on our own systems. No system is perfectly secure,
          but if a breach affects your personal data we will notify you and the Data Protection Board
          as the Act requires.
        </p>
      ),
    },
    {
      heading: "8. Your rights, and how to use them",
      body: (
        <>
          <p>As a Data Principal you have the right to:</p>
          <ul className="mt-2 list-disc space-y-1.5 ps-5">
            <li>
              <strong className="text-foreground">Access</strong> — a summary of the personal data we
              hold about you and how we process it (s.11).
            </li>
            <li>
              <strong className="text-foreground">Correction and erasure</strong> — have inaccurate
              data corrected or completed, and have data erased where we no longer need it (s.12).
            </li>
            <li>
              <strong className="text-foreground">Grievance redressal</strong> — a readily available
              means of raising a complaint with us (s.13).
            </li>
            <li>
              <strong className="text-foreground">Nomination</strong> — nominate someone to exercise
              your rights if you die or become incapacitated (s.14).
            </li>
            <li>
              <strong className="text-foreground">Withdraw consent</strong> — at any time, as easily
              as it was given (s.6(4)).
            </li>
          </ul>
          <p className="mt-3">
            The quickest route is our request form, which records your request with a reference and a
            due date so it can be tracked to closure. You do not have to give a reason. We may ask
            you to verify your identity first — that step exists to stop someone else obtaining or
            deleting your data.
          </p>
          <div className="mt-4">
            <Button href="/privacy/request" size="md">
              Submit a data request
            </Button>
          </div>
        </>
      ),
    },
    {
      heading: "9. Grievance Officer",
      body: (
        <>
          <p>
            Section 13(3) of the Act requires us to publish a contact who answers questions about how
            we process personal data. That is:
          </p>
          <p className="mt-2">
            {privacy.officerName ? (
              <>
                <strong className="text-foreground">{privacy.officerName}</strong>
                <br />
              </>
            ) : null}
            <a
              href={`mailto:${privacy.officerEmail}`}
              className="text-brand-soft underline underline-offset-4"
            >
              {privacy.officerEmail}
            </a>
            {privacy.officerPhone ? (
              <>
                <br />
                {privacy.officerPhone}
              </>
            ) : null}
            <br />
            {site.legalName}, {site.addresses[0]?.lines.join(", ")}
          </p>
          <p className="mt-3">
            We aim to respond within {privacy.responseDays} days. If we do not resolve your
            grievance, you may complain to the{" "}
            <strong className="text-foreground">Data Protection Board of India</strong>. The Act
            expects you to raise it with us first.
          </p>
        </>
      ),
    },
    {
      heading: "10. Children",
      body: (
        <p>
          This is a business-to-business site for laboratory and industrial buyers. It is not
          directed at children, and we do not knowingly collect the personal data of anyone under 18.
          Section 9 of the Act requires verifiable parental consent before processing a child&apos;s
          data and prohibits tracking or behavioural advertising directed at children — we do neither.
          If you believe a child has given us personal data, contact the Grievance Officer above and
          we will erase it.
        </p>
      ),
    },
    {
      heading: "11. Visitors outside India",
      body: (
        <p>
          We are established in India and process personal data here. If you visit from elsewhere,
          your data is processed in India. Prices may be displayed in your local currency for
          convenience, but orders are charged in Indian Rupees (INR).
        </p>
      ),
    },
    {
      heading: "12. Changes to this notice",
      body: (
        <p>
          We may update this notice. The date below reflects the current version. If a change
          materially alters why or how we process personal data that you consented to, we will ask
          for your consent again rather than rely on the old one.
        </p>
      ),
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="How we collect, use, share and protect your personal data — your rights under the DPDP Act, 2023, and how to exercise them."
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Privacy Policy", path: "/privacy" }]}
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
            <p className="text-muted-foreground">
              Want to access, correct or erase your data, or withdraw consent?
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button href="/privacy/request" size="md">
                Submit a data request
              </Button>
              <Button href={`mailto:${privacy.officerEmail}`} variant="outline" size="md">
                Email the Grievance Officer
              </Button>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Last updated: {LAST_UPDATED}. {site.legalName}. Contact:{" "}
            <a href={`mailto:${email}`} className="underline underline-offset-4">
              {email}
            </a>
          </p>
        </Container>
      </section>
    </>
  );
}
