"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Real-time page auto-refresh: re-runs the server component every N seconds
 * via router.refresh(). Polling Mongo through the normal render path is the
 * simplest reliable real-time architecture on multi-instance, scale-to-zero
 * Cloud Run — SSE/WebSockets would need shared pub/sub for zero benefit at
 * this traffic level. Pauses while the tab is hidden.
 */
export function AutoRefresh({ seconds = 12 }: { seconds?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, Math.max(5, seconds) * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
