import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { gcsStorage } from "@payloadcms/storage-gcs";
import { s3Storage } from "@payloadcms/storage-s3";
import { describeStorage, resolveStorageConfig } from "./lib/storage-config";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { StaffRoles } from "./collections/StaffRoles";
import { Media } from "./collections/Media";
import { Documents } from "./collections/Documents";
import { Categories } from "./collections/Categories";
import { Products } from "./collections/Products";
import { Services } from "./collections/Services";
import { Projects } from "./collections/Projects";
import { Posts } from "./collections/Posts";
import { BlogCategories } from "./collections/BlogCategories";
import { BlogContentTypes } from "./collections/BlogContentTypes";
import { BlogAuthors } from "./collections/BlogAuthors";
import { BlogReactions } from "./collections/BlogReactions";
import { BlogSubmissions } from "./collections/BlogSubmissions";
import { BlogSubmissionFiles } from "./collections/BlogSubmissionFiles";
import { BlogSlugRedirects } from "./collections/BlogSlugRedirects";
import { Faqs } from "./collections/Faqs";
import { Team } from "./collections/Team";
import { Clients } from "./collections/Clients";
import { AuditLogs } from "./collections/AuditLogs";
import { DataRequests } from "./collections/DataRequests";
import { Enquiries } from "./collections/Enquiries";
import { EnquiryUploads } from "./collections/EnquiryUploads";
import { Orders } from "./collections/Orders";
import { Tickets } from "./collections/Tickets";
import { Customers } from "./collections/Customers";
import { Quotations } from "./collections/Quotations";
import { PaymentEvents } from "./collections/PaymentEvents";
import { StockLedger } from "./collections/StockLedger";
import { Tasks } from "./collections/Tasks";
import { Shipments } from "./collections/Shipments";
import { Invoices } from "./collections/Invoices";
import { ReturnRequests } from "./collections/ReturnRequests";
import { Leads } from "./collections/Leads";
import { Notifications } from "./collections/Notifications";
import { IntegrationLogs } from "./collections/IntegrationLogs";
import { Counters } from "./collections/Counters";
import { AnalyticsEvents } from "./collections/AnalyticsEvents";
import { AnalyticsSessions } from "./collections/AnalyticsSessions";
import { AnalyticsDaily } from "./collections/AnalyticsDaily";
import { ensureAnalyticsIndexes } from "./hooks/analytics-ingest";
import { ensurePinThrottleIndex } from "./lib/pin-throttle";
import { globals } from "./globals";
import { seedCritical, seedContentAndCatalogue } from "./seed";
import { resendAdapter } from "./lib/email-adapter";

// libvips allocates OUTSIDE the V8 heap, so --max-old-space-size does not bound
// it. Six encodes run per upload here (five imageSizes plus the base), the
// largest 2400x1800, and this box runs four applications with roughly 400 MB
// headroom and no swap. Left at the default the threadpool is sized to the core
// count, and a bulk catalogue upload is exactly the workload that turns that
// into an OOM kill — which the kernel aims at the largest RSS, not necessarily
// at whoever caused it.
//
// One thread per operation trades wall-clock on a single upload for a bounded
// peak. Uploads are interactive and occasional; being slower is survivable,
// being killed mid-encode is not.
sharp.concurrency(1);

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Browser origins trusted for the auth cookie (CSRF) and cross-origin API (CORS).
// MUST include the dashboard's OWN public origin — otherwise Payload ignores the
// admin's auth cookie on writes (it only honours the cookie for origins in this
// list), so every save fails with "You are not allowed to perform this action"
// even for a super-admin. Prod resolves to admin.metnmat.com via CMS_URL; dev to
// http://localhost:3001 via NEXT_PUBLIC_SERVER_URL. The public website is added
// so it can read the API cross-origin.
const SELF_URL = (
  process.env.CMS_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");
const trustedOrigins = Array.from(
  new Set([SELF_URL, (process.env.WEBSITE_URL || "").replace(/\/+$/, "")].filter(Boolean)),
);

// Object storage. GCS is the default and remains the production provider; S3 is
// available but INACTIVE unless STORAGE_PROVIDER=s3 is set explicitly.
//
// The provider decision, and whether its configuration is complete enough to
// start, live in lib/storage-config.ts so they can be unit-tested without
// booting Payload. The important behaviour change: a missing configuration in
// production now THROWS instead of silently writing uploads to the container
// filesystem, which is ephemeral on both Cloud Run and ECS/Fargate.
const storage = resolveStorageConfig(process.env, {
  isProduction: process.env.NODE_ENV === "production",
  isBuildPhase: process.env.NEXT_PHASE === "phase-production-build",
});

/**
 * The value Terraform writes into every AWS Secrets Manager secret at creation
 * (infra/aws/platform.tf). Committed to this repository, therefore PUBLIC — which
 * makes it more dangerous than an unset variable, not less: an empty secret fails
 * closed, this one fails open. Treated as missing below.
 *
 * On 2026-08-11 all 22 secrets in production held this string while every health
 * signal reported the stack as healthy.
 */
const PLACEHOLDER_SECRET = "PLACEHOLDER_SET_ME";

/**
 * Fail-fast on missing required secrets — but only at real server runtime, never
 * during `next build` (the container image is built without runtime secrets, so a
 * build-time throw would break the image rather than catch a misconfiguration).
 * onInit runs at boot, which is where this belongs.
 */
function assertProductionConfig(logger: { warn: (m: string) => void }): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const required = {
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
    MONGODB_URI: process.env.MONGODB_URI,
    PAYLOAD_PIN_PEPPER: process.env.PAYLOAD_PIN_PEPPER,
    // Without the public origin, cors/csrf silently fall back to localhost and
    // Payload rejects its own auth cookie on every admin write — with no boot
    // signal (audit finding). Fail loud instead.
    "CMS_URL (or NEXT_PUBLIC_SERVER_URL)": process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v || !v.trim() || v.trim() === PLACEHOLDER_SECRET)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `[config] Missing or placeholder required production env var(s): ${missing.join(", ")}. ` +
        `Refusing to start insecure. A variable still set to ${PLACEHOLDER_SECRET} is the value Terraform ` +
        `writes at secret creation (infra/aws/platform.tf) — it is committed to this repository and therefore ` +
        `public, so PAYLOAD_SECRET holding it means admin JWTs can be forged. Populate the real values in ` +
        `AWS Secrets Manager under metnmat/prod/<NAME>, then REDEPLOY: ECS resolves secrets only at task ` +
        `start, so updating a secret does not affect a running task.`,
    );
  }
  if ((process.env.PAYLOAD_PIN_PEPPER || "").length < 16) {
    logger.warn(
      "[config] PAYLOAD_PIN_PEPPER is short/low-entropy — set a long random value (openssl rand -hex 32).",
    );
  }
}

const storageCollections = {
  media: true,
  documents: true,
  "enquiry-uploads": true,
  "blog-submission-files": true,
} as const;

// Exactly one adapter, chosen by the resolution above. `local` is only ever
// returned in development or during `next build` — resolveStorageConfig throws
// rather than return it at production runtime.
const storagePlugins =
  storage.provider === "gcs"
    ? [
        gcsStorage({
          enabled: true,
          collections: storageCollections,
          bucket: storage.bucket,
          options: {
            projectId: storage.projectId,
            keyFilename: storage.keyFilename, // undefined → ADC
          },
        }),
      ]
    : storage.provider === "s3"
      ? [
          s3Storage({
            enabled: true,
            collections: storageCollections,
            bucket: storage.bucket,
            config: {
              region: storage.region,
              ...(storage.endpoint ? { endpoint: storage.endpoint } : {}),
              ...(storage.forcePathStyle ? { forcePathStyle: true } : {}),
              // Omitted unless explicitly supplied, so the AWS SDK's default
              // chain (ECS task role / instance profile) is used — the same
              // shape as ADC on Cloud Run, and the reason no long-lived key
              // needs to exist in a normal deployment.
              ...(storage.accessKeyId && storage.secretAccessKey
                ? {
                    credentials: {
                      accessKeyId: storage.accessKeyId,
                      secretAccessKey: storage.secretAccessKey,
                    },
                  }
                : {}),
            },
          }),
        ]
      : [];

export default buildConfig({
  admin: {
    user: Users.slug,
    // Both palettes ship (custom-admin.css). With admin.theme unset (Payload
    // default "all"), first-time visitors follow their OS colour scheme
    // (payload-theme cookie → Sec-CH-Prefers-Color-Scheme client hint → light
    // fallback; the hint headers are set in next.config.mjs). The header
    // ThemeToggle + /admin/account persist an explicit per-browser choice.
    meta: {
      titleSuffix: "· METNMAT Operations",
      // Brand M favicon (assets in public/) instead of the Payload default.
      icons: {
        icon: [{ url: "/icon-96x96.png", type: "image/png", sizes: "96x96" }],
        shortcut: "/favicon.ico",
        apple: "/apple-touch-icon.png",
      },
    },
    importMap: { baseDir: dirname },
    components: {
      graphics: {
        Logo: "/admin/Logo",
        Icon: "/admin/Icon",
      },
      // Light/dark switch in the header (top right).
      actions: ["/admin/ThemeToggle"],
      // PIN pad is the primary sign-in; the welcome line sits above it.
      beforeLogin: ["/admin/BeforeLogin", "/admin/PinLogin"],
      beforeDashboard: ["/admin/BeforeDashboard"],
      // Full brand logo + Wix-style Home/Analytics/live-site shortcuts at the
      // top of the sidebar.
      beforeNavLinks: ["/admin/NavLogo", "/admin/NavShortcuts"],
      views: {
        // First-party analytics suite (Highlights/Real-time/Traffic/Behavior/
        // Marketing/Recordings/Insights/Benchmarks/Reports + Business) — one
        // prefix-mounted view; sub-sections route via params.segments.
        analytics: {
          Component: "/admin/SiteAnalyticsView",
          path: "/analytics",
          exact: false,
        },
      },
    },
  },
  // Sidebar group order follows first appearance in this array (Wix-style):
  // Sales → Catalog → Site & Mobile App → Inbox → Customers & Leads → Blog →
  // Operations → Administration. (Marketing holds only globals, so Payload
  // appends it after the collection groups.)
  collections: [
    // Sales
    Orders,
    Invoices,
    Shipments,
    PaymentEvents,
    Quotations,
    Enquiries,
    EnquiryUploads,
    ReturnRequests,
    // Catalog
    Products,
    Categories,
    StockLedger,
    // Site & Mobile App (website content + assets)
    Services,
    Projects,
    Faqs,
    Team,
    Clients,
    Media,
    Documents,
    // Inbox
    Tickets,
    Notifications,
    // Customers & Leads
    Customers,
    Leads,
    // Blog
    Posts,
    BlogCategories,
    BlogContentTypes,
    BlogAuthors,
    BlogSubmissions,
    BlogSubmissionFiles,
    BlogReactions,
    BlogSlugRedirects,
    // Operations
    Tasks,
    // Administration
    Users,
    StaffRoles,
    AuditLogs,
    DataRequests,
    IntegrationLogs,
    Counters,
    AnalyticsEvents,
    AnalyticsSessions,
    AnalyticsDaily,
  ],
  globals,
  onInit: async (payload) => {
    assertProductionConfig(payload.logger);
    // Names and bucket only — never a credential value.
    if (storage.provider === "local") payload.logger.warn(describeStorage(storage));
    else payload.logger.info(describeStorage(storage));
    payload.logger.info(`[config] trusted origins (cors/csrf): ${trustedOrigins.join(", ") || "(none)"}`);
    // Seeding must never take the CMS down: a transient DB error during seed
    // should log and let the admin/API still boot (it degrades to whatever data
    // is already there) rather than crash-loop the container.
    //
    // Only the ACCOUNT part is awaited. The catalogue and content part is ~200
    // database round trips, and onInit is awaited before the server accepts
    // traffic — so the first request after any restart, including a PM2 memory
    // restart, used to wait for all of it. On a populated database every one of
    // those round trips is a no-op, so the work blocking the door changed
    // nothing. It now runs after boot.
    try {
      await seedCritical(payload);
    } catch (e) {
      payload.logger.error(`[config] seedCritical() failed (continuing boot): ${(e as Error).message}`);
    }
    void seedContentAndCatalogue(payload).catch((e) => {
      payload.logger.error(`[config] background seed failed: ${(e as Error).message}`);
    });
    try {
      // Raw-Mongo indexes Payload fields can't express (analytics TTL retention).
      await ensureAnalyticsIndexes(payload);
    } catch (e) {
      payload.logger.error(`[config] ensureAnalyticsIndexes failed (continuing boot): ${(e as Error).message}`);
    }
    try {
      // The TTL index IS the PIN throttle's window. Its absence would let
      // throttle rows accumulate forever rather than expire, so it is ensured
      // at boot — but a failure here must not stop the CMS from starting.
      await ensurePinThrottleIndex(payload);
    } catch (e) {
      payload.logger.error(`[config] ensurePinThrottleIndex failed (continuing boot): ${(e as Error).message}`);
    }
  },
  editor: lexicalEditor(),
  // No first-party consumer uses GraphQL (website/admin/chatbot are REST/Mongo),
  // and Payload's GraphQL auth binds req.user at depth 0 — which would silently
  // ignore custom-role areas. Disable the endpoint entirely: less attack
  // surface, no REST/GraphQL permission divergence.
  graphQL: { disable: true },
  email: resendAdapter(),
  secret: process.env.PAYLOAD_SECRET || "",
  db: mongooseAdapter({ url: process.env.MONGODB_URI || "" }),
  sharp,
  upload: { limits: { fileSize: 25_000_000 } },
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  cors: trustedOrigins,
  csrf: trustedOrigins,
  plugins: storagePlugins,
});
