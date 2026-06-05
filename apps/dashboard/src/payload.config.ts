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
import { AuditLogs } from "./collections/AuditLogs";
import { globals } from "./globals";
import { seed } from "./seed";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Enable Google Cloud Storage only when configured; otherwise local disk (dev).
const useGCS = Boolean(process.env.GCS_BUCKET && process.env.GCS_PROJECT_ID);

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: "· METNMAT Dashboard" },
  },
  collections: [Users, Media, Documents, Categories, Products, AuditLogs],
  globals,
  onInit: async (payload) => {
    await seed(payload);
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  db: mongooseAdapter({ url: process.env.MONGODB_URI || "" }),
  sharp,
  // Global upload guard (requirement 11: file size limits).
  upload: { limits: { fileSize: 25_000_000 } }, // 25 MB
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  cors: [process.env.WEBSITE_URL || ""].filter(Boolean),
  csrf: [process.env.WEBSITE_URL || ""].filter(Boolean),
  plugins: useGCS
    ? [
        gcsStorage({
          enabled: true,
          collections: { media: true, documents: true },
          bucket: process.env.GCS_BUCKET || "",
          options: {
            projectId: process.env.GCS_PROJECT_ID,
            keyFilename: process.env.GCS_KEY_FILENAME,
          },
        }),
      ]
    : [],
});
