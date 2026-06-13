"use client";

import React from "react";
import { useFormFields } from "@payloadcms/ui";

const GST = 0.18;
const BRAND = "#d81f26";

/**
 * Read-only helper shown under the price row in the product editor. It reads the
 * current ₹ price from the form and the live ₹/$ rate, and shows what
 * international customers will pay in USD — so employees can see the auto-
 * conversion without doing math. Purely informational (a `ui` field, not bound
 * to data), so it can never block or break saving.
 */
export default function UsdPriceHint() {
  const price = useFormFields(([fields]) => fields?.price?.value as number | string | undefined);
  const usdPrice = useFormFields(([fields]) => fields?.usdPrice?.value as number | string | undefined);

  const [rate, setRate] = React.useState<number | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch("/usd-rate", { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { inrPerUsd?: number }) => {
        if (alive) setRate(Number(j?.inrPerUsd) || null);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const p = Number(price) || 0;
  const manual = usdPrice != null && usdPrice !== "" && Number(usdPrice) > 0;
  const inclInr = Math.round(p * (1 + GST));
  const auto = rate && p > 0 ? inclInr / rate : null;
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);

  let body: React.ReactNode;
  let active = false; // brand tint for live/actionable states; neutral otherwise
  if (p <= 0) {
    body = <>This is a <strong>quote-only</strong> product (₹ price is 0), so no USD price is shown.</>;
  } else if (manual) {
    active = true;
    body = (
      <>
        International customers will see exactly{" "}
        <strong style={{ color: BRAND }}>{fmtUsd(Number(usdPrice))}</strong> — the final,
        tax-inclusive price (shown as you type it).{" "}
        {auto != null && <span style={{ opacity: 0.7 }}>Auto-convert would be ≈ {fmtUsd(auto)}. </span>}
        Clear the USD field to switch back to automatic conversion.
      </>
    );
  } else if (auto != null) {
    active = true;
    body = (
      <>
        USD field is blank → international customers see{" "}
        <strong style={{ color: BRAND }}>≈ {fmtUsd(auto)}</strong>{" "}
        <span style={{ opacity: 0.7 }}>(incl. GST, auto-converted at ₹{rate!.toFixed(2)} / $1, live)</span>.
        Enter a value to set a fixed USD price instead.
      </>
    );
  } else if (failed) {
    body = (
      <>Couldn&apos;t load the live rate here — international customers&apos; USD prices are still
        auto-converted from ₹ at the latest rate on the website. Enter a value to set a fixed USD price.</>
    );
  } else {
    body = <>Loading live exchange rate…</>;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        background: active ? "color-mix(in srgb, #d81f26 8%, transparent)" : "var(--theme-elevation-50)",
        border: `1px solid ${active ? "color-mix(in srgb, #d81f26 28%, transparent)" : "var(--theme-elevation-150)"}`,
        borderRadius: 10,
        padding: "10px 14px",
        margin: "-6px 0 18px",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span aria-hidden style={{ fontSize: 15 }}>💱</span>
      <div>{body}</div>
    </div>
  );
}
