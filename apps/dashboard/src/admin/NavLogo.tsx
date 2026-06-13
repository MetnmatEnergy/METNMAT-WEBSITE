import React from "react";

/**
 * Full METNMAT logo pinned to the top of the sidebar (via admin.beforeNavLinks).
 * On a clean light card so the red+black mark + wordmark read correctly against
 * the dark nav — the prominent brand lockup, while the breadcrumb keeps just the
 * compact mark.
 */
export default function NavLogo() {
  return (
    <a
      href="/admin"
      aria-label="METNMAT — Operations Dashboard"
      style={{ display: "block", padding: "4px 10px 14px", textDecoration: "none" }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          borderRadius: 12,
          padding: "14px 16px",
          boxShadow: "0 6px 18px -10px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/metnmat-logo.png"
          alt="METNMAT Research & Innovations"
          style={{ width: "100%", maxWidth: 150, height: "auto", display: "block" }}
        />
      </span>
    </a>
  );
}
