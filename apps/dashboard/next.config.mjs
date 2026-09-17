import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // "X-Powered-By: Next.js, Payload" is free reconnaissance for an attacker.
  poweredByHeader: false,
  // This whole service IS the operations console — never index any of it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // Baseline hardening the website already sends and this origin did
          // not (2026-09-17 audit): pin HTTPS, stop MIME sniffing of uploads
          // served from /api/media, keep the admin out of other sites' frames.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Client hints so Payload can SSR the admin in the visitor's OS
          // colour scheme when they haven't picked a theme yet (no light↔dark
          // flash on hard loads in Chromium browsers).
          { key: "Accept-CH", value: "Sec-CH-Prefers-Color-Scheme" },
          { key: "Critical-CH", value: "Sec-CH-Prefers-Color-Scheme" },
          { key: "Vary", value: "Sec-CH-Prefers-Color-Scheme" },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
