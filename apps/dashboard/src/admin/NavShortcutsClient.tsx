"use client";

import React from "react";
import { usePathname } from "next/navigation";

/**
 * Sidebar quick-nav (Home / Analytics / View live site). Client component so it
 * can mark the active route, mirroring Payload's own nav highlight. Icons are
 * inline lucide-style strokes (currentColor) so they inherit hover/active/brand
 * colours from custom-admin.css — no emoji, no images.
 */

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const HomeIcon = () => (
  <svg {...svgProps}>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg {...svgProps}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const GlobeIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

const ExtIcon = () => (
  <svg {...svgProps} width={13} height={13} className="mn-shortcut__ext">
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
);

export function NavShortcutsClient({ siteUrl }: { siteUrl: string }) {
  const pathname = usePathname() || "";
  const isHome = pathname === "/admin" || pathname === "/admin/";
  const isAnalytics = pathname.startsWith("/admin/analytics");

  return (
    <nav className="mn-shortcuts" aria-label="Quick navigation">
      <a className={`mn-shortcut${isHome ? " is-active" : ""}`} href="/admin" aria-current={isHome ? "page" : undefined}>
        <HomeIcon /> Home
      </a>
      <a
        className={`mn-shortcut${isAnalytics ? " is-active" : ""}`}
        href="/admin/analytics"
        aria-current={isAnalytics ? "page" : undefined}
      >
        <AnalyticsIcon /> Analytics
      </a>
      <a className="mn-shortcut mn-shortcut--live" href={siteUrl} target="_blank" rel="noopener noreferrer">
        <GlobeIcon /> View live site
        <ExtIcon />
      </a>
    </nav>
  );
}
