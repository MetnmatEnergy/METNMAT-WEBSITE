"use client";

/**
 * Table of contents — anchor links generated from the article headings.
 * Sticky beside the article on desktop, a collapsible disclosure on mobile.
 * Highlights the active section via IntersectionObserver and respects
 * prefers-reduced-motion for scrolling.
 */
import React from "react";
import { ChevronDown } from "lucide-react";
import type { TocEntry } from "@/frontend/lib/blog-toc";

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = React.useState<string>("");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!entries.length) return;
    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (obs) => {
        const visible = obs.filter((o) => o.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -70% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length < 3) return null; // short articles don't need a TOC

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setOpen(false);
  };

  const list = (
    <ol className="space-y-1.5 text-sm">
      {entries.map((e) => (
        <li key={e.id} className={e.level === 3 ? "pl-4" : ""}>
          <a
            href={`#${e.id}`}
            onClick={(ev) => go(ev, e.id)}
            aria-current={activeId === e.id ? "location" : undefined}
            className={`block border-l-2 py-0.5 pl-3 leading-snug transition-colors ${
              activeId === e.id
                ? "border-brand font-medium text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {e.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <nav aria-label="Table of contents">
      {/* Mobile: disclosure */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="toc-list"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold"
        >
          On this page
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {open && (
          <div id="toc-list" className="mt-2 rounded-xl border border-border bg-surface p-4">
            {list}
          </div>
        )}
      </div>
      {/* Desktop: sticky sidebar block */}
      <div className="hidden lg:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">On this page</p>
        {list}
      </div>
    </nav>
  );
}
