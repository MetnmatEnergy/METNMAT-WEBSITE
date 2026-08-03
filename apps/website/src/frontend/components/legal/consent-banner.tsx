"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { resetTracker } from "@/frontend/lib/analytics/collector";
import {
  notifyConsentChange,
  readConsent,
  saveConsent,
  type ConsentRecord,
} from "@/frontend/lib/consent";

/** Footer (or anywhere) can dispatch this to reopen the choice. */
export const OPEN_CONSENT_EVENT = "mm:open-consent";

export function openConsentSettings(): void {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT));
  } catch {
    /* no-op */
  }
}

/**
 * DPDP consent notice for first-party analytics.
 *
 * Deliberate choices, all of them load-bearing for s.6:
 *  - Nothing is pre-selected and closing is not a decision — the banner has no
 *    dismiss "X", because dismissal-as-consent is not a clear affirmative act.
 *  - Accept and Decline are the same size and weight. s.6(4) requires
 *    withdrawing to be as easy as giving, and a greyed-out decline fails that.
 *  - It renders only AFTER mount and is position:fixed, so it can neither
 *    cause a hydration mismatch nor shift layout (CLS).
 *  - It never blocks the page: no backdrop, no focus trap. Someone who wants
 *    to read the privacy policy first can.
 */
export function ConsentBanner() {
  const [decision, setDecision] = React.useState<ConsentRecord | null | undefined>(undefined);
  const [forced, setForced] = React.useState(false);
  const headingId = React.useId();
  const bodyId = React.useId();

  // Read only after mount — localStorage is not available during SSR, and
  // rendering the banner on the server would mismatch on hydration.
  React.useEffect(() => {
    setDecision(readConsent());
    const reopen = () => setForced(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  const decide = React.useCallback((analytics: boolean) => {
    const record = saveConsent(analytics);
    // Re-evaluate the tracker immediately: granting starts measurement without
    // a reload, withdrawing stops it and drops anything already queued.
    resetTracker();
    notifyConsentChange();
    setDecision(record);
    setForced(false);
  }, []);

  // undefined = not read yet (first paint). Never flash the banner before we
  // know whether the visitor already answered.
  if (decision === undefined) return null;
  if (decision !== null && !forced) return null;

  return (
    <div
      role="dialog"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      // z-50 clears the header (z-40) and the cart rail; pe-20 on the inner row
      // keeps the buttons off the chat bubble, which a third-party embed fixes
      // to the bottom-right corner.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 gap-3">
          <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-soft" />
          <div className="min-w-0">
            <p id={headingId} className="text-sm font-semibold text-foreground">
              Your privacy choice
            </p>
            <p id={bodyId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
              We&apos;d like to measure how this site is used — pages viewed, how you arrived and
              device type — using a random identifier stored in your browser. It is first-party
              only: never shared with advertisers, and your IP address is not stored with it. The
              site works exactly the same if you decline, and you can change this any time from{" "}
              <span className="whitespace-nowrap">&ldquo;Privacy choices&rdquo;</span> in the footer.{" "}
              <Link href="/privacy" className="font-medium text-brand-soft underline underline-offset-4">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
        {/* Both choices are one click, the same size, and both on screen — the
            equal-ease test in s.6(4). Decline is DOM-first so keyboard and
            screen-reader users reach it before Accept; flex-col-reverse then
            renders it lowest on a phone, which is the easier thumb reach. */}
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row lg:ms-auto">
          <Button variant="outline" onClick={() => decide(false)} className="w-full sm:w-auto">
            Decline
          </Button>
          <Button onClick={() => decide(true)} className="w-full sm:w-auto">
            Accept analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
