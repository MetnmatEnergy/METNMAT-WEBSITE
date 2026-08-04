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
    // Positioned bottom-LEFT, not full-bleed. Two reasons: a 448px column keeps
    // the body copy near the 60-75 character measure that is actually readable
    // (full width ran past 120), and the support bubble is a third-party embed
    // fixed bottom-right whose z-index we cannot reliably outrank — so the card
    // is kept out of its corner rather than stacked against it. On phones it
    // floats clear of that corner via the bottom margin.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 md:max-w-[34rem]">
      <div
        role="dialog"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        // bg-background in light (a crisp white card the shadow lifts off the
        // page) but bg-surface in dark, where an elevated surface has to be
        // LIGHTER than what is behind it or the card reads as a hole.
        className="pointer-events-auto mb-20 animate-rise-in rounded-2xl border border-border bg-background p-5 shadow-2xl ring-1 ring-black/5 motion-reduce:animate-none dark:bg-surface dark:ring-white/10 sm:p-6 md:mb-[env(safe-area-inset-bottom)]"
      >
        {/* Icon sits INLINE with the heading rather than indenting the body.
            Indenting cost ~48px of measure, which at 320px squeezed the copy
            into a ~200px column and made the card 69% of the screen. */}
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10">
            <ShieldCheck aria-hidden className="h-[18px] w-[18px] text-brand-soft" />
          </span>
          <h2 id={headingId} className="font-display text-base font-semibold text-foreground">
            Your privacy choice
          </h2>
        </div>

        <div id={bodyId} className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            We&apos;d like to measure how this site is used — pages viewed, how you arrived, device
            type — using a random identifier in your browser. It is first-party only: never shared
            with advertisers, and no IP address is stored with it.
          </p>
          <p>The site works exactly the same if you decline.</p>
        </div>

        {/* Both choices are one click, the same size, and both on screen — the
            equal-ease test in s.6(4). Decline is DOM-first so keyboard and
            screen-reader users reach it before Accept; on phones the buttons
            stack full-width, which keeps both at a comfortable tap size. */}
        <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button variant="outline" onClick={() => decide(false)} className="w-full sm:flex-1">
            Decline
          </Button>
          <Button onClick={() => decide(true)} className="w-full sm:flex-1">
            Accept
          </Button>
        </div>

        <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          Change this any time from{" "}
          <span className="whitespace-nowrap font-medium text-foreground/80">Privacy choices</span>{" "}
          in the footer.{" "}
          <Link
            href="/privacy"
            className="font-medium text-brand-soft underline underline-offset-4 hover:text-brand"
          >
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
