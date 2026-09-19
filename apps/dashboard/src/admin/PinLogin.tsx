"use client";

import React from "react";

/**
 * Primary sign-in for staff: a 4-digit PIN pad rendered above Payload's login
 * form (which global CSS hides). Submits to /pin-login, which sets the session
 * cookie and redirects to /admin. A discreet link reveals the email/password
 * form for break-glass admin recovery.
 *
 * WHAT THE COPY IS FOR. Staff have no password — the key IS the account — and
 * the recovery form only works for accounts created without a PIN. Both facts
 * were invisible on the old screen, so the director tried an email address and
 * a stored secret in the recovery form and got nowhere (2026-09-19). The screen
 * now says which door is which.
 *
 * THE COUNTDOWN. /pin-login answers 429 with Retry-After after five misses
 * from one address. Showing "try again in 15 minutes" with no clock reads as
 * "broken"; a ticking timer reads as "wait", and disabling the pad until it
 * expires stops the wait being extended by reflexive retries.
 */
export default function PinLogin() {
  const [digits, setDigits] = React.useState<string[]>(["", "", "", ""]);
  const [error, setError] = React.useState<string>("");
  const [misses, setMisses] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [retryAt, setRetryAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [recovery, setRecovery] = React.useState(false);
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  React.useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  // Tick once a second only while a lockout is showing.
  React.useEffect(() => {
    if (!retryAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [retryAt]);

  const locked = retryAt !== null && retryAt > now;
  React.useEffect(() => {
    if (retryAt !== null && !locked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the lock has expired; clear it and hand focus back
      setRetryAt(null);
      setError("");
      refs.current[0]?.focus();
    }
  }, [locked, retryAt]);

  const submit = React.useCallback(async (pin: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirect?: string };
      if (res.ok) {
        window.location.href = data.redirect || "/admin";
        return;
      }
      if (res.status === 429) {
        const secs = Number(res.headers.get("Retry-After")) || 15 * 60;
        setRetryAt(Date.now() + secs * 1000);
        setNow(Date.now());
        setError("Too many attempts from this connection.");
      } else {
        setMisses((m) => m + 1);
        setError(data.error || "Sign-in failed. Try again.");
      }
      setDigits(["", "", "", ""]);
      setLoading(false);
      refs.current[0]?.focus();
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }, []);

  const setAt = (i: number, val: string) => {
    const v = val.replace(/\D/g, "");
    setError("");
    if (v.length > 1) {
      // Pasted multiple digits — distribute across the boxes.
      const next = v.slice(0, 4).split("");
      const filled = ["", "", "", ""].map((_, idx) => next[idx] ?? "");
      setDigits(filled);
      const lastIdx = Math.min(next.length, 4) - 1;
      refs.current[Math.min(lastIdx + 1, 3)]?.focus();
      if (filled.every((d) => d !== "")) void submit(filled.join(""));
      return;
    }
    const updated = [...digits];
    updated[i] = v;
    setDigits(updated);
    if (v && i < 3) refs.current[i + 1]?.focus();
    if (updated.every((d) => d !== "")) void submit(updated.join(""));
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const showRecovery = () => {
    setRecovery(true);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-recovery", "true");
      setTimeout(() => {
        document.querySelector<HTMLInputElement>('.login__form input[type="email"], #field-email')?.focus();
      }, 50);
    }
  };

  const remaining = locked ? Math.max(0, Math.ceil((retryAt! - now) / 1000)) : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const disabled = loading || locked;

  return (
    <div data-pin-login className="mn-pin">
      <h2 className="mn-pin__title">Sign in with your 4-digit key</h2>
      <p className="mn-pin__lede">
        Your key is the PIN the director issued to you. There is no email or password to type — the four
        digits are your whole sign-in.
      </p>

      <div className="mn-pin__pad" role="group" aria-label="4-digit key">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="one-time-code"
            type="password"
            maxLength={1}
            aria-label={`PIN digit ${i + 1}`}
            className={`mn-pin__digit${error ? " is-error" : ""}`}
          />
        ))}
      </div>

      <div className="mn-pin__status" aria-live="polite">
        {locked ? (
          <span className="mn-pin__error">
            {error} Try again in <strong style={{ fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</strong>.
          </span>
        ) : error ? (
          <span className="mn-pin__error">{error}</span>
        ) : loading ? (
          <span className="mn-pin__muted">Signing in…</span>
        ) : null}
        {!locked && misses >= 2 && (
          <span className="mn-pin__hint">
            Keys are exactly four digits. If yours was reset recently, ask the director for the new one — five
            misses from one connection pause sign-in for 15 minutes.
          </span>
        )}
      </div>

      <div className="mn-pin__foot">
        {!recovery && (
          <button type="button" onClick={showRecovery} className="mn-pin__link">
            Recovery sign-in with email &amp; password
          </button>
        )}
      </div>

      {recovery && (
        <p className="mn-pin__recovery-note">
          <strong>Recovery accounts only.</strong> An account that signs in with a key has no separate
          password, so this form will not accept it — use the key above. Email &amp; password work only for
          accounts created without a PIN.
        </p>
      )}

      <div aria-hidden className="mn-pin__rule" />
    </div>
  );
}
