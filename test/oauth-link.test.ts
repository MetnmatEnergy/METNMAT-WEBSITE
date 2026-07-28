import { describe, it, expect } from "vitest";
import { oauthLinkPolicy } from "../apps/dashboard/src/lib/oauth-link";

/**
 * Account pre-hijacking guard. Registration does not verify email, so a squatter
 * can create a password account on a victim's address. When the victim later
 * signs in with Google, that unverified password must NOT survive the link —
 * otherwise the squatter keeps a working login on an account that has just been
 * marked emailVerified (which also unlocks the victim's historical guest orders).
 */
describe("oauthLinkPolicy — anti account-pre-hijacking", () => {
  it("scrambles the password when linking onto an UNVERIFIED local account", () => {
    const d = oauthLinkPolicy({ authProvider: "local", emailVerified: false });
    expect(d.untrusted).toBe(true);
    // "google", not "linked", so the rightful owner can use /set-password after.
    expect(d.authProvider).toBe("google");
  });

  it("treats a missing emailVerified as unverified (default-deny)", () => {
    expect(oauthLinkPolicy({ authProvider: "local" }).untrusted).toBe(true);
    expect(oauthLinkPolicy({}).untrusted).toBe(true);
    expect(oauthLinkPolicy(null).untrusted).toBe(true);
    expect(oauthLinkPolicy(undefined).untrusted).toBe(true);
  });

  it("keeps the password of an account that already PROVED its email", () => {
    const d = oauthLinkPolicy({ authProvider: "local", emailVerified: true });
    expect(d.untrusted).toBe(false);
    expect(d.authProvider).toBe("linked");
  });

  it("leaves a Google-created account alone", () => {
    const d = oauthLinkPolicy({ authProvider: "google", emailVerified: true });
    expect(d.untrusted).toBe(false);
    expect(d.authProvider).toBe("google");
  });

  it("does not trust a truthy-but-not-true emailVerified", () => {
    // Guards against a loose value ("false", 0, "yes") being read as verified.
    for (const v of ["true", 1, "yes", {}]) {
      expect(oauthLinkPolicy({ authProvider: "local", emailVerified: v }).untrusted).toBe(true);
    }
  });

  it("an already-linked account keeps its password on subsequent sign-ins", () => {
    // After the first repair the row is authProvider:"google" + emailVerified:true,
    // so repeat Google logins must be idempotent and NOT reset the password the
    // owner has since chosen.
    const d = oauthLinkPolicy({ authProvider: "google", emailVerified: true });
    expect(d.untrusted).toBe(false);
  });
});
