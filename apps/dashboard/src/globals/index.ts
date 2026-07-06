import type { GlobalConfig } from "payload";
import { canManageSettings, publicRead } from "../access";
import { revalidateWebsiteGlobal } from "../hooks/revalidate";

const settings = (
  extra: Partial<GlobalConfig> = {}
): Pick<GlobalConfig, "access" | "admin" | "hooks"> => ({
  access: { read: publicRead, update: canManageSettings },
  admin: { group: "Website Settings", ...(extra.admin ?? {}) },
  // Saving any setting pings the website so the change goes live immediately.
  hooks: { afterChange: [revalidateWebsiteGlobal] },
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
    { name: "legalName", type: "text", defaultValue: "METNMAT INNOVATIONS PRIVATE LIMITED" },
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
    { name: "amazon", type: "text", admin: { description: "Amazon storefront URL" } },
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

/** Commerce settings — currency display for international customers. */
export const Commerce: GlobalConfig = {
  slug: "commerce",
  label: "Commerce & Pricing",
  ...settings(),
  fields: [
    {
      name: "usdExchangeRate",
      type: "number",
      required: true,
      defaultValue: 84,
      min: 1,
      admin: {
        description:
          "₹ per 1 USD — used to SHOW prices in dollars to international visitors. Payments are still charged in INR. Update this periodically (e.g. weekly) to match the market rate.",
      },
    },
  ],
};

/** Homepage hero, stats & section toggles. */
export const Homepage: GlobalConfig = {
  slug: "homepage",
  ...settings(),
  fields: [
    {
      type: "collapsible",
      label: "Hero",
      fields: [
        { name: "eyebrow", type: "text", admin: { description: "Small label above the headline." } },
        { name: "titleLead", type: "text", admin: { description: "First part of the headline." } },
        { name: "titleAccent", type: "text", admin: { description: "Last part of the headline (shown in the brand gradient)." } },
        { name: "subtitle", type: "textarea" },
        {
          type: "row",
          fields: [
            { name: "primaryCtaLabel", type: "text", admin: { width: "50%" } },
            { name: "primaryCtaHref", type: "text", admin: { width: "50%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "secondaryCtaLabel", type: "text", admin: { width: "50%" } },
            { name: "secondaryCtaHref", type: "text", admin: { width: "50%" } },
          ],
        },
      ],
    },
    {
      name: "stats",
      type: "array",
      labels: { singular: "Stat", plural: "Stats" },
      admin: { description: "The headline numbers (e.g. '100+ R&D projects delivered')." },
      fields: [
        {
          type: "row",
          fields: [
            { name: "value", type: "text", required: true, admin: { width: "40%" } },
            { name: "label", type: "text", required: true, admin: { width: "60%" } },
          ],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Section visibility",
      admin: { description: "Toggle which homepage sections are shown." },
      fields: [
        {
          type: "row",
          fields: [
            { name: "showClients", type: "checkbox", defaultValue: true, admin: { width: "25%", description: "Trusted by" } },
            { name: "showServices", type: "checkbox", defaultValue: true, admin: { width: "25%", description: "Services" } },
            { name: "showProjects", type: "checkbox", defaultValue: true, admin: { width: "25%", description: "Case study" } },
            { name: "showBlog", type: "checkbox", defaultValue: true, admin: { width: "25%", description: "Blog" } },
          ],
        },
      ],
    },
  ],
};

/**
 * Site-wide maintenance notice — ONE switch for staff. Turning it on shows a
 * professional banner at the top of every page on www.metnmat.com (the site
 * keeps working underneath); turning it off removes it. Live within seconds
 * of saving (revalidate ping), worst case ~1 minute (ISR).
 */
export const Maintenance: GlobalConfig = {
  slug: "maintenance",
  label: "Maintenance Notice",
  ...settings({
    admin: {
      description:
        "Show or hide the site-wide maintenance banner on www.metnmat.com. The website stays fully usable — this is a notice, not a shutdown.",
    },
  }),
  fields: [
    {
      name: "enabled",
      type: "checkbox",
      label: "Show maintenance banner",
      defaultValue: false,
      admin: {
        description:
          "ON → the banner appears at the top of every page. OFF → it disappears. Takes effect within seconds of saving.",
      },
    },
    {
      name: "message",
      type: "text",
      defaultValue:
        "We are currently performing scheduled maintenance. Some features may be temporarily unavailable.",
      admin: { description: "The notice text shown to visitors. Keep it short and professional." },
    },
    {
      name: "showContact",
      type: "checkbox",
      label: "Show customer service contact",
      defaultValue: true,
      admin: {
        description:
          "Append a 'contact our customer service' line with the email and phone from Website Settings → Contact.",
      },
    },
  ],
};

/** Header & footer navigation links. */
export const Navigation: GlobalConfig = {
  slug: "navigation",
  ...settings(),
  fields: [
    {
      name: "headerLinks",
      type: "array",
      labels: { singular: "Header link", plural: "Header links" },
      admin: { description: "Main navigation tabs (order matters)." },
      fields: [
        {
          type: "row",
          fields: [
            { name: "label", type: "text", required: true, admin: { width: "50%" } },
            { name: "href", type: "text", required: true, admin: { width: "50%" } },
          ],
        },
      ],
    },
    {
      name: "footerGroups",
      type: "array",
      labels: { singular: "Footer column", plural: "Footer columns" },
      fields: [
        { name: "title", type: "text", required: true },
        {
          name: "links",
          type: "array",
          labels: { singular: "Link", plural: "Links" },
          fields: [
            {
              type: "row",
              fields: [
                { name: "label", type: "text", required: true, admin: { width: "50%" } },
                { name: "href", type: "text", required: true, admin: { width: "50%" } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const globals = [Branding, Company, Contact, Social, SEO, Commerce, Homepage, Maintenance, Navigation];
