import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { JsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";
import { SubmitForm } from "@/frontend/components/blog/submit-form";
import { pageMetadata } from "@/frontend/lib/seo";
import { getBlogCategories, getBlogContentTypes } from "@/frontend/lib/blog";

export const metadata: Metadata = pageMetadata({
  title: "Submit an Article Publication Request",
  description:
    "Researchers, engineers and technical professionals may submit an article proposal for editorial review by the METNMAT team.",
  path: "/blog/submit",
});

export default async function BlogSubmitPage() {
  const [categories, contentTypes] = await Promise.all([getBlogCategories(), getBlogContentTypes()]);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: "Request to Publish", path: "/blog/submit" },
        ])}
      />
      <section className="border-b border-border bg-surface/50">
        <Container className="max-w-3xl py-10 md:py-14">
          <Breadcrumbs
            items={[{ name: "Home", href: "/" }, { name: "Blog", href: "/blog" }, { name: "Request to Publish" }]}
          />
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Submit an Article Publication Request
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Researchers, engineers and technical professionals may submit an article proposal for
            editorial review. All submissions are evaluated for technical relevance, originality,
            clarity, copyright compliance and suitability for the METNMAT audience. Submission does
            not guarantee publication.
          </p>
        </Container>
      </section>
      <section className="section">
        <Container className="max-w-3xl">
          {categories.length > 0 && contentTypes.length > 0 ? (
            <SubmitForm
              categories={categories.map((c) => ({ slug: c.id, name: c.name }))}
              contentTypes={contentTypes.map((t) => ({ slug: t.id, name: t.name }))}
            />
          ) : (
            // Required selects would be impossible to complete without options
            // (CMS unreachable / taxonomy empty) — don't let users fill a form
            // that cannot be submitted.
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <p className="font-display text-lg font-semibold">Submissions are temporarily unavailable</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Please try again shortly, or email the editorial team at{" "}
                <a href="mailto:contact@metnmat.com" className="underline underline-offset-2 hover:text-foreground">
                  contact@metnmat.com
                </a>
                .
              </p>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
