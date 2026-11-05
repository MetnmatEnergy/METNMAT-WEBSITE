import Link from "next/link";
import type { GuideSection } from "@/frontend/lib/guides";

/** The body shared by guides and service pages: sections, FAQs and links onward. */
export function ArticleSections({
  sections,
  faqs,
  links,
}: {
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
  links: { href: string; name: string }[];
}) {
  return (
    <>
      {sections.map((s) => (
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

      {faqs.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Frequently asked questions</h2>
          <div className="mt-5 space-y-5">
            {faqs.map((f) => (
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
          {links.map((l) => (
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
    </>
  );
}
