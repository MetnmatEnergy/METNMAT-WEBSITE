import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { Button } from "@/frontend/components/ui/button";
import { site } from "@/frontend/lib/site";
import {
  RefreshCcw,
  CalendarClock,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Ban,
  Headset,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Replacement Policy",
  description:
    "METNMAT operates a no-refund, replacement-only policy. Eligible items can be replaced within 7 days of delivery when they arrive damaged, defective, or incorrect.",
  alternates: { canonical: "/replacement-policy" },
};

const LAST_UPDATED = "13 June 2026";

const eligible = [
  "The item arrived damaged or physically broken in transit.",
  "The item is defective or does not function as specified.",
  "You received the wrong item or an incorrect quantity against your order.",
];

const notEligible = [
  "Change of mind, incorrect selection, or no-longer-required orders.",
  "Custom-built, made-to-order, or made-to-specification items.",
  "Consumables, single-use items, and items marked non-returnable.",
  "Damage caused by misuse, mishandling, improper installation, or normal wear.",
  "Items returned without original packaging, accessories, or documentation.",
  "Requests raised more than 7 days after delivery.",
];

const steps = [
  {
    title: "Raise a request within 7 days",
    body: "Open a support ticket and quote your order number. Requests must be submitted within 7 days of the delivery date.",
  },
  {
    title: "Share proof of the issue",
    body: "Attach clear photos or a short video of the item and the packaging showing the damage, defect, or incorrect product.",
  },
  {
    title: "Verification by our team",
    body: "Our team reviews the request and confirms eligibility, usually within 2 business days. We may ask for additional details.",
  },
  {
    title: "Replacement dispatched",
    body: "Once approved, we dispatch a like-for-like replacement. If an identical item is unavailable, we arrange an equivalent of the same or higher specification.",
  },
];

export default function ReplacementPolicyPage() {
  const supportEmail = site.contact.email;

  return (
    <>
      <PageHero
        eyebrow="Policy"
        title="Replacement Policy"
        description="We do not offer refunds. Instead, eligible orders are covered by a 7-day replacement policy from the date of delivery."
      />

      {/* Key points */}
      <section className="section">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <Ban className="h-6 w-6 text-brand" />
              <h2 className="mt-4 font-display text-lg font-semibold">No refunds</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                All sales are final. We do not provide monetary refunds, partial refunds, or
                credit notes. Eligible issues are resolved through replacement only.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6">
              <CalendarClock className="h-6 w-6 text-brand" />
              <h2 className="mt-4 font-display text-lg font-semibold">7-day replacement window</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Replacement requests for damaged, defective, or incorrect items must be raised
                within 7 days of delivery, with photographic proof.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Eligibility */}
      <section className="section border-t border-border bg-surface/40">
        <Container>
          <SectionHeading
            eyebrow="Scope"
            title="What the replacement policy covers"
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Eligible for replacement
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                {eligible.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <XCircle className="h-5 w-5 text-amber-500" /> Not eligible
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                {notEligible.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="section">
        <Container>
          <SectionHeading
            eyebrow="Process"
            title="How to request a replacement"
          />
          <ol className="mt-8 grid gap-5 sm:grid-cols-2">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-border bg-surface p-6">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 font-display text-sm font-semibold text-brand-soft">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Conditions */}
      <section className="section border-t border-border bg-surface/40">
        <Container className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <PackageCheck className="h-5 w-5 text-brand" /> Condition of returned items
            </h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Items must be unused and in their original, undamaged packaging.</li>
              <li>All accessories, manuals, certificates, and free items must be included.</li>
              <li>Do not discard packaging until your replacement request is resolved.</li>
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <RefreshCcw className="h-5 w-5 text-brand" /> Replacement &amp; shipping
            </h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Approved replacements are shipped at no additional cost to you.</li>
              <li>
                Replacement dispatch lead times follow the same schedule as the original order and
                may vary by item.
              </li>
              <li>
                If a replacement cannot be fulfilled, we will offer store credit toward a future
                order at our discretion. No cash refund is provided.
              </li>
            </ul>
          </div>
        </Container>
      </section>

      {/* Contact / CTA */}
      <section className="section">
        <Container>
          <div className="rounded-3xl border border-border bg-surface p-8 text-center sm:p-12">
            <Headset className="mx-auto h-8 w-8 text-brand" />
            <h2 className="mt-4 font-display text-2xl font-bold">Need to raise a replacement?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Open a support ticket with your order number and photos of the issue. Our team will
              verify eligibility and arrange your replacement.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button href="/support" size="md">
                Raise a request
              </Button>
              <Button href={`mailto:${supportEmail}`} variant="outline" size="md">
                Email {supportEmail}
              </Button>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Last updated: {LAST_UPDATED}. {site.legalName} reserves the right to update this policy
            at any time; the version shown here applies to orders placed after the date above.
          </p>
        </Container>
      </section>
    </>
  );
}
