import React from "react";

/**
 * Nav / breadcrumb mark — the real METNMAT "M" on a small light tile so the
 * brand's red+black artwork stays crisp on the dark admin (its black strokes
 * would otherwise disappear against #09090b).
 */
export default function Icon() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        width: 22,
        height: 22,
        borderRadius: 6,
        background: "#fff",
        padding: 2.5,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
        flex: "0 0 auto",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/metnmat-mark.png"
        alt="METNMAT"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </span>
  );
}
