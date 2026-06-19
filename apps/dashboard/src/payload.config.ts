import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { gcsStorage } from "@payloadcms/storage-gcs";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Documents } from "./collections/Documents";
import { Categories } from "./collections/Categories";
import { Products } from "./collections/Products";
import { Services } from "./collections/Services";
import { Projects } from "./collections/Projects";
import { Posts } from "./collections/Posts";
import { Faqs } from "./collections/Faqs";
import { Team } from "./collections/Team";
import { Clients } from "./collections/Clients";
import { AuditLogs } from "./collections/AuditLogs";
import { Enquiries } from "./collections/Enquiries";
import { EnquiryUploads } from "./collections/EnquiryUploads";
import { Orders } from "./collections/Orders";
import { Tickets } from "./collections/Tickets";
import { Customers } from "./collections/Customers";
import { globals } from "./globals";
import { seed } from "./seed";
import { resendAdapter } from "./lib/email-adapter";

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

// Object storage: Google Cloud Storage (private bucket; media served via Payload).
// Enabled when GCS_BUCKET + GCS_PROJECT_ID are set. On Cloud Run the attached
// service account supplies credentials automatically (no key file); locally use
// GCS_KEY_FILENAME or `gcloud auth application-default login` (ADC).
// Falls back to local disk only when unset (dev convenience).
const useGCS = Boolean(process.env.GCS_BUCKET && process.env.GCS_PROJECT_ID);

const storageCollections = {
  media: true,
  documents: true,
  "enquiry-uploads": true,
} as const;

const storagePlugins = useGCS
  ? [
      gcsStorage({
        enabled: true,
        collections: storageCollections,
        bucket: process.env.GCS_BUCKET || "",
        options: {
          projectId: process.env.GCS_PROJECT_ID,
          keyFilename: process.env.GCS_KEY_FILENAME, // undefined → ADC
        },
      }),
    ]
  : [];

export default buildConfig({
  admin: {
    user: Users.slug,
    theme: "dark", // premium dark UI; hides the light/dark toggle
    meta: { titleSuffix: "· METNMAT Operations" },
    importMap: { baseDir: dirname },
    components: {
      graphics: {
        Logo: "/admin/Logo",
        Icon: "/admin/Icon",
      },
      // PIN pad is the primary sign-in; the welcome line sits above it.
      beforeLogin: ["/admin/BeforeLogin", "/admin/PinLogin"],
      beforeDashboard: ["/admin/BeforeDashboard"],
      // Full brand logo at the top of the sidebar.
      beforeNavLinks: ["/admin/NavLogo"],
    },
  },
  // Sidebar group order follows this array: daily work first (Sales, Catalog),
  // then site content, assets, and admin plumbing last.
  collections: [
    Orders,
    Tickets,
    Enquiries,
    EnquiryUploads,
    Customers,
    Products,
    Categories,
    Services,
    Projects,
    Posts,
    Faqs,
    Team,
    Clients,
    Media,
    Documents,
    Users,
    AuditLogs,
  ],
  globals,
  onInit: async (payload) => {
    payload.logger.info(`[config] trusted origins (cors/csrf): ${trustedOrigins.join(", ") || "(none)"}`);
    await seed(payload);
  },
  editor: lexicalEditor(),
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
