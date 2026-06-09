// The CMS/dashboard host (serves uploaded media/documents) + Supabase storage,
// so browser <img> tags and fetches to them aren't blocked by CSP.
const CMS_ORIGIN = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const STORAGE_ORIGINS = "https://*.supabase.co https://*.storage.supabase.co";

// Content Security Policy. 'unsafe-inline' is required by the pre-paint theme
// script and Next's inline runtime; harden to nonce-based CSP later.
const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${CMS_ORIGIN} ${STORAGE_ORIGINS}`,
  "font-src 'self' data:",
  `connect-src 'self' ${CMS_ORIGIN} ${STORAGE_ORIGINS}`,
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Self-contained build for Docker (AWS/GCP/Render). Opt-in via env because it
  // creates symlinks, which Windows (without Developer Mode) + OneDrive block.
  // Enable in CI/Docker with: NEXT_OUTPUT=standalone
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  // Transpile the shared TS workspace package.
  transpilePackages: ["@metnmat/types"],
  images: {
    // CMS/dashboard media host + Supabase storage, for any next/image usage.
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "3001" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
