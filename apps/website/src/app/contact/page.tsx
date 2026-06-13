import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock, MessageCircle } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { Card } from "@/frontend/components/ui/card";
import { ContactForm } from "@/frontend/components/commerce/contact-form";
import { site } from "@/frontend/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with METNMAT Research & Innovations — discuss a materials R&D project, request a quote, or visit our offices in West Bengal and Odisha.",
};

// Address used for the embedded map (West Bengal HQ).
const MAP_QUERY = "Jalan Industrial Complex, Domjur, Howrah, West Bengal 711411";

export default function ContactPage() {
  const phone1 = site.contact.phone.replace(/\s/g, "");

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Let's solve it together"
        description="Tell us about your materials challenge or product requirement — the right specialist at METNMAT will get back to you."
      />

      <section className="section">
        <Container className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          {/* Form */}
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Send us a message</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For product orders you can also use the{" "}
              <a href="/quote" className="font-medium text-brand hover:underline">quote form</a>{" "}
              or chat with us using the bubble in the corner.
            </p>
            <Card className="mt-6 bg-surface/60">
              <ContactForm />
            </Card>
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={`mailto:${site.contact.email}`}
                className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Mail className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</span>
                <span className="text-sm font-medium group-hover:text-brand">{site.contact.email}</span>
              </a>
              <a
                href={`tel:${phone1}`}
                className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Phone className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call us</span>
                <span className="text-sm font-medium group-hover:text-brand">
                  {site.contact.phone}
                  <br />
                  {site.contact.phone2}
                </span>
              </a>
            </div>

            <Card className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Clock className="h-5 w-5" />
              </span>
              <div className="text-sm">
                <p className="font-medium">Business hours</p>
                <p className="mt-0.5 text-muted-foreground">Mon – Sat, 10:00 AM – 6:30 PM IST</p>
              </div>
            </Card>

            <div className="space-y-3">
              {site.addresses
                .filter((addr) => addr.label !== "Odisha")
                .map((addr) => (
                <Card key={addr.label} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">{addr.label} office</p>
                    <p className="mt-0.5 leading-relaxed text-muted-foreground">{addr.lines.join(" ")}</p>
                  </div>
                </Card>
              ))}
            </div>

            <a
              href={`https://wa.me/${phone1.replace("+", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-3 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10"
            >
              <MessageCircle className="h-4 w-4" /> Chat with us on WhatsApp
            </a>
          </div>
        </Container>
      </section>

      {/* Map */}
      <section className="border-t border-border">
        <iframe
          title="METNMAT — Howrah office location"
          src={`https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`}
          className="h-[360px] w-full border-0 sm:h-[420px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
    </>
  );
}
