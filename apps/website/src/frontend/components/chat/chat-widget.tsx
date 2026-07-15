"use client";

import Script from "next/script";

/**
 * Loads the Metnmat customer-agent chat bubble.
 *
 * The chatbot is a SEPARATE service (the Metnmat-customer-agent app) that must be
 * running on its own host. This only injects its embed script — the widget then
 * serves its own iframe UI and talks to its own API, all from the chatbot origin.
 *
 * Point NEXT_PUBLIC_CHATBOT_URL at that host:
 *   - local test: http://localhost:3002
 *   - production: https://your-chatbot.onrender.com
 *
 * If the var is unset, nothing renders (the site works without the bot).
 */
const CHATBOT_URL = process.env.NEXT_PUBLIC_CHATBOT_URL;

export function ChatWidget() {
  if (!CHATBOT_URL) return null;

  return (
    <Script
      src={`${CHATBOT_URL}/widget.js`}
      data-site-key="metnmat-main"
      // The chat bubble is non-critical UI. lazyOnload defers this ~350 KiB
      // third-party script to browser idle, AFTER the page has loaded, so it no
      // longer competes with the LCP image, fonts and hydration. The bubble
      // appears a moment later — the right trade for a support widget.
      strategy="lazyOnload"
    />
  );
}
