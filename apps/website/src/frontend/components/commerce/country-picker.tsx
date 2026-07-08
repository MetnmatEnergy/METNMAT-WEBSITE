"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { COUNTRIES, countryByName, dialFor, flagFor } from "@/frontend/lib/countries";
import { cn } from "@/frontend/lib/utils";

type Props = {
  /** Selected country NAME (matches the shipping/billing country model). */
  value: string;
  onChange: (name: string) => void;
  /** "full" = a select-like field (Country / region); "compact" = a dial-code
   *  prefix trigger for the phone input (flag + code only). */
  variant?: "full" | "compact";
  id?: string;
  ariaLabel?: string;
  invalid?: boolean;
};

/**
 * Searchable country picker (combobox). Filters ~200 countries by name, ISO code,
 * or dialing code as you type — the standard marketplace pattern, far better than
 * scrolling a native <select>. Keyboard-navigable, closes on outside-click / Esc.
 * Flags render as emoji on iOS/Android/macOS and gracefully as the 2-letter code
 * on Windows (which has no flag glyphs).
 */
export function CountryPicker({ value, onChange, variant = "full", id, ariaLabel, invalid }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const selected = countryByName(value);
  const flag = selected ? flagFor(selected.iso2) : "";
  const dial = dialFor(value) || "";

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const digits = q.replace(/[^\d]/g, "");
    return COUNTRIES.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.iso2.toLowerCase() === q) return true;
      if (digits && c.dial.replace(/\D/g, "").includes(digits)) return true;
      return false;
    });
  }, [query]);

  // On open: reset the search and focus it so the user can type straight away.
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // Close on outside-click or Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep the highlighted row in range as the filter narrows, and scrolled into view.
  React.useEffect(() => {
    setActive((a) => Math.max(0, Math.min(a, filtered.length - 1)));
  }, [filtered.length]);
  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtered[active];
      if (c) select(c.name);
    } else if (e.key === "Home") {
      setActive(0);
    } else if (e.key === "End") {
      setActive(filtered.length - 1);
    }
  };

  const listId = `${id || "country"}-list`;

  return (
    <div ref={rootRef} className={cn("relative", variant === "full" && "w-full")}>
      {variant === "compact" ? (
        <button
          type="button"
          id={id}
          aria-label={ariaLabel || "Country dialing code"}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-full shrink-0 select-none items-center gap-1.5 rounded-l-lg border-r border-input bg-background/40 pl-3 pr-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <span className="text-base leading-none" aria-hidden>{flag}</span>
          <span aria-hidden>{dial}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30",
            invalid ? "border-brand" : "border-input hover:border-brand/60",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-base leading-none" aria-hidden>{flag}</span>
            <span className="truncate">{selected ? `${selected.name} (${selected.dial})` : "Select country"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lg",
            variant === "compact" ? "left-0 w-72 max-w-[calc(100vw-3.5rem)]" : "left-0 w-full min-w-[15rem]",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0); // highlight the top match as the filter changes
              }}
              onKeyDown={onInputKey}
              placeholder="Search country or code…"
              aria-label="Search country"
              aria-controls={listId}
              autoComplete="off"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matching country</li>
            ) : (
              filtered.map((c, i) => {
                const isSel = selected ? selected.iso2 === c.iso2 : c.name === value;
                return (
                  <li key={c.iso2} data-idx={i} role="option" aria-selected={isSel}>
                    <button
                      type="button"
                      onClick={() => select(c.name)}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm outline-none",
                        i === active ? "bg-muted/60" : "hover:bg-muted/40",
                      )}
                    >
                      <span className="text-base leading-none" aria-hidden>{flagFor(c.iso2)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{c.dial}</span>
                      {isSel && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
