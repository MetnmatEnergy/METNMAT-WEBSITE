import type { CollectionConfig } from "payload";
import type { Access } from "payload";
import { canManageContent, isAdmin } from "../access";
import { inboundKeyMatches } from "../lib/internal-key";

const xKey = (args: { req?: { headers?: unknown } }) =>
  (args.req?.headers as Headers | undefined)?.get?.("x-internal-key");

/** Website server (blog key) or content staff. */
const internalBlogOrContent: Access = (args) => {
  if (inboundKeyMatches(xKey(args), "CMS_BLOG_KEY")) return true;
  return canManageContent(args);
};

/**
 * Contributor manuscripts + supporting files attached to "Request to Publish"
 * submissions. PRIVATE: created only by the website server (which has already
 * magic-byte-validated the real file content), readable only by content staff
 * (or the website server for email attachment) — never by the public web.
 */
export const BlogSubmissionFiles: CollectionConfig = {
  slug: "blog-submission-files",
  labels: { singular: "Blog Submission File", plural: "Blog Submission Files" },
  admin: {
    group: "Blog",
    useAsTitle: "filename",
    defaultColumns: ["filename", "createdAt"],
    description: "Files attached to publication requests (private — staff only).",
  },
  access: {
    create: internalBlogOrContent, // website server after server-side validation
    read: internalBlogOrContent, // NEVER public — unpublished manuscripts
    update: canManageContent,
    delete: isAdmin,
  },
  upload: {
    staticDir: "blog-submission-files",
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
      "image/webp",
    ],
  },
  fields: [],
  timestamps: true,
};
