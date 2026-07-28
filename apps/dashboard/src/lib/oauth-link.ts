/**
 * Policy for linking a Google identity onto an EXISTING customer row.
 *
 * Registration does not verify the email address, so anyone can create a
 * password account on somebody else's address and wait ("account
 * pre-hijacking"). If that victim later signs in with Google and we simply
 * attached the Google identity, the squatter would keep a working password on an
 * account that is now `emailVerified` — which also widens order/invoice access
 * to every guest order ever placed on that address (see ownerClause).
 *
 * Google has just PROVEN who owns the inbox. So when we link onto a local
 * account that never proved its email, we treat the existing password as
 * untrusted and scramble it. Writing a password also bumps `sessionsValidFrom`
 * (stampSessionsOnPasswordChange), which invalidates any JWT the squatter holds.
 *
 * Accounts Google itself created, and accounts that already proved their email,
 * are trusted: their password is left exactly as it was.
 */
export type OauthLinkDecision = {
  /** The existing local password was never email-verified — scramble it. */
  untrusted: boolean;
  /**
   * "google" on the untrusted path (not "linked") so the rightful owner can
   * afterwards choose their own password via /set-password, which requires
   * authProvider === "google".
   */
  authProvider: "google" | "linked";
};

export function oauthLinkPolicy(existing: Record<string, unknown> | null | undefined): OauthLinkDecision {
  const provider = existing?.authProvider;
  const untrusted = provider !== "google" && existing?.emailVerified !== true;
  return {
    untrusted,
    authProvider: untrusted || provider === "google" ? "google" : "linked",
  };
}
