import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { Button } from "@/frontend/components/ui/button";
import { Card } from "@/frontend/components/ui/card";

export const metadata: Metadata = {
  title: "Get a Quote",
  description: "Request a quote for R&D services or products.",
};

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

export default function QuotePage() {
  return (
    <>
      <PageHero
        eyebrow="Get a Quote"
        title="Request a quote"
        description="Tell us what you need — services, products, or both — and we'll scope it for you."
      />

      <section className="section">
        <Container className="max-w-3xl">
          {/* UI only. TODO(feature): POST to Website API (enquiries collection). */}
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
                <label className="mb-1.5 block text-sm font-medium">
                  What do you need a quote for?
                </label>
                <select className={field} defaultValue="">
                  {/* TODO(content): real quote categories. */}
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option>R&D / consulting service</option>
                  <option>Product / equipment</option>
                  <option>Both</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Details</label>
                <textarea
                  rows={6}
                  className={field}
                  placeholder="Describe your process, goals, quantities, timelines…"
                />
              </div>
              <Button type="button" size="lg" className="justify-self-start">
                Submit request
              </Button>
            </form>
          </Card>
        </Container>
      </section>
    </>
  );
}
