import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from "payload";

/**
 * On-demand website revalidation — pings the website's /api/revalidate after
 * any content save/delete so edits go live on the next request (the website
 * keeps a 60s ISR fallback if this ping ever fails).
 *
 * Fire-and-forget + throttled: saves never wait on the website, and the
 * boot-time seed (dozens of writes) collapses into a couple of pings.
 */
const WEBSITE = process.env.WEBSITE_URL || "http://localhost:3000";
const KEY = process.env.INTERNAL_API_KEY || "";

let lastPing = 0;
let trailing: NodeJS.Timeout | null = null;

function ping(): void {
  if (!KEY) return;
  const fire = () => {
    lastPing = Date.now();
    fetch(`${WEBSITE}/api/revalidate`, {
      method: "POST",
      headers: { "x-internal-key": KEY },
      signal: AbortSignal.timeout(4000),
    }).catch(() => {
      /* website down or unreachable — ISR covers it */
    });
  };
  const since = Date.now() - lastPing;
  if (since >= 2000) {
    fire();
  } else if (!trailing) {
    // Coalesce bursts (e.g. seeding) into one trailing ping.
    trailing = setTimeout(() => {
      trailing = null;
      fire();
    }, 2000 - since);
  }
}

export const revalidateWebsiteAfterChange: CollectionAfterChangeHook = async ({ doc }) => {
  ping();
  return doc;
};

export const revalidateWebsiteAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  ping();
  return doc;
};

export const revalidateWebsiteGlobal: GlobalAfterChangeHook = async ({ doc }) => {
  ping();
  return doc;
};
