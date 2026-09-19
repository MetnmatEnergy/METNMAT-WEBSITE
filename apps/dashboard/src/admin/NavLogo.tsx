import React from "react";

/**
 * Brand lockup pinned to the top of the sidebar (via admin.beforeNavLinks):
 * the METNMAT mark on a small light tile beside a two-line wordmark — the same
 * 56px header row the Command Center's sidebar uses. It replaced a full-width
 * logo card that took the first quarter of a phone screen before the first
 * link (owner feedback, 2026-09-19); the full artwork still fronts the login.
 */
export default function NavLogo() {
  return (
    <a href="/admin" className="mn-brand" aria-label="METNMAT — Operations Dashboard">
      <span className="mn-brand__tile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/metnmat-mark.png" alt="" className="mn-brand__mark" />
      </span>
      <span className="mn-brand__text">
        <span className="mn-brand__name">METNMAT</span>
        <span className="mn-brand__sub">Operations Dashboard</span>
      </span>
    </a>
  );
}
