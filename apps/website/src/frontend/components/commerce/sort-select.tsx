import { sortOptions } from "@/frontend/lib/catalog";

/** Sort dropdown (UI only for now). TODO(feature): wire to query param + sorting. */
export function SortSelect() {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort by</span>
      <select className="h-9 rounded-lg border border-input bg-surface px-3 text-sm outline-none focus:border-brand">
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
