"use client";

import * as React from "react";
import { FileText, Truck } from "lucide-react";
import type { Product } from "@/frontend/lib/catalog";
import type { ProductCopy } from "@/frontend/lib/product-copy";
import { RichText, hasRichText } from "@/frontend/components/blog/rich-text";
import { cn } from "@/frontend/lib/utils";

const TABS = ["Description", "Specifications", "Documents", "Shipping & Returns"] as const;
type Tab = (typeof TABS)[number];

const tabId = (t: Tab) => `product-tab-${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/**
 * Every panel stays in the HTML and the inactive ones are only hidden. Crawlers
 * and answer engines do not click tabs: when a panel was rendered only once
 * selected, the full specifications, documents and shipping terms were missing
 * from what they read, and a product with 22 specs showed them just the first 6.
 */
function Panel({ t, active, children }: { t: Tab; active: Tab; children: React.ReactNode }) {
  return (
    <div
      id={`${tabId(t)}-panel`}
      role="tabpanel"
      aria-labelledby={tabId(t)}
      tabIndex={0}
      hidden={active !== t}
      className="py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      {children}
    </div>
  );
}

export function ProductTabs({ product, copy }: { product: Product; copy?: ProductCopy }) {
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
            aria-controls={`${tabId(t)}-panel`}
            onClick={() => setTab(t)}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              tab === t ? "text-brand-soft" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        ))}
      </div>

      <Panel t="Description" active={tab}>
          <div className="max-w-3xl space-y-4 text-muted-foreground">
            {hasRichText(product.description) ? (
              <RichText content={product.description} />
            ) : (
              <p>{product.shortDesc || "Detailed product description."}</p>
            )}
            {copy && (
              <>
                <p>{copy.about}</p>
                <div>
                  <h3 className="mb-2 font-semibold text-foreground">Typical uses</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {copy.uses.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold text-foreground">Care and handling</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {copy.care.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <p>
              Engineered for laboratory and industrial use. Contact us for custom
              specifications, bulk quantities, or application guidance.
            </p>
            <div>
              {/* h3, not h4: the nearest preceding heading is the tab panel's h2, so an
                  h4 skips a level and axe flags heading-order. */}
              <h3 className="mb-2 font-semibold text-foreground">What you get</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>1 × {product.name}</li>
                <li>Test/QC certificate on request</li>
                <li>GST invoice</li>
              </ul>
            </div>
          </div>
      </Panel>

      <Panel t="Specifications" active={tab}>
          <dl className="max-w-2xl divide-y divide-border border-y border-border text-sm">
            {[
              { label: "Brand", value: product.brand || "—" },
              ...(product.sku ? [{ label: "SKU", value: product.sku }] : []),
              { label: "Minimum order", value: `${product.moq} ${product.unit}` },
              ...product.specs.map((s) => ({ label: s.label, value: s.value })),
            ].map((row, i) => (
              <div key={i} className="flex justify-between gap-6 py-2.5">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
      </Panel>

      <Panel t="Documents" active={tab}>
          <div className="max-w-2xl">
            {product.datasheets.length > 0 ? (
              <ul className="space-y-2">
                {product.datasheets.map((d, i) => (
                  <li key={i}>
                    <a href={d.href} className="inline-flex items-center gap-2 text-sm text-brand-soft hover:underline">
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
      </Panel>

      <Panel t="Shipping & Returns" active={tab}>
          <div className="max-w-2xl space-y-3 text-sm text-muted-foreground">
            {product.leadTime ? (
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Truck className="h-4 w-4 text-brand" /> {product.leadTime}
              </p>
            ) : null}
            <ul className="list-disc space-y-1 pl-5">
              <li>Free shipping within India. We also ship worldwide; international freight is confirmed after you order.</li>
              <li>GST invoice provided on every order.</li>
              <li>Dispatch lead times vary by item; bulk orders may take longer.</li>
              <li>
                No refunds. Damaged, defective, or incorrect items are eligible for a free
                replacement within 7 days of delivery —{" "}
                <a href="/replacement-policy" className="text-brand-soft hover:underline">
                  see our Replacement Policy
                </a>
                .
              </li>
            </ul>
          </div>
      </Panel>
    </div>
  );
}
