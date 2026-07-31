import { safeJsonLd } from "@/frontend/components/seo/schema";

// Builders live in schema.ts (pure, testable, no JSX). Re-exported here so the
// long-standing "@/frontend/components/seo/json-ld" import path keeps working.
export * from "@/frontend/components/seo/schema";

/** Injects JSON-LD structured data (Organization by default). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
