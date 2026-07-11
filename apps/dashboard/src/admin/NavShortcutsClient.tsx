"use client";

import React from "react";
import { usePathname } from "next/navigation";

/**
 * Sidebar quick-nav: Home, an expandable Analytics section (the nine analytics
 * pages), and View live site. Client component so it can mark the active route
 * and remember the expand state, mirroring Payload's own nav behaviour. Icons
 * are inline lucide-style strokes (currentColor) so they inherit hover/active/
 * brand colours from custom-admin.css — no emoji, no images.
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

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg {...svgProps} width={13} height={13} style={{ marginLeft: "auto", transition: "transform .15s ease", transform: open ? "rotate(90deg)" : "none" }}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const ExtIcon = () => (
  <svg {...svgProps} width={13} height={13} className="mn-shortcut__ext">
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
);

const ANALYTICS_ITEMS: { slug: string; label: string }[] = [
  { slug: "", label: "Highlights" },
  { slug: "realtime", label: "Real-time" },
  { slug: "traffic", label: "Traffic" },
  { slug: "behavior", label: "Behavior" },
  { slug: "marketing", label: "Marketing" },
  { slug: "recordings", label: "Session Recordings" },
  { slug: "insights", label: "Insights" },
  { slug: "benchmarks", label: "Benchmarks" },
  { slug: "reports", label: "All Reports" },
];

const K_EXPANDED = "mm-nav-analytics-open";

export function NavShortcutsClient({ siteUrl }: { siteUrl: string }) {
  const pathname = usePathname() || "";
  const isHome = pathname === "/admin" || pathname === "/admin/";
  const inAnalytics = pathname.startsWith("/admin/analytics");

  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    try {
      setOpen(inAnalytics || localStorage.getItem(K_EXPANDED) === "1");
    } catch {
      setOpen(inAnalytics);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(K_EXPANDED, o ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !o;
    });
  };

  const activeSub = (slug: string) => {
    const p = pathname.replace(/\/$/, "");
    return slug === "" ? p === "/admin/analytics" : p === `/admin/analytics/${slug}`;
  };

  return (
    <nav className="mn-shortcuts" aria-label="Quick navigation">
      <a className={`mn-shortcut${isHome ? " is-active" : ""}`} href="/admin" aria-current={isHome ? "page" : undefined}>
        <HomeIcon /> Home
      </a>

      <button
        type="button"
        className={`mn-shortcut${inAnalytics && !open ? " is-active" : ""}`}
        onClick={toggle}
        aria-expanded={open}
        aria-controls="mn-analytics-subnav"
        style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "none", font: "inherit" }}
      >
        <AnalyticsIcon /> Analytics
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div id="mn-analytics-subnav" style={{ display: "grid", gap: 1, paddingLeft: 14, borderLeft: "1px solid var(--theme-elevation-100)", marginLeft: 18 }}>
          {ANALYTICS_ITEMS.map((i) => {
            const active = activeSub(i.slug);
            return (
              <a
                key={i.slug || "highlights"}
                className={`mn-shortcut${active ? " is-active" : ""}`}
                style={{ padding: "6px 10px", fontSize: 12.5 }}
                href={`/admin/analytics${i.slug ? `/${i.slug}` : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {i.label}
              </a>
            );
          })}
        </div>
      )}

      <a className="mn-shortcut mn-shortcut--live" href={siteUrl} target="_blank" rel="noopener noreferrer">
        <GlobeIcon /> View live site
        <ExtIcon />
      </a>
    </nav>
  );
}
