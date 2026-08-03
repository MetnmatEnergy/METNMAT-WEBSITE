"use client";

import { openConsentSettings } from "./consent-banner";

/**
 * Reopens the consent choice from the footer.
 *
 * DPDP s.6(4): withdrawing consent must be as easy as giving it. A permanent,
 * site-wide entry point is what makes that true — the banner itself is shown
 * once, so without this a visitor who accepted would have no way back.
 *
 * A button, not a link: it changes state rather than navigating, so it must not
 * be announced as a destination.
 */
export function PrivacyChoicesLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openConsentSettings} className={className}>
      Privacy choices
    </button>
  );
}
