"use client";

/**
 * Root-level error boundary. Unlike error.tsx (which renders inside the root
 * layout), global-error.tsx catches failures in the ROOT layout / its metadata
 * itself, so it must render its own <html>/<body> and cannot rely on the app's
 * CSS or fonts loading — hence fully inline, self-contained styles. Without this
 * a root-layout throw falls back to Next's unstyled default crash page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          color: "#0a0a0b",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(216,31,38,0.1)",
              color: "#d81f26",
              fontWeight: 800,
              fontSize: 24,
            }}
          >
            M
          </div>
          <h1 style={{ marginTop: 24, fontSize: 24, fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "#52525b" }}>
            An unexpected error occurred. It&apos;s usually temporary — please try again. If it keeps
            happening, email us at contact@metnmat.com.
          </p>
          {error?.digest && (
            <p style={{ marginTop: 8, fontSize: 12, color: "#a1a1aa" }}>Ref: {error.digest}</p>
          )}
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                background: "#d81f26",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* Hard <a> on purpose: the router/layout may be broken here, so a
                full-document navigation is the reliable recovery path. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: 999,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                border: "1px solid #e4e4e7",
                color: "#0a0a0b",
                textDecoration: "none",
              }}
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
