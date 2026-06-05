import { Search } from "lucide-react";

/**
 * Catalog search. Uses a native GET form so it works without JS and is
 * crawlable; navigates to /search?q=…
 * TODO(feature): add autocomplete (Meilisearch) later.
 */
export function SearchBar({ className }: { className?: string }) {
  return (
    <form action="/search" method="get" className={className} role="search">
      <div className="flex items-center overflow-hidden rounded-full border border-border bg-surface focus-within:border-brand">
        <input
          type="search"
          name="q"
          placeholder="Search products, brands, SKUs…"
          aria-label="Search the catalog"
          className="h-11 w-full bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex h-11 items-center gap-2 bg-brand px-5 text-sm font-semibold text-brand-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>
    </form>
  );
}
