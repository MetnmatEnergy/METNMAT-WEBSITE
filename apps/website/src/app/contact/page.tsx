import type { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { Button } from "@/frontend/components/ui/button";
import { Card, MediaPlaceholder } from "@/frontend/components/ui/card";
import { site } from "@/frontend/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with METNMAT Research & Innovations.",
};

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Let's talk"
        description="Send us a message and the right person will get back to you."
      />

      <section className="section">
        <Container className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          {/* Form (UI only). TODO(feature): POST to Website API / email service. */}
          <Card className="bg-surface/60">
            <form className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Name</label>
                  <input className={field} placeholder="Your name" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email</label>
                  <input type="email" className={field} placeholder="you@company.com" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone</label>
                  <input className={field} placeholder="+91 …" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Company</label>
                  <input className={field} placeholder="Company name" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Message</label>
                <textarea rows={5} className={field} placeholder="How can we help?" />
              </div>
              <Button type="button" size="lg" className="justify-self-start">
                Send message
              </Button>
            </form>
          </Card>

          {/* Details */}
          <div className="space-y-6">
            <div className="space-y-4">
              <a href={`mailto:${site.contact.email}`} className="flex items-center gap-3 text-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Mail className="h-5 w-5" />
                </span>
                {site.contact.email}
              </a>
              <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 text-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Phone className="h-5 w-5" />
                </span>
                <span>
                  {site.contact.phone}
                  <br />
                  {site.contact.phone2}
                </span>
              </a>
              {site.addresses.map((addr) => (
                <div key={addr.label} className="flex items-start gap-3 text-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{addr.label}</span>
                    <br />
                    {addr.lines.map((l, i) => (
                      <span key={i}>
                        {l}
                        <br />
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <MediaPlaceholder className="aspect-[4/3]" label="Map" />
          </div>
        </Container>
      </section>
    </>
  );
}
