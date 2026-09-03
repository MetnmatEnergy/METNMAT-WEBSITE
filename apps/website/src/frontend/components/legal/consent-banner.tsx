"use client";

import * as React from "react";
import { bodyScrollLock } from "@/frontend/lib/scroll-lock";
import Link from "next/link";
import { ShieldCheck, BarChart3, Lock, Check } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";
import {
  NOTICE_LANGUAGES,
  NOTICE_LANGUAGE_KEYS,
  preferredNoticeLanguage,
} from "@/frontend/lib/consent-i18n";
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
  // Starts from the browser preference — an option nobody finds is not an
  // option. English is always available and is the authoritative text.
  const [langKey, setLangKey] = React.useState("en");
  const t = NOTICE_LANGUAGES[langKey] ?? NOTICE_LANGUAGES.en;

  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const headingId = React.useId();
  const bodyId = React.useId();

  React.useEffect(() => {
    setDecision(readConsent());
    setLangKey(preferredNoticeLanguage());
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

  // Focus trap + scroll lock apply ONLY to the preferences dialog.
  //
  // The first-run notice is a bar, not a modal: it asks for a decision without
  // taking the page hostage, which is the pattern every enterprise consent
  // platform uses. Trapping focus or locking scroll behind a bar would be
  // wrong — the visitor is meant to be able to read the site, and the policy
  // links in the bar have to be reachable. The dialog that the bar opens IS
  // modal, and gets both.
  React.useEffect(() => {
    if (!open || decision === undefined || !showPrefs) return;
    const panel = panelRef.current;
    if (!panel) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // Focus the panel itself rather than a button, so a screen reader announces
    // the dialog's name and description before any control.
    panel.focus({ preventScroll: true });

    // Lock the page behind the scrim. The scrollbar's width is given back as
    // padding so removing it cannot shift the layout (CLS). Reference-counted,
    // because this dialog can be opened from the footer while a drawer is
    // already holding the lock — see lib/scroll-lock.
    const releaseScroll = bodyScrollLock.acquire();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        // Escape never changes a stored decision. Reopened from the footer it
        // closes outright; on a first visit it returns to the notice bar, which
        // still carries Reject and Accept. Either way the visitor keeps a
        // keyboard way out (WCAG 2.1.2) without a keypress ever being read as
        // consent OR silently revoking consent they came to read.
        if (forced) {
          setForced(false);
          setShowPrefs(false);
        } else {
          setShowPrefs(false);
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
      releaseScroll();
      restoreFocusRef.current?.focus?.();
    };
  }, [open, decision, showPrefs, forced]);

  // undefined = not read yet. Never flash the dialog before we know whether the
  // visitor already answered.
  if (decision === undefined || !open) return null;

  // ── The notice bar ────────────────────────────────────────────────────────
  // Default presentation. Full-bleed, pinned to the bottom, non-modal: it asks
  // for a decision without taking the page hostage. Both choices are on it, so
  // nobody has to open anything to answer.
  if (!showPrefs) {
    return (
      <div
        role="region"
        // aria-LABEL, not labelledby: the bar has no heading now (the reference
        // layout is one flowing sentence), and naming a region by a 60-word
        // paragraph gives a screen reader a useless landmark name.
        aria-label={t.heading}
        // z-index measured, not guessed: the support widget injects
        // #chat-widget-container at 999999.
        // Solid, not translucent. At bg-background/98 with a blur the hero
        // headline and product cards still read through the copy — a legal
        // notice has to be legible over whatever happens to be behind it, and
        // the page underneath is high-contrast brand red.
        className="fixed inset-x-0 bottom-0 z-[1000000] border-t border-border bg-background shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.18)] motion-safe:animate-rise-in dark:bg-surface"
        lang={t.lang}
      >
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:gap-10">
          {/* One flowing sentence with the links INLINE, as in the reference —
              no heading, no icon. Keeps the bar to two lines on a desktop
              width, which is what makes it read as a notice rather than a
              panel. */}
          <p
            className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted-foreground sm:text-sm"
          >
            {t.barText}{" "}
            {/* Rule 3: the notice itself carries the routes to withdraw, to
                exercise rights and to complain — not merely a mention of them.
                New tab so following one never leaves the notice unreadable. */}
            {[
              { href: "/privacy", label: t.footerLink },
              { href: "/privacy/request", label: t.rightsLink },
              { href: "/privacy#grievance", label: t.complaintLink },
            ].map((l, i) => (
              <React.Fragment key={l.href}>
                {i > 0 ? <span aria-hidden> · </span> : null}
                <Link
                  href={l.href}
                  target="_blank"
                  rel="noopener"
                  className="font-semibold text-brand-soft underline underline-offset-2 hover:text-brand"
                >
                  {l.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>
              </React.Fragment>
            ))}
          </p>

          {/* Actions, right-aligned. Reject is DOM-first for keyboard and
              screen-reader order, and both buttons are identical in size AND
              fill — the s.6(4) equal-ease test, which the reference bar also
              satisfies by making both the same blue.

              NO dismiss "X", unlike the reference. Under DPDP s.6 consent is a
              clear affirmative action, so closing cannot be a route past the
              question — an X would leave the visitor undecided while looking
              like an answer. The language select stays for the same kind of
              reason: s.5(3) requires the notice to be available in an Eighth
              Schedule language. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:gap-3 lg:flex-nowrap">
            <select
              aria-label={t.languageLabel}
              value={langKey}
              onChange={(e) => setLangKey(e.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:bg-background/40"
            >
              {NOTICE_LANGUAGE_KEYS.map((k) => (
                <option key={k} value={k} lang={NOTICE_LANGUAGES[k].lang}>
                  {NOTICE_LANGUAGES[k].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowPrefs(true)}
              className="h-10 whitespace-nowrap px-2 text-sm font-semibold text-foreground underline-offset-4 transition-colors hover:underline"
            >
              {t.manage}
            </button>
            <Button onClick={() => decide(false)} className="min-w-[130px] flex-1 sm:flex-none">
              {t.reject}
            </Button>
            <Button onClick={() => decide(true)} className="min-w-[130px] flex-1 sm:flex-none">
              {t.accept}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── The preferences dialog ────────────────────────────────────────────────
  // Modal, because this one IS a focused task: it shows exactly what is stored
  // and lets analytics be refused while strictly-necessary storage stays.
  return (
    <div className="fixed inset-0 z-[1000000] flex items-end justify-center sm:items-center">
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
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6" lang={t.lang}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
              <ShieldCheck aria-hidden className="h-5 w-5 text-brand-soft" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={headingId} className="font-display text-lg font-semibold text-foreground">
                {t.heading}
              </h2>
              <p className="text-xs text-muted-foreground">{t.act}</p>
            </div>

            {/* DPDP s.5(3): the notice must be available in English or an
                Eighth Schedule language, and the option belongs HERE — at the
                point of collection — not only on the policy page. */}
            {/* aria-label rather than a wrapping <label>: a label that wraps a
                <select> also contains its options, which makes the computed
                accessible name depend on the browser's name-from-content rules.
                This one is unambiguous. */}
            <select
              aria-label={t.languageLabel}
              value={langKey}
              onChange={(e) => setLangKey(e.target.value)}
              className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:bg-background/40"
            >
              {NOTICE_LANGUAGE_KEYS.map((k) => (
                <option key={k} value={k} lang={NOTICE_LANGUAGES[k].lang}>
                  {NOTICE_LANGUAGES[k].label}
                </option>
              ))}
            </select>
          </div>

          <div id={bodyId} className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>{t.body1}</p>
            <p>{t.body2}</p>
          </div>

          {showPrefs ? (
            <div className="mt-5 space-y-3">
              <PreferenceRow
                icon={<Lock aria-hidden className="h-4 w-4" />}
                title={t.necessaryTitle}
                description={t.necessaryDesc}
                lockedLabel={t.alwaysOn}
                locked
              />
              <PreferenceRow
                icon={<BarChart3 aria-hidden className="h-4 w-4" />}
                title={t.analyticsTitle}
                description={t.analyticsDesc}
                checked={analyticsOn}
                onChange={setAnalyticsOn}
              />
            </div>
          ) : null}

          {/* Stated, not implied: a translation is an aid, the English governs. */}
          {t.authoritative ? (
            <p className="mt-4 text-xs italic text-muted-foreground">{t.authoritative}</p>
          ) : null}
        </div>

        {/* Sticky action region — never scrolls away. */}
        <div className="shrink-0 border-t border-border p-5 pt-4 sm:p-6 sm:pt-4">
          {/* Reject is DOM-first so keyboard and screen-reader users reach it
              before Accept; on phones the row stacks with Accept uppermost for
              thumb reach, without either option changing size or weight. */}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <Button variant="outline" onClick={() => decide(false)} className="w-full sm:flex-1">
              {t.reject}
            </Button>
            <Button onClick={() => decide(analyticsOn)} className="w-full sm:flex-1">
              <Check className="h-4 w-4" /> {t.save}
            </Button>
          </div>

          {/* A way out that changes nothing.
              Reopened from the footer, it closes — someone who came to read what
              they chose must be able to leave without altering it.
              On a first visit it returns to the notice bar, which still carries
              both choices, so this is never a route PAST the question. */}
          <button
            type="button"
            onClick={() => {
              setShowPrefs(false);
              if (forced) setForced(false);
            }}
            className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {forced && decision !== null ? t.closeNoChange : t.back}
          </button>
        </div>

        {/* Rule 3 of the DPDP Rules, 2025 requires the notice itself to carry
            the communication links for withdrawing consent and exercising
            rights, and the means of complaining to the Board — not merely to
            mention that those rights exist. All open in a NEW TAB: navigating in
            place left the visitor on a blurred, scroll-locked page behind a
            dialog they could not dismiss, so the notice was unreadable at the
            exact moment s.6(1) requires the consent to be informed. */}
        <div className="shrink-0 border-t border-border bg-surface/60 px-5 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6 dark:bg-background/40">
          <p>{t.footerPre}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {[
              { href: "/privacy", label: t.footerLink },
              { href: "/privacy/request", label: t.rightsLink },
              { href: "/privacy#grievance", label: t.complaintLink },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener"
                className="font-medium text-brand-soft underline underline-offset-4 hover:text-brand"
              >
                {l.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            ))}
          </p>
        </div>
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
  lockedLabel = "Always on",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
  lockedLabel?: string;
}) {
  // A <label htmlFor> pointed at the "Always on" <span>, which is not a
  // labelable element, so the title and its state were two adjacent strings
  // with no programmatic link. The row is a group named by its title, and the
  // switch is named and described by the same nodes — no sr-only duplicate.
  const titleId = React.useId();
  const descId = React.useId();
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="rounded-xl border border-border bg-surface/60 p-3.5 dark:bg-background/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <span className="mt-0.5 shrink-0 text-brand-soft">{icon}</span>
          <div className="min-w-0">
            <p id={titleId} className="text-sm font-medium text-foreground">
              {title}
            </p>
            <p id={descId} className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {locked ? (
          // Not a disabled switch: a control that looks operable but is not is a
          // dark pattern. This states the fact instead.
          <span className="shrink-0 whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {lockedLabel}
          </span>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={titleId}
            aria-describedby={descId}
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
            {/* No sr-only label: aria-labelledby already names this from the
                visible title, and a duplicate would be announced twice. */}
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
