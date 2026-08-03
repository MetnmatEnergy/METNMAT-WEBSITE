"use client";

/**
 * Consent record for the DPDP Act, 2023.
 *
 * Section 6 requires consent that is free, specific, informed, unconditional
 * and unambiguous, given by a CLEAR AFFIRMATIVE ACTION — so nothing here
 * defaults to true, and "no decision yet" is deliberately distinct from "no".
 * Section 6(4) requires withdrawal to be as easy as giving, which is why
 * `saveConsent(false)` also erases the identifiers rather than merely
 * stopping new collection.
 *
 * Only ONE consent is asked for: first-party analytics. Everything else the
 * site stores (cart, theme, auth session) is strictly necessary to deliver a
 * service the user asked for and is not bundled into this prompt — bundling
 * would make the consent conditional, which s.6(1) forbids.
 *
 * The record is versioned: raising CONSENT_VERSION re-asks everyone, which is
 * what a material change of purpose requires.
 */

import { K_VISITOR, K_SESSION, K_LAST_ACTIVE } from "./analytics/session";

export const CONSENT_VERSION = 1;
export const K_CONSENT = "mm-consent";

export type ConsentRecord = {
  /** Schema/policy version this decision was made against. */
  v: number;
  /** First-party analytics measurement. */
  analytics: boolean;
  /** ISO timestamp — the DPDP audit trail for when consent was given. */
  at: string;
};

/**
 * The visitor's decision, or null when they have not decided yet.
 * A record from an older CONSENT_VERSION is treated as "not decided".
 */
export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(K_CONSENT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed?.v !== CONSENT_VERSION || typeof parsed.analytics !== "boolean") return null;
    return { v: parsed.v, analytics: parsed.analytics, at: String(parsed.at ?? "") };
  } catch {
    // Corrupt or unavailable storage must read as "undecided", never as consent.
    return null;
  }
}

/** True only on an explicit, current-version yes. */
export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

/**
 * Erase the analytics identifiers held in the browser. Called on withdrawal so
 * that "withdraw" means the identity is gone, not just unused.
 */
export function clearAnalyticsIdentity(): void {
  if (typeof window === "undefined") return;
  for (const k of [K_VISITOR, K_SESSION, K_LAST_ACTIVE]) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage unavailable — nothing to erase */
    }
  }
}

/** Record a decision. Withdrawal also erases the identifiers. */
export function saveConsent(analytics: boolean): ConsentRecord {
  const record: ConsentRecord = { v: CONSENT_VERSION, analytics, at: new Date().toISOString() };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(K_CONSENT, JSON.stringify(record));
    } catch {
      /* a visitor who blocks storage simply gets no persisted consent */
    }
  }
  if (!analytics) clearAnalyticsIdentity();
  return record;
}

/** Event the banner dispatches so the analytics provider can react immediately. */
export const CONSENT_EVENT = "mm:consent-change";

export function notifyConsentChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
  } catch {
    /* older browsers just pick the decision up on the next page load */
  }
}
