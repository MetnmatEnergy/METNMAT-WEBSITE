"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { getTracker } from "./collector";
import { CONSENT_EVENT } from "../consent";

/**
 * Mounts the analytics collector and emits one page_view per App Router
 * navigation. Detail pages declare their entity via <AnalyticsEntity> (a meta
 * tag this reads after each navigation), so events carry "product:slug" etc.
 * Renders nothing; a failure here can never affect the page.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();
  // Bumped when the visitor changes their consent, purely to re-run the effect
  // below: someone who accepts should have the page they are ON counted,
  // without waiting for their next navigation.
  const [consentTick, setConsentTick] = React.useState(0);

  React.useEffect(() => {
    const onChange = () => setConsentTick((n) => n + 1);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

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
  }, [pathname, consentTick]);

  return null;
}
