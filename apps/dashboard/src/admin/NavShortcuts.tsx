import React from "react";
import { NavShortcutsClient } from "./NavShortcutsClient";

/**
 * Wix-style top-of-sidebar shortcuts (via admin.beforeNavLinks, under the logo):
 * Home, Analytics, and View live site. Server shell — reads the server-only
 * WEBSITE_URL for the live-site link — then hands off to a client component that
 * highlights the active route (usePathname) so the items feel native to the nav.
 */
export default function NavShortcuts() {
  const site = (process.env.WEBSITE_URL || "https://www.metnmat.com").replace(/\/+$/, "");
  return <NavShortcutsClient siteUrl={site} />;
}
