"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { getTracker } from "./collector";

/**
 * Mounts the analytics collector and emits one page_view per App Router
 * navigation. Detail pages declare their entity via <AnalyticsEntity> (a meta
 * tag this reads after each navigation), so events carry "product:slug" etc.
 * Renders nothing; a failure here can never affect the page.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();

  React.useEffect(() => {
    // Small delay lets the new page's <meta name="mm:entity"> land in the DOM
    // (and mirrors the blog ViewTracker's dwell guard against bounce noise).
    const t = setTimeout(() => {
      try {
        const entity =
          document.querySelector('meta[name="mm:entity"]')?.getAttribute("content") || undefined;
        getTracker().pageView(pathname, entity);
      } catch {
        /* never break the page over analytics */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
