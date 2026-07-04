"use client";

import React from "react";
import { useTheme } from "@payloadcms/ui";

/**
 * Light/dark switch in the admin header (admin.components.actions). Uses
 * Payload's own ThemeProvider — the choice persists PER BROWSER via the
 * `payload-theme` cookie (365 days; not stored on the user account, so other
 * devices fall back to the OS-derived auto theme). html[data-theme] drives the
 * palette in custom-admin.css. The Auto option remains available under
 * /admin/account → Admin Theme.
 */
export default function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const isDark = theme !== "light";
  // Theme resolves client-side; render a stable shell until mounted so the
  // server and first client render agree (no hydration mismatch).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const next = isDark ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 30,
        padding: "0 5px",
        borderRadius: 999,
        border: "1px solid var(--theme-elevation-150)",
        background: "var(--theme-elevation-50)",
        cursor: "pointer",
        transition: "border-color .15s ease",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 999,
          fontSize: 12,
          lineHeight: 1,
          background: !mounted || isDark ? "transparent" : "var(--metnmat-brand)",
          color: !mounted || isDark ? "var(--theme-elevation-500)" : "#fff",
          transition: "background .15s ease, color .15s ease",
        }}
      >
        {/* sun */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.3 11.3 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 999,
          fontSize: 12,
          lineHeight: 1,
          background: mounted && isDark ? "var(--metnmat-brand)" : "transparent",
          color: mounted && isDark ? "#fff" : "var(--theme-elevation-500)",
          transition: "background .15s ease, color .15s ease",
        }}
      >
        {/* moon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </span>
    </button>
  );
}
