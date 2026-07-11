import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { slugify, validateHttpUrl } from "../lib/blog";

/**
 * Blog authors — METNMAT staff and external contributors. Public read: the
 * website shows the author block (name, affiliation, bio, profile links) on
 * each article. Email is only exposed when `showEmail` is on.
 */
export const BlogAuthors: CollectionConfig = {
  slug: "blog-authors",
  labels: { singular: "Blog Author", plural: "Blog Authors" },
  admin: {
    group: "Blog",
    useAsTitle: "name",
    defaultColumns: ["name", "organisation", "isMetnmatAuthor", "isActive"],
    description: "Article authors — METNMAT staff and external contributors.",
  },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      unique: true,
      index: true,
      admin: { description: "Auto-generated from the name when left blank." },
      hooks: {
        beforeValidate: [({ value, data }) => slugify((value as string) || data?.name || "")],
      },
    },
    {
      type: "row",
      fields: [
        { name: "designation", type: "text", admin: { width: "50%", description: "e.g. 'Senior Research Engineer'." } },
        { name: "organisation", type: "text", admin: { width: "50%", description: "e.g. 'METNMAT Research & Innovations'." } },
      ],
    },
    { name: "department", type: "text" },
    { name: "bio", type: "textarea", admin: { description: "Short professional biography (2–4 sentences)." } },
    { name: "profileImage", type: "upload", relationTo: "media" },
    {
      type: "row",
      fields: [
        { name: "email", type: "email", admin: { width: "50%" } },
        {
          name: "showEmail",
          type: "checkbox",
          defaultValue: false,
          admin: { width: "50%", description: "Publish the email on the website (off by default)." },
        },
      ],
    },
    { name: "orcidUrl", type: "text", validate: validateHttpUrl, admin: { description: "https://orcid.org/…" } },
    { name: "googleScholarUrl", type: "text", validate: validateHttpUrl },
    { name: "researchGateUrl", type: "text", validate: validateHttpUrl },
    { name: "linkedinUrl", type: "text", validate: validateHttpUrl },
    { name: "websiteUrl", type: "text", validate: validateHttpUrl, admin: { description: "Personal or institutional profile page." } },
    {
      type: "row",
      fields: [
        {
          name: "isMetnmatAuthor",
          type: "checkbox",
          defaultValue: true,
          admin: { width: "50%", description: "METNMAT staff (off = external contributor)." },
        },
        { name: "isActive", type: "checkbox", defaultValue: true, admin: { width: "50%" } },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
  timestamps: true,
};
