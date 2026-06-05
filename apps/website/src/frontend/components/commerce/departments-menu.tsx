"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutGrid, ChevronDown } from "lucide-react";
import { topCategories, subCategories } from "@/frontend/lib/catalog";

/** "All Departments" mega-menu (Amazon/Flipkart style). */
export function DepartmentsMenu() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground"
      >
        <LayoutGrid className="h-4 w-4" />
        Departments
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-40 mt-2 w-[560px] max-w-[90vw] rounded-2xl border border-border bg-background p-4 shadow-xl">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {topCategories().map((c) => (
                <div key={c.slug}>
                  <Link
                    href={`/shop/c/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className="font-display text-sm font-semibold hover:text-brand"
                  >
                    {c.name}
                  </Link>
                  <ul className="mt-1.5 space-y-1">
                    {subCategories(c.slug).map((s) => (
                      <li key={s.slug}>
                        <Link
                          href={`/shop/c/${s.slug}`}
                          onClick={() => setOpen(false)}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Link
              href="/shop"
              onClick={() => setOpen(false)}
              className="mt-4 block border-t border-border pt-3 text-sm font-medium text-brand"
            >
              Visit the full store →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
