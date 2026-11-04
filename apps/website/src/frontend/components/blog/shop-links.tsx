import Link from "next/link";

/**
 * Links from an article to the part of the site its reader may need next. The
 * posts moved from metnmat.in carry most of the old site's search and AI
 * visibility, and their text has no links, so this is how that authority reaches
 * the shop and the services page.
 */
const SERVICES = { href: "/services", name: "Materials and metallurgy R&D services" };
const LAB = [
  { href: "/shop/c/electrodes", name: "Electrodes" },
  { href: "/shop/c/reactor-cell", name: "Electrochemical cells and reactors" },
  { href: "/shop/c/membranes", name: "Ion exchange membranes" },
];
const ENERGY = [
  { href: "/shop/c/water-splitting-reactors", name: "Water electrolysis cells" },
  { href: "/shop/c/fuel-cells", name: "Fuel cell hardware" },
  { href: "/shop/c/aem-membranes", name: "Anion exchange membranes" },
];

const BY_CATEGORY: Record<string, { href: string; name: string }[]> = {
  metallurgy: [SERVICES, { href: "/shop/c/accessories", name: "High-purity metal sheets" }, ...LAB.slice(0, 1)],
  materials: [SERVICES, ...LAB],
  "r-d": [SERVICES, ...LAB],
  electrochemistry: [...LAB, { href: "/shop/t/ag-agcl-reference-electrodes", name: "Ag/AgCl reference electrodes" }],
  "hydrogen-fuel-cells": ENERGY,
  "lab-equipment": LAB,
};

export function BlogShopLinks({ categorySlug }: { categorySlug?: string }) {
  const links = (categorySlug && BY_CATEGORY[categorySlug]) || [SERVICES, ...LAB];
  return (
    <section aria-labelledby="shop-links-heading" className="mx-auto mt-14 max-w-6xl print:hidden">
      <h2 id="shop-links-heading" className="font-display text-xl font-semibold">
        From METNMAT
      </h2>
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
  );
}
