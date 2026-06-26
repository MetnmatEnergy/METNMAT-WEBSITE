import type { Metadata } from "next";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  MessageCircle,
  ArrowUpRight,
  ShieldCheck,
  Truck,
  GraduationCap,
} from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Badge } from "@/frontend/components/ui/badge";
import { ContactForm } from "@/frontend/components/commerce/contact-form";
import { HighlightGroup, HighlighterItem, Particles } from "@/frontend/components/ui/highlighter";
import { site } from "@/frontend/lib/site";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Get in touch with METNMAT Research & Innovations — discuss a materials R&D project, request a quote, or visit our office in Howrah, West Bengal. We typically reply within one business day.",
  path: "/contact",
});

const trust = [
  { icon: Clock, label: "≤ 1 business-day reply" },
  { icon: ShieldCheck, label: "GST invoice on every order" },
  { icon: Truck, label: "India & worldwide shipping" },
  { icon: GraduationCap, label: "IIT Kharagpur founding team" },
];

export default function ContactPage() {
  const phone1 = site.contact.phone.replace(/\s/g, "");
  const wa = phone1.replace("+", "");
  const office = site.addresses[0];

  return (
    <>
      {/* ───────────── Hero — brand spotlight + ambient particles ───────────── */}
      <section className="relative">
        <Container className="py-10 sm:py-14">
          <HighlightGroup className="group">
            <HighlighterItem className="rounded-[28px]">
              <div className="relative overflow-hidden rounded-[28px] border border-border bg-surface">
                <Particles
                  className="absolute inset-0 -z-0 opacity-40 transition-opacity duration-700 group-hover:opacity-70"
                  quantity={120}
                  color="#d81f26"
                  vy={-0.15}
                />
                <div className="bg-hero-glow pointer-events-none absolute inset-0 -z-0" />
                <div className="relative z-10 grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
                  <div>
                    <Badge variant="dot">Contact METNMAT</Badge>
                    <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                      Let&apos;s engineer your{" "}
                      <span className="bg-brand-text bg-clip-text text-transparent">next breakthrough</span>
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/75">
                      Tell us about your materials, electrochemical, or research-system challenge — the right
                      specialist at METNMAT will get back to you, usually within a business day.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <a
                        href={`mailto:${site.contact.email}`}
                        className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand/90 hover:shadow-lg"
                      >
                        <Mail className="h-4 w-4" /> Email us
                      </a>
                      <a
                        href={`tel:${phone1}`}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        <Phone className="h-4 w-4" /> Call
                      </a>
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-5 py-2.5 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                    </div>
                  </div>

                  <ul className="grid gap-3 sm:grid-cols-2">
                    {trust.map((t) => (
                      <li
                        key={t.label}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-4 backdrop-blur-sm"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                          <t.icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-medium leading-snug">{t.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </HighlighterItem>
          </HighlightGroup>
        </Container>
      </section>

      {/* ───────────── Form + details ───────────── */}
      <section className="pb-16">
        <Container>
          <HighlightGroup className="group grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            {/* Message form */}
            <HighlighterItem className="rounded-3xl">
              <div className="relative h-full rounded-3xl border border-border bg-surface p-6 sm:p-8">
                <h2 className="font-display text-xl font-bold tracking-tight">Send us a message</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Buying products? Use the{" "}
                  <Link href="/quote" className="font-medium text-brand hover:underline">
                    quote form
                  </Link>{" "}
                  or the chat bubble in the corner.
                </p>
                <div className="mt-6">
                  <ContactForm />
                </div>
              </div>
            </HighlighterItem>

            {/* Details */}
            <HighlighterItem className="rounded-3xl">
              <div className="relative flex h-full flex-col gap-4 rounded-3xl border border-border bg-surface p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href={`mailto:${site.contact.email}`}
                    className="group/card flex flex-col gap-2 rounded-2xl border border-border bg-background/50 p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <Mail className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Email
                    </span>
                    <span className="break-words text-sm font-medium group-hover/card:text-brand">{site.contact.email}</span>
                  </a>
                  <a
                    href={`tel:${phone1}`}
                    className="group/card flex flex-col gap-2 rounded-2xl border border-border bg-background/50 p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <Phone className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Call us
                    </span>
                    <span className="text-sm font-medium leading-relaxed group-hover/card:text-brand">
                      {site.contact.phone}
                      <br />
                      {site.contact.phone2}
                    </span>
                  </a>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">Business hours</p>
                    <p className="mt-0.5 text-muted-foreground">Mon – Sat · 10:00 AM – 6:30 PM IST</p>
                  </div>
                </div>

                {office && (
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="text-sm">
                      <p className="font-medium">{office.label} office</p>
                      <p className="mt-0.5 leading-relaxed text-muted-foreground">{office.lines.join(" ")}</p>
                    </div>
                  </div>
                )}

                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-3 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                >
                  <MessageCircle className="h-4 w-4" /> Chat with us on WhatsApp
                </a>
              </div>
            </HighlighterItem>
          </HighlightGroup>
        </Container>
      </section>

      {/* ───────────── Map (Howrah) ───────────── */}
      <section className="border-t border-border">
        <Container className="py-10">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="text-sm">
                  <p className="font-medium">Visit our Howrah office</p>
                  <p className="text-muted-foreground">{office?.lines.join(" ")}</p>
                </div>
              </div>
              <a
                href={office.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-brand/40 hover:text-brand"
              >
                Open in Google Maps <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <iframe
              title="METNMAT Research & Innovations — Howrah office location"
              src={office.mapEmbedUrl}
              className="h-[360px] w-full border-0 sm:h-[440px]"
              loading="lazy"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </Container>
      </section>
    </>
  );
}
