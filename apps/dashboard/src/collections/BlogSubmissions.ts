import type { Access, CollectionConfig, PayloadRequest } from "payload";
import { canManageContent, hasRoleOrArea, isSuperAdmin, type Role } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { inboundKeyMatches } from "../lib/internal-key";
import { escapeHtml, plainTextToLexical, slugify } from "../lib/blog";

const xKey = (args: { req?: { headers?: unknown } }) =>
  (args.req?.headers as Headers | undefined)?.get?.("x-internal-key");

/** Website server (blog key) or content staff. The website creates submissions
 * and reads them only for duplicate detection — contributor data never reaches
 * the public web (the website server never proxies these reads out). */
const internalBlogOrContent: Access = (args) => {
  if (inboundKeyMatches(xKey(args), "CMS_BLOG_KEY")) return true;
  return canManageContent(args);
};

export const SUBMISSION_STATUSES = [
  { label: "New", value: "new" },
  { label: "Under review", value: "under-review" },
  { label: "Revision requested", value: "revision-requested" },
  { label: "Approved", value: "approved" },
  { label: "Converted to draft", value: "converted-to-draft" },
  { label: "Published", value: "published" },
  { label: "Rejected", value: "rejected" },
  { label: "Withdrawn", value: "withdrawn" },
] as const;

/** Statuses that trigger a templated email to the contributor when set. */
const NOTIFY_STATUSES: Record<string, { subject: (ref: string) => string; intro: string }> = {
  "revision-requested": {
    subject: (ref) => `Revision requested — publication request ${ref}`,
    intro:
      "Thank you for your publication request. Our editorial team has reviewed it and is requesting a revision before it can proceed:",
  },
  approved: {
    subject: (ref) => `Publication request ${ref} approved for editorial processing`,
    intro:
      "Good news — your publication request has been approved for editorial processing. Our team will prepare the article for publication and may contact you with final questions. Approval does not commit METNMAT to a specific publication date.",
  },
  rejected: {
    subject: (ref) => `Update on your publication request ${ref}`,
    intro:
      "Thank you for your interest in publishing with METNMAT. After editorial review, we are unable to accept this submission for publication:",
  },
};

function contributorEmailHtml(input: {
  name: string;
  reference: string;
  title: string;
  intro: string;
  message?: string;
}): string {
  const note = input.message
    ? `<div style="margin:16px 0;padding:12px 16px;background:#f6f6f7;border-left:3px solid #d81f26;border-radius:4px;white-space:pre-wrap;">${escapeHtml(input.message)}</div>`
    : "";
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
    <div style="background:#111;padding:20px 24px;border-radius:8px 8px 0 0;">
      <span style="color:#fff;font-size:18px;font-weight:bold;">METNMAT</span>
      <span style="color:#d81f26;font-size:18px;font-weight:bold;"> Editorial</span>
    </div>
    <div style="border:1px solid #e5e5e5;border-top:0;padding:24px;border-radius:0 0 8px 8px;">
      <p>Dear ${escapeHtml(input.name)},</p>
      <p>${input.intro}</p>
      ${note}
      <table style="font-size:14px;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Reference</td><td style="padding:4px 0;"><strong>${escapeHtml(input.reference)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Proposed title</td><td style="padding:4px 0;">${escapeHtml(input.title)}</td></tr>
      </table>
      <p>Please quote the reference number in any correspondence.</p>
      <p style="color:#666;font-size:13px;margin-top:24px;">METNMAT Research &amp; Innovations · www.metnmat.com</p>
    </div>
  </div>`;
}

/**
 * "Request to Publish" submissions from researchers / engineers on the public
 * website. Created ONLY by the website server (validated + rate-limited there);
 * reviewed by content staff in this admin. Converting to a draft article never
 * publishes anything automatically.
 */
export const BlogSubmissions: CollectionConfig = {
  slug: "blog-submissions",
  labels: { singular: "Publication Request", plural: "Publication Requests" },
  admin: {
    group: "Website Content",
    useAsTitle: "proposedTitle",
    defaultColumns: ["referenceNumber", "proposedTitle", "fullName", "status", "createdAt"],
    description:
      "Article proposals from external contributors. Review, request revisions, approve/reject, or convert to a draft article — nothing publishes automatically.",
  },
  access: {
    create: internalBlogOrContent,
    read: internalBlogOrContent,
    update: canManageContent,
    delete: isSuperAdmin,
  },
  fields: [
    {
      name: "referenceNumber",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "new",
      options: [...SUBMISSION_STATUSES],
      admin: { position: "sidebar" },
      index: true,
    },
    {
      name: "assignedEditor",
      type: "relationship",
      relationTo: "users",
      admin: { position: "sidebar" },
    },
    {
      name: "decisionMessage",
      type: "textarea",
      admin: {
        position: "sidebar",
        description:
          "Included in the email sent to the contributor when you set the status to Revision requested / Approved / Rejected. Write it BEFORE changing the status.",
      },
    },
    {
      name: "convertedArticle",
      type: "relationship",
      relationTo: "posts",
      admin: { position: "sidebar", readOnly: true, description: "Draft created from this request." },
    },
    { name: "convertButton", type: "ui", admin: { components: { Field: "/admin/ConvertSubmissionButton" }, position: "sidebar" } },

    // ── Contributor ──────────────────────────────────────────────────────────
    {
      type: "collapsible",
      label: "Contributor",
      fields: [
        {
          type: "row",
          fields: [
            { name: "fullName", type: "text", required: true, admin: { width: "50%" } },
            { name: "designation", type: "text", admin: { width: "50%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "organisation", type: "text", admin: { width: "50%" } },
            { name: "department", type: "text", admin: { width: "50%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "email", type: "email", required: true, admin: { width: "40%" } },
            { name: "mobile", type: "text", admin: { width: "30%" } },
            { name: "country", type: "text", admin: { width: "30%" } },
          ],
        },
        { name: "orcidUrl", type: "text" },
        { name: "googleScholarUrl", type: "text" },
        { name: "researchGateUrl", type: "text" },
        { name: "linkedinUrl", type: "text" },
      ],
    },

    // ── Article proposal ─────────────────────────────────────────────────────
    {
      type: "collapsible",
      label: "Article proposal",
      fields: [
        { name: "proposedTitle", type: "text", required: true },
        {
          type: "row",
          fields: [
            { name: "contentType", type: "relationship", relationTo: "blog-content-types", admin: { width: "50%" } },
            { name: "category", type: "relationship", relationTo: "blog-categories", admin: { width: "50%" } },
          ],
        },
        { name: "researchArea", type: "text" },
        { name: "abstract", type: "textarea", required: true },
        { name: "keywords", type: "text", admin: { description: "Comma-separated." } },
        { name: "articleText", type: "textarea", admin: { description: "Full article text if pasted (manuscript files below)." } },
        { name: "coAuthors", type: "textarea", admin: { description: "Co-author names / affiliations as submitted." } },
        { name: "previouslyPublished", type: "checkbox", defaultValue: false },
        { name: "previousPublicationUrl", type: "text" },
        { name: "conflictOfInterest", type: "textarea" },
        { name: "fundingAcknowledgement", type: "textarea" },
        { name: "additionalMessage", type: "textarea" },
        {
          name: "attachments",
          type: "relationship",
          relationTo: "blog-submission-files",
          hasMany: true,
        },
      ],
    },

    // ── Declarations (captured at submission time) ───────────────────────────
    {
      type: "collapsible",
      label: "Declarations",
      admin: { initCollapsed: true },
      fields: [
        { name: "copyrightConfirmed", type: "checkbox", admin: { readOnly: true } },
        { name: "authorisedToSubmit", type: "checkbox", admin: { readOnly: true } },
        { name: "understandsNoGuarantee", type: "checkbox", admin: { readOnly: true } },
        { name: "contactConsent", type: "checkbox", admin: { readOnly: true } },
        { name: "termsAccepted", type: "checkbox", admin: { readOnly: true } },
        {
          name: "sourceIpHash",
          type: "text",
          admin: { readOnly: true, description: "Salted hash used only for abuse prevention — never a raw IP." },
        },
      ],
    },

    // ── Internal review notes ────────────────────────────────────────────────
    {
      name: "reviewNotes",
      type: "array",
      admin: { description: "Internal notes — never sent to the contributor." },
      fields: [
        { name: "note", type: "textarea", required: true },
        { name: "byEmail", type: "text", admin: { readOnly: true } },
        { name: "at", type: "date", admin: { readOnly: true } },
      ],
      hooks: {
        beforeChange: [
          ({ value, req }) => {
            // Stamp author + time on any new notes (rows without `at`).
            if (!Array.isArray(value)) return value;
            return value.map((row: { note?: string; byEmail?: string; at?: string }) =>
              row?.at ? row : { ...row, byEmail: req.user?.email ?? "system", at: new Date().toISOString() },
            );
          },
        ],
      },
    },
  ],
  hooks: {
    afterChange: [
      auditAfterChange,
      /**
       * Contributor notification on review decisions. Fires only on a REAL
       * status transition into a notify-status (never on create, never twice),
       * escapes all user-supplied text, and never blocks the save.
       */
      async ({ req, doc, previousDoc, operation }) => {
        if (operation !== "update") return doc;
        const prev = (previousDoc as { status?: string } | undefined)?.status;
        const next = (doc as { status?: string }).status ?? "";
        if (prev === next) return doc;
        const template = NOTIFY_STATUSES[next];
        const to = (doc as { email?: string }).email;
        if (!template || !to) return doc;
        const d = doc as { fullName?: string; referenceNumber?: string; proposedTitle?: string; decisionMessage?: string };
        try {
          await req.payload.sendEmail({
            to,
            subject: template.subject(d.referenceNumber ?? ""),
            html: contributorEmailHtml({
              name: d.fullName ?? "Contributor",
              reference: d.referenceNumber ?? "",
              title: d.proposedTitle ?? "",
              intro: template.intro,
              message: d.decisionMessage,
            }),
          });
        } catch (e) {
          req.payload.logger.error(
            `[blog-submissions] contributor email (${next}) failed for ${d.referenceNumber}: ${(e as Error).message}`,
          );
        }
        return doc;
      },
    ],
    afterDelete: [auditAfterDelete],
  },
  endpoints: [
    /**
     * POST /api/blog-submissions/convert  { id }
     * Staff-only (content roles): copies the proposal into a NEW DRAFT article,
     * links it back, and marks the submission converted. Never publishes.
     */
    {
      path: "/convert",
      method: "post",
      handler: async (req: PayloadRequest) => {
        const { payload } = req;
        const user = req.user as { roles?: Role[] } | null;
        if (!hasRoleOrArea(user, ["super-admin", "admin", "marketing"], ["content"])) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        let body: { id?: string };
        try {
          body = ((await req.json?.()) ?? {}) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const id = String(body.id ?? "").trim();
        if (!/^[a-f0-9]{24}$/i.test(id)) {
          return Response.json({ error: "Invalid id" }, { status: 400 });
        }
        try {
          const sub = (await payload.findByID({
            collection: "blog-submissions",
            id,
            depth: 0,
            overrideAccess: true,
          })) as Record<string, unknown> | null;
          if (!sub) return Response.json({ error: "Not found" }, { status: 404 });
          if (sub.convertedArticle) {
            return Response.json({ error: "Already converted", articleId: sub.convertedArticle }, { status: 409 });
          }

          // Unique slug: base from the title, numeric suffix on collision.
          const base = slugify(String(sub.proposedTitle ?? "submission")) || "submission";
          let slug = base;
          for (let n = 2; n < 50; n++) {
            const clash = await payload.find({
              collection: "posts",
              where: { slug: { equals: slug } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (!clash.docs.length) break;
            slug = `${base}-${n}`;
          }

          const abstract = String(sub.abstract ?? "");
          const article = await payload.create({
            collection: "posts",
            draft: true,
            overrideAccess: true,
            data: {
              title: String(sub.proposedTitle ?? "Untitled submission"),
              slug,
              excerpt: abstract.length > 240 ? `${abstract.slice(0, 237)}…` : abstract || "Pending editorial summary.",
              abstract,
              body: plainTextToLexical(String(sub.articleText ?? "") || abstract),
              keywords: String(sub.keywords ?? ""),
              researchArea: String(sub.researchArea ?? ""),
              ...(sub.contentType ? { contentType: sub.contentType } : {}),
              ...(sub.category ? { primaryCategory: sub.category } : {}),
              author: [String(sub.fullName ?? ""), String(sub.organisation ?? "")].filter(Boolean).join(", "),
              workflowStatus: "in-review",
              allowReactions: true,
              sourceSubmission: id,
              _status: "draft",
            },
          });

          await payload.update({
            collection: "blog-submissions",
            id,
            overrideAccess: true,
            data: { status: "converted-to-draft", convertedArticle: article.id },
            user: req.user,
          });

          payload.logger.info(`[blog-submissions] ${sub.referenceNumber} converted to draft ${article.id} by ${req.user?.email}`);
          return Response.json({ ok: true, articleId: article.id });
        } catch (e) {
          payload.logger.error(`[blog-submissions/convert] failed: ${(e as Error).message}`);
          return Response.json({ error: "Conversion failed" }, { status: 500 });
        }
      },
    },
  ],
  timestamps: true,
};
