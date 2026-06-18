// The CMS/dashboard host (serves uploaded media/documents) + Google Cloud Storage,
// so browser <img> tags and fetches to them aren't blocked by CSP.
const CMS_ORIGIN = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const STORAGE_ORIGINS = "https://storage.googleapis.com";
// Parse the CMS origin into next/image remotePattern parts (protocol w/o ":").
const cmsImageHost = (() => {
  try {
    const u = new URL(CMS_ORIGIN);
    return { protocol: u.protocol.replace(":", ""), hostname: u.hostname, port: u.port };
  } catch {
    return { protocol: "http", hostname: "localhost", port: "3001" };
  }
})();
// The chatbot host (separate service). It serves widget.js (a <script>), the chat
// UI in an <iframe>, and product images — so script-src / frame-src / img-src /
// connect-src must allow it, or the CSP blocks the chat bubble entirely.
const CHATBOT_ORIGIN = process.env.NEXT_PUBLIC_CHATBOT_URL || "http://localhost:3002";
// Razorpay checkout: checkout.js (script), the payment modal (iframe) and its
// API/telemetry endpoints (connect). Required for online payments.
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com";
const RAZORPAY_CONNECT = "https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com";

// Content Security Policy. 'unsafe-inline' is required by the pre-paint theme
// script and Next's inline runtime; harden to nonce-based CSP later.
const ContentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CHATBOT_ORIGIN} ${RAZORPAY_SCRIPT}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${CMS_ORIGIN} ${STORAGE_ORIGINS} ${CHATBOT_ORIGIN}`,
  "font-src 'self' data:",
  `connect-src 'self' ${CMS_ORIGIN} ${STORAGE_ORIGINS} ${CHATBOT_ORIGIN} ${RAZORPAY_CONNECT}`,
  `frame-src 'self' ${CHATBOT_ORIGIN} https://www.google.com https://maps.google.com https://api.razorpay.com ${RAZORPAY_SCRIPT}`,
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
    // The CMS host is derived from NEXT_PUBLIC_CMS_URL so production media
    // (e.g. https://admin.metnmat.com) isn't blocked — falls back to localhost.
    remotePatterns: [
      {
        protocol: cmsImageHost.protocol,
        hostname: cmsImageHost.hostname,
        ...(cmsImageHost.port ? { port: cmsImageHost.port } : {}),
      },
      { protocol: "http", hostname: "localhost", port: "3001" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
