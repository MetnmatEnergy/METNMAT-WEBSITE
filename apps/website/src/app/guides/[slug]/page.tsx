import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { JsonLd, faqJsonLd, organizationJsonLd, organizationRef, publisherJsonLd } from "@/frontend/components/seo/json-ld";
import { GUIDES, GUIDES_UPDATED } from "@/frontend/lib/guides";
import { pageMetadata } from "@/frontend/lib/seo";
import { site } from "@/frontend/lib/site";

type Params = { slug: string };

const find = (slug: string) => (Object.hasOwn(GUIDES, slug) ? GUIDES[slug] : undefined);

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = find(slug);
  if (!guide) notFound();
  return pageMetadata({ title: guide.title, description: guide.description, path: `/guides/${slug}`, keywords: guide.keywords });
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const guide = find(slug);
  if (!guide) notFound();
  const path = `/guides/${slug}`;

  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: guide.h1,
          description: guide.description,
          url: `${site.url}${path}`,
          dateModified: GUIDES_UPDATED,
          datePublished: GUIDES_UPDATED,
          author: organizationRef,
          publisher: publisherJsonLd,
          keywords: guide.keywords.join(", "),
        }}
      />
      {guide.faqs.length > 0 && <JsonLd data={faqJsonLd(guide.faqs)} />}
      <PageHero
        eyebrow="Guide"
        title={guide.h1}
        bordered={false}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path },
        ]}
      />
      <Container className="max-w-3xl pb-16">
        <p className="rounded-2xl border border-border bg-surface/40 p-5 text-foreground">{guide.answer}</p>

        {guide.sections.map((s) => (
          <section key={s.h2} className="mt-10">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{s.h2}</h2>
            {s.text?.map((t) => (
              <p key={t} className="mt-3 text-muted-foreground">{t}</p>
            ))}
            {s.list && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                {s.list.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            {s.table && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{s.table.caption}</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      {s.table.head.map((h, i) => (
                        <th key={i} scope="col" className="py-2 pr-4 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {s.table.rows.map((r) => (
                      <tr key={r[0]}>
                        {r.map((c, i) => (
                          <td key={i} className={`py-2 pr-4 ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        {guide.faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Frequently asked questions</h2>
            <div className="mt-5 space-y-5">
              {guide.faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="font-medium text-foreground">{f.q}</h3>
                  <p className="mt-1 text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">See also</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {guide.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted-foreground hover:border-brand/40 hover:text-foreground"
              >
                {l.name}
              </Link>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
