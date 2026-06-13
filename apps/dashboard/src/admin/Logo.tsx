import React from "react";

/**
 * Full brand logo shown on the login screen. Uses the real METNMAT artwork on a
 * clean light card so the red+black mark + serif wordmark read correctly on the
 * dark admin, with the product name beneath.
 */
export default function Logo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          borderRadius: 18,
          padding: "18px 26px",
          boxShadow: "0 18px 44px -18px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/metnmat-logo.png"
          alt="METNMAT Research & Innovations"
          style={{ height: 72, width: "auto", display: "block" }}
        />
      </span>
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 3,
          opacity: 0.55,
          fontWeight: 600,
        }}
      >
        Operations Dashboard
      </span>
    </div>
  );
}
