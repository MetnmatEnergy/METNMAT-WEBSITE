"use client";

import React from "react";

const BRAND = "#d81f26";

/**
 * Primary sign-in for staff: a 4-digit PIN pad rendered above Payload's login
 * form (which global CSS hides). Submits to /pin-login, which sets the session
 * cookie and redirects to /admin. A discreet link reveals the email/password
 * form for break-glass admin recovery.
 */
export default function PinLogin() {
  const [digits, setDigits] = React.useState<string[]>(["", "", "", ""]);
  const [error, setError] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  React.useEffect(() => {
    refs.current[0]?.focus();
  }, []);

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
      setError(data.error || "Sign-in failed. Try again.");
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
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-recovery", "true");
      setTimeout(() => {
        document.querySelector<HTMLInputElement>('.login__form input[type="email"], #field-email')?.focus();
      }, 50);
    }
  };

  return (
    <div data-pin-login style={{ marginBottom: 22 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Enter your 4-digit key</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, opacity: 0.6 }}>
        Sign in to the METNMAT Operations Dashboard.
      </p>

      <div style={{ display: "flex", gap: 12 }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            disabled={loading}
            inputMode="numeric"
            autoComplete="one-time-code"
            type="password"
            maxLength={1}
            aria-label={`PIN digit ${i + 1}`}
            style={{
              width: 56,
              height: 64,
              textAlign: "center",
              fontSize: 26,
              fontWeight: 700,
              borderRadius: 12,
              border: `1.5px solid ${error ? BRAND : "var(--theme-elevation-150, #2a2a2e)"}`,
              background: "var(--theme-input-bg, #161618)",
              color: "var(--theme-text, #fff)",
              outlineColor: BRAND,
              transition: "border-color .15s",
            }}
          />
        ))}
      </div>

      <div style={{ minHeight: 20, marginTop: 12 }}>
        {error && <span style={{ color: BRAND, fontSize: 13, fontWeight: 600 }}>{error}</span>}
        {loading && !error && <span style={{ fontSize: 13, opacity: 0.6 }}>Signing in…</span>}
      </div>

      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          onClick={showRecovery}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--theme-text, #fff)",
            opacity: 0.5,
            fontSize: 12.5,
            textDecoration: "underline",
          }}
        >
          Admin recovery sign-in (email &amp; password)
        </button>
      </div>

      <div
        aria-hidden
        style={{
          margin: "22px 0 4px",
          height: 1,
          background: "var(--theme-elevation-100, #232326)",
        }}
      />
    </div>
  );
}
