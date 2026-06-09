import Link from "next/link";
import type { Category } from "@/frontend/lib/catalog";

/**
 * Faceted filter rail (PLP). Category links route through; price + availability
 * are UI placeholders for now.
 * TODO(feature): make facets interactive + wire to Meilisearch filters.
 */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-5 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Check({ label }: { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-muted-foreground hover:text-foreground">
      <input type="checkbox" className="h-4 w-4 rounded border-border accent-brand" />
      <span className="flex-1">{label}</span>
    </label>
  );
}

export function FilterSidebar({
  activeCategory,
  categories = [],
}: {
  activeCategory?: string;
  categories?: Category[];
}) {
  const tops = categories.filter((c) => !c.parent);

  return (
    <aside className="space-y-1">
      <Group title="Category">
        <ul className="space-y-1 text-sm">
          {tops.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/shop/c/${c.slug}`}
                className={
                  c.slug === activeCategory
                    ? "font-medium text-brand"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Availability">
        <Check label="In stock" />
        <Check label="GST invoice" />
        <Check label="Made by METNMAT" />
      </Group>
    </aside>
  );
}
