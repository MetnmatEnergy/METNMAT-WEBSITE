import { getFieldsToSign, jwtSign, type CollectionConfig } from "payload";
import { randomBytes } from "crypto";
import { isAdmin } from "../access";
import { inboundKeyMatches } from "../lib/internal-key";

/**
 * Website customer accounts (storefront login) — a SEPARATE auth collection from
 * staff `users`. Customers register/login via the website, which talks to these
 * REST endpoints. They can read & edit only their own record; staff see all.
 * Guest checkout still works (orders just won't link to a customer).
 */
export const Customers: CollectionConfig = {
  slug: "customers",
  auth: {
    // Stateless JWT (no server-side sessions). The website stores the Payload JWT
    // in an httpOnly cookie and sends it as a Bearer token; it never relied on
    // Payload sessions. Disabling sessions lets us mint a valid token for Google
    // sign-in (getFieldsToSign + jwtSign) WITHOUT a password — so auto-linking an
    // existing account keeps that user's password intact — while existing
    // email/password logins keep working unchanged.
    useSessions: false,
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000,
    forgotPassword: {
      generateEmailSubject: () => "Reset your METNMAT password",
      generateEmailHTML: (args) => {
        const token = (args as { token?: string } | undefined)?.token ?? "";
        const base = process.env.WEBSITE_URL || "http://localhost:3000";
        const url = `${base}/reset?token=${token}`;
        return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2 style="margin:0 0 12px">Reset your password</h2>
          <p style="color:#444;line-height:1.5">We received a request to reset the password for your METNMAT account. Click the button below to choose a new one. This link expires in 1 hour.</p>
          <p style="margin:22px 0"><a href="${url}" style="background:#d81f26;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Reset password</a></p>
          <p style="color:#888;font-size:13px;line-height:1.5">If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all">${url}</span></p>
          <p style="color:#888;font-size:13px;margin-top:18px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        </div>`;
      },
    },
  },
  admin: {
    group: "Sales",
    useAsTitle: "email",
    defaultColumns: ["name", "email", "phone", "company", "createdAt"],
    description: "Storefront customer accounts. Created when shoppers register on the website.",
  },
  access: {
    create: () => true, // public registration from the website
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.collection === "users") return true; // staff see all
      return { id: { equals: user.id } }; // customers see only themselves
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      if (user.collection === "users") return true;
      return { id: { equals: user.id } };
    },
    delete: isAdmin,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      type: "row",
      fields: [
        { name: "phone", type: "text", admin: { width: "50%" } },
        { name: "company", type: "text", admin: { width: "50%" } },
      ],
    },
    { name: "gstin", type: "text", label: "GSTIN" },
    // ── Sign-in provider (managed by the server; read-only in admin) ───────────
    {
      type: "row",
      fields: [
        {
          name: "authProvider",
          type: "select",
          defaultValue: "local",
          options: [
            { label: "Local (password)", value: "local" },
            { label: "Google", value: "google" },
            { label: "Linked (password + Google)", value: "linked" },
          ],
          admin: { readOnly: true, width: "50%", description: "How this customer signs in." },
        },
        {
          name: "emailVerified",
          type: "checkbox",
          defaultValue: false,
          label: "Email verified",
          admin: { readOnly: true, width: "50%" },
        },
      ],
    },
    {
      name: "googleId",
      type: "text",
      index: true,
      admin: { readOnly: true, description: "Google account id (the OAuth `sub`)." },
    },
    {
      name: "avatarUrl",
      type: "text",
      label: "Avatar URL",
      admin: { readOnly: true, description: "Google profile photo (optional)." },
    },
    {
      name: "addresses",
      type: "array",
      labels: { singular: "Address", plural: "Addresses" },
      fields: [
        {
          type: "row",
          fields: [
            { name: "label", type: "text", admin: { width: "60%", placeholder: "e.g. Office, Warehouse" } },
            { name: "isDefault", type: "checkbox", label: "Default", admin: { width: "40%" } },
          ],
        },
        { name: "line1", type: "text", label: "Address line 1" },
        { name: "line2", type: "text", label: "Address line 2" },
        {
          type: "row",
          fields: [
            { name: "city", type: "text", admin: { width: "33%" } },
            { name: "state", type: "text", admin: { width: "33%" } },
            { name: "pincode", type: "text", admin: { width: "34%" } },
          ],
        },
        { name: "country", type: "text", defaultValue: "India" },
      ],
    },
  ],
  endpoints: [
    /**
     * Server-to-server OAuth login. The website verifies the Google identity,
     * then calls this with the shared internal key and a Google-verified email.
     * We find-or-create/link the customer and return a Payload JWT the website
     * stores in its `mm-customer` cookie — the same token shape as a normal login.
     * Never exposed to the browser; guarded by the internal key only.
     */
    {
      path: "/oauth",
      method: "post",
      handler: async (req) => {
        if (!inboundKeyMatches(req.headers.get("x-internal-key"), "CMS_OAUTH_KEY")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        let body: {
          email?: string;
          googleId?: string;
          name?: string;
          emailVerified?: boolean;
          avatarUrl?: string;
        };
        try {
          body = ((await req.json?.()) ?? {}) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const email = String(body.email ?? "").trim().toLowerCase();
        const googleId = String(body.googleId ?? "").trim();
        const name = String(body.name ?? "").trim() || email.split("@")[0] || "Customer";
        const avatarUrl = body.avatarUrl ? String(body.avatarUrl) : undefined;
        // Only ever create/link off a Google-VERIFIED email (anti account-takeover).
        if (!email || !googleId || body.emailVerified !== true) {
          return Response.json({ error: "Invalid OAuth payload" }, { status: 400 });
        }

        const { payload } = req;
        try {
          const existing = await payload.find({
            collection: "customers",
            where: { email: { equals: email } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });
          let user = existing.docs[0];

          if (!user) {
            // New Google account. Random password = valid account with no known
            // local password; the user can set one later via /forgot.
            user = await payload.create({
              collection: "customers",
              overrideAccess: true,
              data: {
                name,
                email,
                googleId,
                authProvider: "google",
                emailVerified: true,
                password: randomBytes(32).toString("base64url"),
                ...(avatarUrl ? { avatarUrl } : {}),
              },
            });
          } else {
            // Auto-link Google to the existing account (password untouched).
            user = await payload.update({
              collection: "customers",
              id: user.id,
              overrideAccess: true,
              data: {
                googleId: user.googleId || googleId,
                authProvider: user.authProvider === "google" ? "google" : "linked",
                emailVerified: true,
                ...(avatarUrl && !user.avatarUrl ? { avatarUrl } : {}),
              },
            });
          }

          const collectionConfig = payload.collections["customers"]!.config;
          // getFieldsToSign expects the user object to carry its `collection`
          // (Payload's own login sets this before signing).
          const signUser = { ...user, collection: "customers" } as Parameters<typeof getFieldsToSign>[0]["user"];
          const fieldsToSign = getFieldsToSign({ collectionConfig, email: String(user.email), user: signUser });
          const { token, exp } = await jwtSign({
            fieldsToSign,
            secret: payload.secret,
            tokenExpiration: collectionConfig.auth.tokenExpiration,
          });
          return Response.json({ token, exp });
        } catch (e) {
          payload.logger.error(`[customers/oauth] ${(e as Error).message}`);
          return Response.json({ error: "OAuth login failed" }, { status: 500 });
        }
      },
    },
  ],
};
