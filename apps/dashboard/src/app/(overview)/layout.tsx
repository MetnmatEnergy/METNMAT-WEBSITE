import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METNMAT Dashboard — Overview",
  description: "Operations overview for METNMAT Research & Innovations.",
};

// Root layout for the (overview) route group — separate from Payload's /admin.
export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0a0a0b",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
