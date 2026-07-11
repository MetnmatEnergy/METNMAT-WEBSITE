import React from "react";

/**
 * Wix-style top-of-sidebar shortcuts (via admin.beforeNavLinks, under the logo):
 * Home (dashboard), Analytics (custom view), and View live site. Server
 * component — reads WEBSITE_URL from the server env for the live-site link.
 */
const item: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 12px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  color: "var(--theme-text)",
  background: "var(--theme-elevation-50)",
  border: "1px solid var(--theme-elevation-100)",
};

export default function NavShortcuts() {
  const site = (process.env.WEBSITE_URL || "https://www.metnmat.com").replace(/\/+$/, "");
  return (
    <nav aria-label="Quick navigation" style={{ display: "grid", gap: 6, padding: "0 10px 16px" }}>
      <a href="/admin" style={item}>
        <span aria-hidden>🏠</span> Home
      </a>
      <a href="/admin/analytics" style={item}>
        <span aria-hidden>📊</span> Analytics
      </a>
      <a href={site} target="_blank" rel="noopener noreferrer" style={item}>
        <span aria-hidden>🌐</span> View live site
        <span style={{ marginLeft: "auto", opacity: 0.45, fontSize: 11 }}>↗</span>
      </a>
    </nav>
  );
}
