import { ImageResponse } from "next/og";
import { site } from "@/frontend/lib/site";

// Run on the edge runtime — the intended environment for next/og (avoids a
// Node fileURLToPath crash during the Windows build).
export const runtime = "edge";

// Dynamic social share image (1200×630) generated at build/runtime — no static
// asset needed. Next auto-wires og:image + twitter:image to this for all pages.
export const alt = `${site.legalName} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0b",
          backgroundImage:
            "radial-gradient(60% 70% at 80% 0%, rgba(216,31,38,0.35), transparent 60%)",
          padding: 80,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              background: "#d81f26",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 60,
              fontWeight: 700,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
            {site.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
            Turning materials science into industrial advantage
          </div>
          <div style={{ fontSize: 30, color: "#a1a1aa" }}>{site.tagline}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
