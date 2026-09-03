"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { targetPathname, SHOW_AFTER_MS, SAFETY_MS } from "@/frontend/lib/route-progress";

/**
 * A thin progress bar across the top while a page navigation is in flight.
 *
 * WHY THIS EXISTS
 * Server TTFB is healthy — 0.3 to 0.6 seconds — but the App Router gives no
 * feedback during it. Click a nav link on a dynamic route and for that third of
 * a second absolutely nothing happens: no cursor change, no dimming, no
 * indication the click registered. That silence is what makes a fast site feel
 * slow, and it is why people click twice.
 *
 * Next 15.1.6 has no `useLinkStatus` (that is 15.3+) and the App Router exposes
 * no router events, so the only signal available is the click itself. We start
 * on a qualifying link click and stop when `usePathname()` reports the new route
 * has committed.
 *
 * The shop's filter controls already solve their own case with
 * `ShopTransitionProvider`, which dims the results for search-param changes.
 * This is the complement: whole-page navigations, everywhere on the site.
 *
 * DELIBERATELY NOT `useSearchParams`
 * Reading it here would opt every statically-rendered route into client-side
 * rendering, which would cost far more than this saves. So the bar triggers only
 * when the PATHNAME changes.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = React.useState(false);
  const showTimer = React.useRef<number | undefined>(undefined);
  const safetyTimer = React.useRef<number | undefined>(undefined);

  const stop = React.useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(safetyTimer.current);
    setActive(false);
  }, []);

  // The new route committed. Whatever we were waiting for has arrived.
  React.useEffect(() => {
    stop();
  }, [pathname, stop]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const next = targetPathname(e, window.location.pathname, window.location.origin);
      if (next === null) return;
      window.clearTimeout(showTimer.current);
      window.clearTimeout(safetyTimer.current);
      // Wait a beat: a warm or prefetched route lands before this fires, so the
      // visitor sees a clean instant transition rather than a flicker.
      showTimer.current = window.setTimeout(() => setActive(true), SHOW_AFTER_MS);
      safetyTimer.current = window.setTimeout(stop, SAFETY_MS);
    };

    // Capture phase, so a component calling preventDefault in its own handler
    // does not hide the navigation from us. We never call preventDefault
    // ourselves, so nothing downstream is affected.
    document.addEventListener("click", onClick, true);
    // Back/forward can restore instantly from the bfcache; make sure nothing is
    // left running from before.
    window.addEventListener("pageshow", stop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pageshow", stop);
      window.clearTimeout(showTimer.current);
      window.clearTimeout(safetyTimer.current);
    };
  }, [stop]);

  return (
    <div
      // Decorative: Next's own route announcer already tells assistive tech the
      // page changed, and a second announcement would be noise.
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[120] h-0.5 transition-opacity duration-150 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      {active && <span className="route-progress-bar block h-full bg-brand" />}
    </div>
  );
}
