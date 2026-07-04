import type { Access, CollectionConfig, Where } from "payload";
import { canManageContent } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { slugify, validateHttpUrl } from "../lib/blog";

/**
 * Anonymous readers (the website) only see PUBLISHED, ACTIVE projects — drafts
 * and deactivated case studies stay private. Staff see everything.
 */
const publishedActiveRead: Access = ({ req: { user } }) => {
  if ((user as { collection?: string } | null)?.collection === "users") return true;
  const gate: Where = {
    and: [{ _status: { equals: "published" } }, { active: { not_equals: false } }],
  };
  return gate;
};

/**
 * Projects / case studies shown on the website's /projects listing and each
 * project's own /projects/[slug] page. Editable by content staff (marketing+).
 * Drafts supported.
 */
export const Projects: CollectionConfig = {
  slug: "projects",
  labels: { singular: "Project", plural: "Projects" },
  admin: {
    group: "Website Content",
    useAsTitle: "title",
    defaultColumns: ["title", "category", "order", "featured", "active"],
    description: "Case studies on the website's /projects page and per-project detail pages.",
  },
  access: {
    read: publishedActiveRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  versions: { drafts: true },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Overview",
          fields: [
            { name: "title", type: "text", required: true },
            {
              name: "slug",
              type: "text",
              required: true,
              unique: true,
              index: true,
              admin: { description: "URL segment (auto-generated from the title when blank), e.g. 'oxygen-free-copper-alloy'." },
              hooks: {
                beforeValidate: [({ value, data }) => slugify((value as string) || data?.title || "")],
              },
            },
            { name: "subtitle", type: "text", admin: { description: "One-line tagline shown under the title (optional)." } },
            {
              type: "row",
              fields: [
                { name: "category", type: "text", required: true, admin: { width: "60%", description: "e.g. 'Alloy Development', 'Waste Heat Recovery'. Also used for the /projects filter." } },
                { name: "client", type: "text", admin: { width: "40%", description: "Client / partner (optional)." } },
              ],
            },
            { name: "summary", type: "textarea", required: true, admin: { description: "Short summary shown on the project card and in search results." } },
            { name: "body", type: "richText", admin: { description: "Full case-study write-up shown on the project's own page." } },
          ],
        },
        {
          label: "Highlights & Tags",
          fields: [
            {
              name: "highlights",
              type: "array",
              labels: { singular: "Highlight", plural: "Highlights" },
              admin: { description: "Key facts / results shown as a stat strip (e.g. 'Conductivity' → '91–93% IACS'). Leave empty if none." },
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "label", type: "text", required: true, admin: { width: "45%", description: "e.g. 'Conductivity'." } },
                    { name: "value", type: "text", required: true, admin: { width: "55%", description: "e.g. '91–93% IACS'." } },
                  ],
                },
              ],
            },
            {
              name: "tags",
              type: "array",
              labels: { singular: "Tag", plural: "Tags" },
              admin: { description: "Materials / technologies / applications (e.g. 'Copper alloy', 'Thermoelectric')." },
              fields: [{ name: "tag", type: "text", required: true }],
            },
          ],
        },
        {
          label: "Media",
          fields: [
            { name: "coverImage", type: "upload", relationTo: "media", admin: { description: "Hero / card image. A premium branded placeholder is shown when empty." } },
            { name: "coverImageAlt", type: "text", admin: { description: "Accessibility alt text for the cover image." } },
            {
              name: "gallery",
              type: "array",
              labels: { singular: "Image", plural: "Gallery images" },
              fields: [
                { name: "image", type: "upload", relationTo: "media", required: true },
                { name: "caption", type: "text" },
              ],
            },
          ],
        },
        {
          label: "SEO",
          fields: [
            { name: "seoTitle", type: "text", admin: { description: "Overrides the page <title> (defaults to the project title)." } },
            { name: "metaDescription", type: "textarea", admin: { description: "Defaults to the summary." } },
            { name: "externalUrl", type: "text", validate: validateHttpUrl, admin: { description: "Canonical/original source URL, if this case study lives elsewhere too." } },
          ],
        },
      ],
    },
    // Sidebar controls
    {
      type: "row",
      admin: { position: "sidebar" },
      fields: [
        { name: "year", type: "number", admin: { width: "50%", description: "Year delivered (optional)." } },
        { name: "order", type: "number", defaultValue: 0, admin: { width: "50%", description: "Sort order (low first)." } },
      ],
    },
    { name: "featured", type: "checkbox", defaultValue: false, admin: { position: "sidebar", description: "Pin to the top of the /projects page (shown as the featured spotlight)." } },
    { name: "active", type: "checkbox", defaultValue: true, admin: { position: "sidebar", description: "Uncheck to hide from the website." } },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
