import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { gcsStorage } from "@payloadcms/storage-gcs";
import { s3Storage } from "@payloadcms/storage-s3";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Documents } from "./collections/Documents";
import { Categories } from "./collections/Categories";
import { Products } from "./collections/Products";
import { AuditLogs } from "./collections/AuditLogs";
import { Enquiries } from "./collections/Enquiries";
import { EnquiryUploads } from "./collections/EnquiryUploads";
import { globals } from "./globals";
import { seed } from "./seed";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Object storage is provider-agnostic and auto-detected from env:
//   1. Supabase Storage (S3-compatible) — if SUPABASE_S3_* vars are set (primary)
//   2. Google Cloud Storage             — else if GCS_* vars are set (deployment shift)
//   3. Local disk (staticDir)           — otherwise (default for dev)
const useSupabase = Boolean(
  process.env.SUPABASE_S3_ENDPOINT &&
    process.env.SUPABASE_S3_ACCESS_KEY_ID &&
    process.env.SUPABASE_BUCKET
);
const useGCS = !useSupabase && Boolean(process.env.GCS_BUCKET && process.env.GCS_PROJECT_ID);

// Same collections get cloud storage regardless of provider.
const storageCollections = {
  media: true,
  documents: true,
  "enquiry-uploads": true,
} as const;

const storagePlugins = useSupabase
  ? [
      s3Storage({
        enabled: true,
        collections: storageCollections,
        bucket: process.env.SUPABASE_BUCKET || "",
        config: {
          // Supabase Storage S3-compatible endpoint:
          //   https://<project-ref>.supabase.co/storage/v1/s3
          endpoint: process.env.SUPABASE_S3_ENDPOINT || "",
          region: process.env.SUPABASE_S3_REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY || "",
          },
          forcePathStyle: true, // Supabase requires path-style addressing
        },
      }),
    ]
  : useGCS
    ? [
        gcsStorage({
          enabled: true,
          collections: storageCollections,
          bucket: process.env.GCS_BUCKET || "",
          options: {
            projectId: process.env.GCS_PROJECT_ID,
            keyFilename: process.env.GCS_KEY_FILENAME,
          },
        }),
      ]
    : [];

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: "· METNMAT Dashboard" },
  },
  collections: [Users, Media, Documents, Categories, Products, Enquiries, EnquiryUploads, AuditLogs],
  globals,
  onInit: async (payload) => {
    await seed(payload);
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  db: mongooseAdapter({ url: process.env.MONGODB_URI || "" }),
  sharp,
  upload: { limits: { fileSize: 25_000_000 } },
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  cors: [process.env.WEBSITE_URL || ""].filter(Boolean),
  csrf: [process.env.WEBSITE_URL || ""].filter(Boolean),
  plugins: storagePlugins,
});
