"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Package,
  FlaskConical,
  FolderGit2,
  Newspaper,
  LayoutGrid,
  FileText,
  CornerDownLeft,
} from "lucide-react";
import { formatINR } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

type SlimProduct = {
  slug: string;
  name: string;
  brand?: string;
  sku?: string;
  price?: number;
  categorySlug?: string;
};
type SiteLinkType = "Service" | "Blog" | "Project" | "Category" | "Page";
type SiteLink = { type: SiteLinkType; title: string; href: string; desc?: string };
type Results = { products: SlimProduct[]; links: SiteLink[]; totalProducts?: number };

/** Icon + human label per non-product result type. */
const LINK_META: Record<SiteLinkType, { icon: typeof FileText; label: string }> = {
  Service: { icon: FlaskConical, label: "Research & Services" },
  Blog: { icon: Newspaper, label: "Blog" },
  Project: { icon: FolderGit2, label: "Projects" },
  Category: { icon: LayoutGrid, label: "Categories" },
  Page: { icon: FileText, label: "Pages" },
};
const LINK_ORDER: SiteLinkType[] = ["Service", "Blog", "Project", "Category", "Page"];

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Dynamic global site search. As you type it queries /api/search and shows a
 * live dropdown — products first, then research, blog, projects, categories and
 * pages. Submitting (Enter / Search) navigates to /search?q=… (works without JS
 * and is crawlable).
 */
export function SearchBar({
  className,
  compact = false,
  placeholder = "Search products, categories, pages…",
  scope = "all",
}: {
  className?: string;
  compact?: boolean;
  placeholder?: string;
  /** "all" = full global search; "products" = products only (no other tabs). */
  scope?: "all" | "products";
}) {
  const router = useRouter();
  const listId = React.useId();
  const scopeQS = scope === "products" ? "&scope=products" : "";
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Results>({ products: [], links: [] });
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const h = compact ? "h-10" : "h-11";

  // Flat, ordered list of everything navigable (for keyboard + counts).
  const flat = React.useMemo(() => {
    const items: { href: string }[] = results.products.map((p) => ({
      href: `/shop/p/${p.slug}`,
    }));
    for (const t of LINK_ORDER) {
      for (const l of results.links.filter((x) => x.type === t)) items.push({ href: l.href });
    }
    return items;
  }, [results]);

  const hasResults = flat.length > 0;

  // Debounced fetch on query change.
  React.useEffect(() => {
    const term = q.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.length < 1) {
      setResults({ products: [], links: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}${scopeQS}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as Results;
        setResults(data);
        setActive(-1);
      } catch {
        /* aborted or offline — keep previous results */
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, scopeQS]);

  // Close on outside click.
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  function submit() {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}${scopeQS}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || !hasResults) {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && flat[active]) go(flat[active].href);
      else submit();
    }
  }

  const groupedLinks = LINK_ORDER.map((t) => ({
    type: t,
    items: results.links.filter((l) => l.type === t),
  })).filter((g) => g.items.length > 0);

  // Index offset so keyboard highlight maps across products + grouped links.
  let runningIndex = results.products.length;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div
          className={cn(
            "flex items-center overflow-hidden rounded-full border bg-surface transition-colors",
            open && hasResults ? "border-brand" : "border-border focus-within:border-brand"
          )}
        >
          <span className="pl-4 text-muted-foreground">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </span>
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Search the site"
            role="combobox"
            aria-expanded={open && hasResults}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            className={`${h} w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none`}
          />
          <button
            type="submit"
            aria-label="Search"
            className={`flex ${h} items-center gap-2 bg-brand px-5 text-sm font-semibold text-brand-foreground`}
          >
            <Search className="h-4 w-4" />
            <span className={compact ? "hidden lg:inline" : "hidden sm:inline"}>Search</span>
          </button>
        </div>
      </form>

      {/* ── Live results dropdown ─────────────────────────────── */}
      {open && q.trim().length >= 1 && (
        <div id={listId} role="listbox" aria-label="Search results" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="max-h-[70vh] overflow-y-auto py-2">
            {!hasResults && !loading && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No matches for <span className="text-foreground">&ldquo;{q.trim()}&rdquo;</span>.
              </p>
            )}

            {/* Products first */}
            {results.products.length > 0 && (
              <div>
                <p className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Package className="h-3.5 w-3.5 text-brand" /> Products
                </p>
                {results.products.map((p, i) => (
                  <button
                    key={p.slug}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(`/shop/p/${p.slug}`)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left",
                      active === i ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand-soft">
                      {monogram(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.brand ? `${p.brand} · ` : ""}
                        {p.sku || "Product"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold">
                      {p.price ? formatINR(p.price) : "On request"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Then research, blog, projects, categories, pages */}
            {groupedLinks.map((group) => {
              const Meta = LINK_META[group.type];
              return (
                <div key={group.type} className="mt-1 border-t border-border/60 pt-1">
                  <p className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Meta.icon className="h-3.5 w-3.5 text-brand" /> {Meta.label}
                  </p>
                  {group.items.map((l) => {
                    const idx = runningIndex++;
                    return (
                      <button
                        key={l.href}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(l.href)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-2 text-left",
                          active === idx ? "bg-muted" : "hover:bg-muted/60"
                        )}
                      >
                        <Meta.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{l.title}</span>
                          {l.desc && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {l.desc}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer: see all */}
          {hasResults && (
            <button
              type="button"
              onClick={submit}
              className="flex w-full items-center justify-between gap-2 border-t border-border bg-surface/60 px-4 py-2.5 text-left text-xs font-medium text-foreground/90 hover:bg-surface"
            >
              <span>
                See all results for{" "}
                <span className="text-brand">&ldquo;{q.trim()}&rdquo;</span>
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CornerDownLeft className="h-3.5 w-3.5" /> Enter
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
