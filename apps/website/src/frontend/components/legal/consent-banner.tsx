"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, BarChart3, Lock, Check } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";
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

/** Focusable descendants, in DOM order, for the focus trap. */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null);
}

/**
 * DPDP consent dialog for first-party analytics.
 *
 * Presented as a modal because a consent request is a decision the visitor is
 * being asked to make, not an announcement — the same pattern enterprise
 * consent platforms use. Deliberate choices, all load-bearing for s.6:
 *
 *  - Nothing is pre-selected and there is NO dismiss "X": dismissal is not a
 *    clear affirmative action, so it must not be a route past the question.
 *  - Reject and Accept are equal in size and weight and sit side by side.
 *    s.6(4) requires withdrawing to be as easy as giving, and a buried or
 *    de-emphasised reject fails that. Reject is also DOM-first.
 *  - Escape resolves to REJECT, never to "undecided". That keeps a keyboard
 *    escape route (WCAG 2.1.2) without ever letting an accidental keypress be
 *    read as consent.
 *  - "Manage preferences" exposes exactly what is stored and lets analytics be
 *    refused while strictly-necessary storage stays — which is honest, because
 *    the cart and session genuinely cannot be switched off.
 *  - Rendered only AFTER mount and position:fixed, so it cannot mismatch on
 *    hydration or shift layout.
 */
export function ConsentBanner() {
  const [decision, setDecision] = React.useState<ConsentRecord | null | undefined>(undefined);
  const [forced, setForced] = React.useState(false);
  const [showPrefs, setShowPrefs] = React.useState(false);
  const [analyticsOn, setAnalyticsOn] = React.useState(false);

  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const headingId = React.useId();
  const bodyId = React.useId();

  React.useEffect(() => {
    setDecision(readConsent());
    const reopen = () => {
      // Reopening from the footer should show the CURRENT setting, not a reset.
      const current = readConsent();
      setAnalyticsOn(current?.analytics === true);
      setShowPrefs(true);
      setForced(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  const open = decision === null || forced;

  const decide = React.useCallback((analytics: boolean) => {
    // Use the record saveConsent RETURNS, never a re-read. In a browser where
    // localStorage throws (Safari private mode, storage disabled, quota), the
    // write is swallowed and readConsent() would come back null — leaving
    // `decision` null, so the dialog re-opened over itself and the visitor
    // could never get past it. The in-memory record closes the dialog and the
    // session is simply un-persisted, which is the correct degradation.
    const record = saveConsent(analytics);
    // Re-evaluate the tracker immediately: granting starts measurement without
    // a reload, withdrawing stops it and drops anything already queued.
    resetTracker();
    notifyConsentChange();
    setDecision(record);
    setForced(false);
    setShowPrefs(false);
  }, []);

  // Focus management + trap + scroll lock, only while actually open.
  React.useEffect(() => {
    if (!open || decision === undefined) return;
    const panel = panelRef.current;
    if (!panel) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // Focus the panel itself rather than a button, so a screen reader announces
    // the dialog's name and description before any control.
    panel.focus({ preventScroll: true });

    // Lock the page behind the scrim. The scrollbar's width is given back as
    // padding so removing it cannot shift the layout (CLS).
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (forced) {
          // Reopened from the footer to REVIEW an existing choice. Escape means
          // "close", as it does in every other dialog — silently revoking the
          // consent they came to look at would be destructive and surprising.
          setForced(false);
          setShowPrefs(false);
        } else {
          // First run: there is no decision yet, so Escape must resolve to the
          // privacy-protective one. It never leaves the visitor undecided and
          // it can never be read as consent.
          decide(false);
        }
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = focusables(panel);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, decision, decide, forced]);

  // undefined = not read yet. Never flash the dialog before we know whether the
  // visitor already answered.
  if (decision === undefined || !open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* Scrim. Not clickable-to-dismiss: closing without choosing would leave
          the visitor undecided, and click-outside is not an affirmative act. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] motion-safe:animate-fade-up"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={cn(
          "relative m-3 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl outline-none ring-1 ring-black/5",
          "motion-safe:animate-rise-in dark:bg-surface dark:ring-white/10",
          // Column layout with only the BODY scrolling, so the actions stay
          // reachable. With preferences open on a 320px phone the content is
          // taller than the viewport, and a whole-panel scroll pushed Reject and
          // Accept below the fold — the two things that must never be hard to
          // reach.
          "max-h-[calc(100dvh-1.5rem)]",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
              <ShieldCheck aria-hidden className="h-5 w-5 text-brand-soft" />
            </span>
            <div className="min-w-0">
              <h2 id={headingId} className="font-display text-lg font-semibold text-foreground">
                Your privacy choice
              </h2>
              <p className="text-xs text-muted-foreground">
                Digital Personal Data Protection Act, 2023
              </p>
            </div>
          </div>

          <div id={bodyId} className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              We&apos;d like to measure how this site is used — pages viewed, how you arrived, device
              type — using a random identifier in your browser. It is first-party only: never shared
              with advertisers, and no IP address is stored with it.
            </p>
            <p>The site works exactly the same if you decline.</p>
          </div>

          {showPrefs ? (
            <div className="mt-5 space-y-3">
              <PreferenceRow
                icon={<Lock aria-hidden className="h-4 w-4" />}
                title="Strictly necessary"
                description="Your cart, sign-in session, theme and currency. The site cannot work without these, so they are always on and are never used for tracking."
                locked
              />
              <PreferenceRow
                icon={<BarChart3 aria-hidden className="h-4 w-4" />}
                title="Analytics"
                description="A random visitor and session identifier, the pages you view, and how you arrived."
                checked={analyticsOn}
                onChange={setAnalyticsOn}
              />
            </div>
          ) : null}
        </div>

        {/* Sticky action region — never scrolls away. */}
        <div className="shrink-0 border-t border-border p-5 pt-4 sm:p-6 sm:pt-4">
          {/* Reject is DOM-first so keyboard and screen-reader users reach it
              before Accept; on phones the row stacks with Accept uppermost for
              thumb reach, without either option changing size or weight. */}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <Button variant="outline" onClick={() => decide(false)} className="w-full sm:flex-1">
              Reject
            </Button>
            {showPrefs ? (
              <Button onClick={() => decide(analyticsOn)} className="w-full sm:flex-1">
                <Check className="h-4 w-4" /> Save choices
              </Button>
            ) : (
              <Button onClick={() => decide(true)} className="w-full sm:flex-1">
                Accept
              </Button>
            )}
          </div>

          {!showPrefs ? (
            <button
              type="button"
              onClick={() => setShowPrefs(true)}
              className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Manage preferences
            </button>
          ) : null}

          {/* Non-destructive exit, but ONLY when reopened over an existing
              decision. Someone who came from the footer just to read what they
              chose must be able to leave without changing it. It is deliberately
              absent on the first run, where there is no decision to preserve and
              a "close" would be a route past the question. */}
          {forced && decision !== null ? (
            <button
              type="button"
              onClick={() => {
                setForced(false);
                setShowPrefs(false);
              }}
              className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Close without changing
            </button>
          ) : null}
        </div>

        <p className="shrink-0 border-t border-border bg-surface/60 px-5 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6 dark:bg-background/40">
          Change this any time from{" "}
          <span className="whitespace-nowrap font-medium text-foreground/80">Privacy choices</span>{" "}
          in the footer.{" "}
          {/* New tab, deliberately. Navigating in place left the visitor on a
              blurred, scroll-locked /privacy behind a dialog they could not
              dismiss — so the s.5 notice was unreadable at the exact moment
              s.6(1) requires the consent to be informed. */}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener"
            className="font-medium text-brand-soft underline underline-offset-4 hover:text-brand"
          >
            Privacy Policy
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </p>
      </div>
    </div>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  checked,
  onChange,
  locked = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3.5 dark:bg-background/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <span className="mt-0.5 shrink-0 text-brand-soft">{icon}</span>
          <div className="min-w-0">
            <label htmlFor={id} className="block text-sm font-medium text-foreground">
              {title}
            </label>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>

        {locked ? (
          // Not a disabled switch: a control that looks operable but is not is a
          // dark pattern. This states the fact instead.
          <span
            id={id}
            className="shrink-0 whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
          >
            Always on
          </span>
        ) : (
          <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange?.(!checked)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              // zinc-500 for OFF, not a translucent muted tint: the old
              // bg-muted-foreground/30 measured 1.53:1 against the card, so in
              // light mode neither the pill nor its white thumb was discernible
              // — and OFF is the state the control is in every single time the
              // panel opens. zinc-500 clears 3:1 in both themes.
              checked ? "bg-brand" : "bg-zinc-500",
            )}
          >
            <span className="sr-only">{title}</span>
            <span
              aria-hidden
              className={cn(
                "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform",
                "h-[18px] w-[18px]",
                checked ? "translate-x-[22px]" : "translate-x-[3px]",
              )}
            />
          </button>
        )}
      </div>
    </div>
  );
}
