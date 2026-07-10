import { getFieldsToSign, jwtSign, type CollectionConfig } from "payload";
import { randomBytes } from "crypto";
import { isAdmin } from "../access";
import { safeKeyEqual } from "../lib/internal-key";
import { assignUserCode } from "../hooks/customer-code";

/**
 * Field access for server-managed sign-in fields. `admin.readOnly` only hides a
 * field in the admin UI — it does NOT stop a REST/Local API write. Since public
 * registration (create) and customer self-update are allowed, without this a
 * customer could PATCH their own record to forge emailVerified / authProvider /
 * googleId. Only staff may write these; the Google OAuth endpoint uses
 * overrideAccess (which bypasses field access) so its link/create still works.
 */
const staffOnlyField = {
  create: ({ req }: { req: { user?: { collection?: string } | null } }) => req.user?.collection === "users",
  update: ({ req }: { req: { user?: { collection?: string } | null } }) => req.user?.collection === "users",
};

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
    defaultColumns: ["userCode", "name", "email", "phone", "company", "createdAt"],
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
    {
      // Permanent METNMAT member id (MNM-U-YY-000000). Assigned once on create by
      // the assignUserCode hook (below) from an atomic per-year counter, then
      // immutable. Indexed (non-unique — a unique index can't build while legacy
      // rows share a null value; the atomic counter is the uniqueness guarantee).
      name: "userCode",
      type: "text",
      index: true,
      label: "Customer code",
      admin: {
        readOnly: true,
        position: "sidebar",
        description: "Permanent METNMAT member id — auto-assigned on signup, immutable.",
      },
    },
    { name: "name", type: "text", required: true },
    {
      type: "row",
      fields: [
        { name: "phone", type: "text", admin: { width: "50%" } },
        {
          name: "company",
          type: "text",
          label: "Institution / Company",
          admin: { width: "50%", description: "University, lab, or company." },
        },
      ],
    },
    {
      name: "role",
      type: "select",
      label: "Role",
      options: [
        { label: "Student", value: "student" },
        { label: "PhD / Research Scholar", value: "phd" },
        { label: "Faculty / Professor", value: "faculty" },
        { label: "Scientist / R&D", value: "scientist" },
        { label: "Institution / Procurement", value: "procurement" },
        { label: "Industry", value: "industry" },
        { label: "Other", value: "other" },
      ],
      admin: { description: "Self-selected at signup (optional). Helps tailor support." },
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
          access: staffOnlyField,
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
          access: staffOnlyField,
          label: "Email verified",
          admin: { readOnly: true, width: "50%" },
        },
      ],
    },
    {
      name: "googleId",
      type: "text",
      index: true,
      access: staffOnlyField,
      admin: { readOnly: true, description: "Google account id (the OAuth `sub`)." },
    },
    {
      name: "avatarUrl",
      type: "text",
      label: "Avatar URL",
      access: staffOnlyField,
      admin: { readOnly: true, description: "Google profile photo (optional)." },
    },
    {
      // Customer-chosen profile picture, set on the storefront account page: an
      // emoji preset (a few bytes) or a small resized data-URI photo. Size-capped
      // so it can't bloat the record. Distinct from the Google-managed avatarUrl.
      name: "avatar",
      type: "text",
      label: "Profile picture",
      maxLength: 300000,
      admin: { readOnly: true, description: "Emoji preset or small data-URI photo (self-set)." },
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
        {
          type: "row",
          fields: [
            { name: "name", type: "text", label: "Recipient name", admin: { width: "50%" } },
            { name: "phone", type: "text", label: "Mobile number", admin: { width: "50%" } },
          ],
        },
        { name: "line1", type: "text", label: "Address (area & street)" },
        { name: "line2", type: "text", label: "Locality" },
        {
          type: "row",
          fields: [
            { name: "city", type: "text", label: "City / District / Town", admin: { width: "33%" } },
            { name: "state", type: "text", admin: { width: "33%" } },
            { name: "pincode", type: "text", admin: { width: "34%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "landmark", type: "text", label: "Landmark", admin: { width: "50%" } },
            { name: "altPhone", type: "text", label: "Alternate phone", admin: { width: "50%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "country", type: "text", defaultValue: "India", admin: { width: "50%" } },
            {
              name: "addressType",
              type: "select",
              label: "Address type",
              options: [
                { label: "Home", value: "home" },
                { label: "Work", value: "work" },
              ],
              admin: { width: "50%" },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    // Mint the immutable MNM-U-YY code on create (both email + Google signup flow
    // through here); keep it unchangeable on every update. See customer-code.ts.
    beforeChange: [assignUserCode],
  },
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
        const { payload } = req;
        // Session-minting endpoint: require the dedicated CMS_OAUTH_KEY when it is
        // set (so a leaked shared INTERNAL_API_KEY cannot mint customer sessions);
        // otherwise fall back to INTERNAL_API_KEY (logged) so a half-configured
        // deploy still works. Set CMS_OAUTH_KEY on BOTH services for least privilege.
        const providedKey = req.headers.get("x-internal-key");
        const dedicatedKey = process.env.CMS_OAUTH_KEY;
        const keyOk = dedicatedKey
          ? safeKeyEqual(providedKey, dedicatedKey)
          : safeKeyEqual(providedKey, process.env.INTERNAL_API_KEY);
        if (!keyOk) {
          payload.logger.warn(
            "[customers/oauth] unauthorized: x-internal-key missing/mismatched — check CMS_OAUTH_KEY / INTERNAL_API_KEY parity between website and dashboard"
          );
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!dedicatedKey) {
          payload.logger.warn(
            "[customers/oauth] using INTERNAL_API_KEY fallback — set a dedicated CMS_OAUTH_KEY on BOTH services for least privilege"
          );
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
          payload.logger.warn("[customers/oauth] rejected: missing email/googleId or email not Google-verified");
          return Response.json({ error: "Invalid OAuth payload" }, { status: 400 });
        }

        // Link data reused by the normal and the race-recovery paths. We always
        // store the authenticating account's googleId and refresh the avatar when
        // Google provides one. The existing password is never touched.
        const linkData = (existingProvider: unknown) => ({
          googleId,
          authProvider: existingProvider === "google" ? "google" : "linked",
          emailVerified: true,
          ...(avatarUrl ? { avatarUrl } : {}),
        });

        try {
          const findByEmail = async () =>
            (
              await payload.find({
                collection: "customers",
                where: { email: { equals: email } },
                limit: 1,
                depth: 0,
                overrideAccess: true,
              })
            ).docs[0];

          let user = await findByEmail();
          // True only when THIS request created the account — the website uses it
          // to onboard a brand-new Google customer into choosing a password. A
          // repeat Google sign-in, or a link onto an existing account, must not
          // re-trigger that.
          let created = false;

          if (!user) {
            // New Google account. Random password = valid account with no known
            // local password; `authProvider: "google"` marks it as password-less
            // until the customer sets one (which flips it to "linked").
            try {
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
              created = true;
            } catch (createErr) {
              // A concurrent first login raced us to create this email (the auth
              // email field is unique). Re-find and link instead of 500-ing.
              const raced = await findByEmail();
              if (!raced) throw createErr;
              user = await payload.update({
                collection: "customers",
                id: raced.id,
                overrideAccess: true,
                data: linkData(raced.authProvider),
              });
            }
          } else {
            // Auto-link Google to the existing account (password untouched).
            user = await payload.update({
              collection: "customers",
              id: user.id,
              overrideAccess: true,
              data: linkData(user.authProvider),
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
          return Response.json({ token, exp, created });
        } catch (e) {
          payload.logger.error(`[customers/oauth] ${(e as Error).message}`);
          return Response.json({ error: "OAuth login failed" }, { status: 500 });
        }
      },
    },

    /**
     * Add a password to a Google-only account, so the customer can afterwards
     * sign in EITHER with Google or with email + password (`authProvider` →
     * "linked"). `authProvider` is a staff-only field, so the customer's own JWT
     * cannot flip it — this runs with overrideAccess instead.
     *
     * Guarded by the same session-grade key as /oauth. The `authProvider ===
     * "google"` precondition is load-bearing: it means the endpoint can only ever
     * ADD a password where none was ever chosen. Without it, a leaked key would be
     * an account-takeover primitive against every customer.
     *
     * The CALLER (website) is responsible for authenticating the customer and
     * passing their own id — it never accepts an id from the browser.
     */
    {
      path: "/set-password",
      method: "post",
      handler: async (req) => {
        const { payload } = req;
        const providedKey = req.headers.get("x-internal-key");
        const dedicatedKey = process.env.CMS_OAUTH_KEY;
        const keyOk = dedicatedKey
          ? safeKeyEqual(providedKey, dedicatedKey)
          : safeKeyEqual(providedKey, process.env.INTERNAL_API_KEY);
        if (!keyOk) {
          payload.logger.warn("[customers/set-password] unauthorized: x-internal-key missing/mismatched");
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: { customerId?: string; password?: string };
        try {
          body = ((await req.json?.()) ?? {}) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const customerId = String(body.customerId ?? "").trim();
        const password = String(body.password ?? "");
        if (!customerId || password.length < 8) {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        try {
          const user = await payload
            .findByID({ collection: "customers", id: customerId, depth: 0, overrideAccess: true })
            .catch(() => null);
          if (!user) return Response.json({ error: "Not found" }, { status: 404 });

          if ((user as { authProvider?: string }).authProvider !== "google") {
            // Already has a password of their own — changing it must go through
            // /api/account/password, which verifies the current one.
            return Response.json({ error: "A password is already set." }, { status: 409 });
          }

          await payload.update({
            collection: "customers",
            id: customerId,
            overrideAccess: true,
            data: { password, authProvider: "linked" },
          });
          return Response.json({ success: true });
        } catch (e) {
          payload.logger.error(`[customers/set-password] ${(e as Error).message}`);
          return Response.json({ error: "Couldn't set the password" }, { status: 500 });
        }
      },
    },
  ],
};
