import type { GlobalConfig } from "payload";
import { canManageContent, publicRead } from "../access";

const settings = (extra: Partial<GlobalConfig> = {}): Pick<GlobalConfig, "access" | "admin"> => ({
  access: { read: publicRead, update: canManageContent },
  admin: { group: "Website Settings", ...(extra.admin ?? {}) },
});

/** Logo, favicon, hero/marketing banners. */
export const Branding: GlobalConfig = {
  slug: "branding",
  ...settings(),
  fields: [
    { name: "logo", type: "upload", relationTo: "media" },
    { name: "logoDark", type: "upload", relationTo: "media", admin: { description: "Optional alt logo for light backgrounds." } },
    { name: "favicon", type: "upload", relationTo: "media" },
    {
      name: "heroBanners",
      type: "array",
      labels: { singular: "Hero banner", plural: "Hero banners" },
      fields: [
        { name: "image", type: "upload", relationTo: "media" },
        { name: "heading", type: "text" },
        { name: "subheading", type: "text" },
        { name: "ctaLabel", type: "text" },
        { name: "ctaHref", type: "text" },
        { name: "active", type: "checkbox", defaultValue: true },
      ],
    },
    {
      name: "marketingBanners",
      type: "array",
      labels: { singular: "Marketing banner", plural: "Marketing banners" },
      fields: [
        { name: "image", type: "upload", relationTo: "media" },
        { name: "href", type: "text" },
        { name: "active", type: "checkbox", defaultValue: true },
      ],
    },
  ],
};

/** Company information. */
export const Company: GlobalConfig = {
  slug: "company",
  ...settings(),
  fields: [
    { name: "name", type: "text", defaultValue: "METNMAT" },
    { name: "legalName", type: "text", defaultValue: "METNMAT Research & Innovations" },
    { name: "tagline", type: "text" },
    { name: "description", type: "textarea" },
    { name: "about", type: "richText" },
    { name: "foundedYear", type: "number" },
  ],
};

/** Contact information. */
export const Contact: GlobalConfig = {
  slug: "contact",
  ...settings(),
  fields: [
    { name: "email", type: "email" },
    { name: "phone", type: "text" },
    { name: "whatsapp", type: "text" },
    { name: "shippingNote", type: "text" },
    {
      name: "addresses",
      type: "array",
      fields: [
        { name: "label", type: "text" },
        { name: "line", type: "textarea" },
        { name: "mapUrl", type: "text" },
      ],
    },
  ],
};

/** Social media links. */
export const Social: GlobalConfig = {
  slug: "social",
  ...settings(),
  fields: [
    { name: "linkedin", type: "text" },
    { name: "youtube", type: "text" },
    { name: "facebook", type: "text" },
    { name: "instagram", type: "text" },
    { name: "x", type: "text" },
  ],
};

/** Global SEO defaults. */
export const SEO: GlobalConfig = {
  slug: "seo",
  ...settings(),
  fields: [
    { name: "defaultTitle", type: "text" },
    { name: "titleTemplate", type: "text", admin: { description: "e.g. '%s · METNMAT'." } },
    { name: "description", type: "textarea" },
    { name: "keywords", type: "text" },
    { name: "ogImage", type: "upload", relationTo: "media" },
  ],
};

export const globals = [Branding, Company, Contact, Social, SEO];
