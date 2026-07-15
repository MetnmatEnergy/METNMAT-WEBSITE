"use client";

import * as React from "react";
import { FileText, Truck } from "lucide-react";
import type { Product } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

const TABS = ["Description", "Specifications", "Documents", "Shipping & Returns"] as const;
type Tab = (typeof TABS)[number];

const tabId = (t: Tab) => `product-tab-${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export function ProductTabs({ product }: { product: Product }) {
  const [tab, setTab] = React.useState<Tab>("Description");

  return (
    <div>
      {/* Tab bar */}
      <div role="tablist" aria-label="Product details" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={tabId(t)}
            aria-selected={tab === t}
            aria-controls="product-tabpanel"
            onClick={() => setTab(t)}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              tab === t ? "text-brand" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        ))}
      </div>

      <div
        id="product-tabpanel"
        role="tabpanel"
        aria-labelledby={tabId(tab)}
        tabIndex={0}
        className="py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {tab === "Description" && (
          <div className="max-w-3xl space-y-4 text-muted-foreground">
            <p>{product.shortDesc || "Detailed product description."}</p>
            {/* TODO(content): rich description from the CMS. */}
            <p>
              Engineered for laboratory and industrial use. Contact us for custom
              specifications, bulk quantities, or application guidance.
            </p>
            <div>
              <h4 className="mb-2 font-semibold text-foreground">What you get</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>1 × {product.name}</li>
                <li>Test/QC certificate on request</li>
                <li>GST invoice</li>
              </ul>
            </div>
          </div>
        )}

        {tab === "Specifications" && (
          <dl className="max-w-2xl divide-y divide-border border-y border-border text-sm">
            {[
              { label: "Brand", value: product.brand || "—" },
              { label: "SKU", value: product.sku || "—" },
              { label: "Minimum order", value: `${product.moq} ${product.unit}` },
              ...product.specs.map((s) => ({ label: s.label, value: s.value })),
            ].map((row, i) => (
              <div key={i} className="flex justify-between gap-6 py-2.5">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === "Documents" && (
          <div className="max-w-2xl">
            {product.datasheets.length > 0 ? (
              <ul className="space-y-2">
                {product.datasheets.map((d, i) => (
                  <li key={i}>
                    <a href={d.href} className="inline-flex items-center gap-2 text-sm text-brand hover:underline">
                      <FileText className="h-4 w-4" /> {d.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Datasheets, brochures &amp; certificates for this product are available on request —
                use “Request a quote” and we&apos;ll share them.
              </p>
            )}
          </div>
        )}

        {tab === "Shipping & Returns" && (
          <div className="max-w-2xl space-y-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Truck className="h-4 w-4 text-brand" /> {product.leadTime}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Shipping across India &amp; worldwide.</li>
              <li>GST invoice provided on every order.</li>
              <li>Dispatch lead times vary by item; bulk orders may take longer.</li>
              <li>
                No refunds. Damaged, defective, or incorrect items are eligible for a free
                replacement within 7 days of delivery —{" "}
                <a href="/replacement-policy" className="text-brand hover:underline">
                  see our Replacement Policy
                </a>
                .
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
