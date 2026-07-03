import type { BlogReferenceEntry } from "@/frontend/lib/blog";

const safeExternal = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

/** Numbered academic-style references list. */
export function ReferencesSection({ references }: { references: BlogReferenceEntry[] }) {
  if (!references.length) return null;
  return (
    <section aria-labelledby="references-heading" className="mt-12 border-t border-border pt-8">
      <h2 id="references-heading" className="font-display text-xl font-semibold">
        References
      </h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
        {references.map((r, i) => {
          const doiUrl = r.doi ? `https://doi.org/${encodeURIComponent(r.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, ""))}` : null;
          const link = safeExternal(r.url) ?? doiUrl;
          const detail = [
            r.source ? <em key="src">{r.source}</em> : null,
            [r.volume && `vol. ${r.volume}`, r.issue && `no. ${r.issue}`, r.pages && `pp. ${r.pages}`, r.year]
              .filter(Boolean)
              .join(", "),
          ];
          return (
            <li key={i} id={`ref-${i + 1}`}>
              {r.authors && <span>{r.authors}, </span>}
              <span className="text-foreground/90">&ldquo;{r.title}&rdquo;</span>
              {detail[0] ? <>, {detail[0]}</> : null}
              {detail[1] ? <>, {detail[1]}</> : null}.{" "}
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-brand underline underline-offset-4 hover:text-brand-soft"
                >
                  {r.doi ? `doi:${r.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}` : "Link"}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
