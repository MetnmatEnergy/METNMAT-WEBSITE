"use client";

/**
 * Fires ONE view beacon per article page visit (guarded against Strict-Mode
 * double effects); the server dedupes per visitor per day via cookie. Never
 * rendered in draft preview, so admin previews are never counted.
 */
import React from "react";

const sent = new Set<string>();

export function ViewTracker({ articleId }: { articleId: string }) {
  React.useEffect(() => {
    // Mark as sent only when the beacon actually fires — an early unmount
    // (bounce, StrictMode's first pass) must not permanently suppress the view.
    const t = setTimeout(() => {
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
