import { pageMetadata } from "@/frontend/lib/seo";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { DataRequestForm } from "@/frontend/components/legal/data-request-form";
import { getPrivacySettings } from "@/frontend/lib/cms";

export const metadata = {
  ...pageMetadata({
    title: "Exercise your data rights",
    description:
      "Submit a request under India's Digital Personal Data Protection Act, 2023 — access, correction, erasure, withdrawal of consent, nomination, or a grievance.",
    path: "/privacy/request",
  }),
  // A bare form has no informational value in results, and indexing it apart
  // from the policy only splits the signal. `follow` so /privacy still gets the
  // link equity. Matches how /search and /checkout/success are handled.
  robots: { index: false, follow: true },
};

export default async function DataRequestPage() {
  const privacy = await getPrivacySettings();

  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="Exercise your data rights"
        description="Under the Digital Personal Data Protection Act, 2023 you can ask what personal data we hold about you, have it corrected or erased, withdraw a consent you gave us, nominate someone to act on your behalf, or raise a grievance."
      />
      <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-16">
        <div>
          <DataRequestForm />
        </div>

        <aside className="space-y-6 text-sm lg:border-s lg:border-border lg:ps-8">
          <div>
            <h2 className="font-display text-base font-semibold">What happens next</h2>
            <ol className="mt-3 list-decimal space-y-2 ps-5 text-muted-foreground">
              <li>You get a reference number immediately.</li>
              <li>
                We may ask you to verify your identity. This protects you — without it, someone else
                could obtain or delete your data.
              </li>
              <li>
                We respond within <strong className="text-foreground">{privacy.responseDays} days</strong>.
              </li>
            </ol>
          </div>

          <div>
            <h2 className="font-display text-base font-semibold">Grievance Officer</h2>
            <p className="mt-2 text-muted-foreground">
              {privacy.officerName ? (
                <>
                  <span className="text-foreground">{privacy.officerName}</span>
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
                  <a href={`tel:${privacy.officerPhone.replace(/\s+/g, "")}`} className="text-muted-foreground">
                    {privacy.officerPhone}
                  </a>
                </>
              ) : null}
            </p>
          </div>

          <div>
            <h2 className="font-display text-base font-semibold">Not satisfied?</h2>
            <p className="mt-2 text-muted-foreground">
              If we do not resolve your grievance, you may complain to the Data Protection Board of
              India. Please raise it with us first — the Act expects that step before the Board will
              take it up.
            </p>
          </div>

          <div>
            <h2 className="font-display text-base font-semibold">Only want to stop analytics?</h2>
            <p className="mt-2 text-muted-foreground">
              You do not need this form. Use{" "}
              <span className="whitespace-nowrap">&ldquo;Privacy choices&rdquo;</span> in the footer
              — it takes effect immediately and erases the identifier from your browser.
            </p>
          </div>
        </aside>
      </Container>
    </>
  );
}
