import type { Metadata, Viewport } from "next";
import "../(payload)/custom-admin.css";

export const metadata: Metadata = {
  title: "METNMAT Dashboard — Overview",
  description: "Operations overview for METNMAT Research & Innovations.",
  robots: { index: false, follow: false, nocache: true },
};

/*
 * Without this a phone renders the page at desktop width and scales it down,
 * so the tiles overflowed and the type was unreadable. It is the one thing the
 * Payload shell sets for /admin that this separate root layout did not.
 */
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111419" };

// Root layout for the (overview) route group — separate from Payload's /admin.
// Shares the admin stylesheet so its tokens (and both palettes) apply here too.
export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, color: "var(--theme-text)" }}>{children}</body>
    </html>
  );
}
