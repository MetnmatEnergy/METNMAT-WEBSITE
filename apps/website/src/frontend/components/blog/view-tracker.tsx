"use client";

/**
 * Fires ONE view beacon per article page visit (guarded against Strict-Mode
 * double effects); the server dedupes per visitor per day via cookie. Never
 * rendered in draft preview, so admin previews are never counted.
 */
import React from "react";
import { hasAnalyticsConsent } from "@/frontend/lib/consent";

const sent = new Set<string>();

export function ViewTracker({ articleId }: { articleId: string }) {
  React.useEffect(() => {
    // Mark as sent only when the beacon actually fires — an early unmount
    // (bounce, StrictMode's first pass) must not permanently suppress the view.
    const t = setTimeout(() => {
      // This is passive measurement — which article you read and when, deduped
      // server-side against a persistent cookie. Under DPDP that needs consent
      // like any other analytics; it is not one of the s.7 legitimate uses.
      // Without this check "Reject" left every blog article still counting the
      // reader and still setting the dedupe cookie.
      if (!hasAnalyticsConsent()) return;
      if (sent.has(articleId)) return;
      sent.add(articleId);
      fetch("/api/blog/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
        keepalive: true,
      }).catch(() => {});
    }, 2000); // only count visits that actually dwell
    return () => clearTimeout(t);
  }, [articleId]);
  return null;
}
