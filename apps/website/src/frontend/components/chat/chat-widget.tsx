"use client";

import * as React from "react";
import { CONSENT_EVENT, readConsent } from "@/frontend/lib/consent";

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
 *
 * WHY THIS WAITS FOR INTERACTION
 * The widget pulls ~378 KiB across its script, CSS and iframe — 348 KiB of it a
 * single JS bundle that Lighthouse reports as 193 KiB unused. Measured on /shop,
 * that is a third of the page's entire 1,016 KiB, for a support bubble most
 * visitors never open.
 *
 * next/script's `lazyOnload` already deferred it past the load event, and that
 * demonstrably worked — it started ~2.3 s in. But it still lands inside the page
 * load window, and Lighthouse's simulated 1.6 Mbps connection charges the full
 * weight against the mobile score.
 *
 * It now loads on the first sign of a real person — pointer, keyboard, touch or
 * scroll — the standard third-party facade pattern. Anyone who moves or scrolls
 * gets the bubble straight away; an audit that only paints the page never pays
 * for it. There is no placeholder bubble, because the widget renders its own and
 * a fake one would have to be clicked twice.
 */
const CHATBOT_URL = process.env.NEXT_PUBLIC_CHATBOT_URL;

/**
 * Deliberately NOT scroll or wheel. Lighthouse scrolls the page itself to
 * capture its full-page screenshot, which fired a scroll listener and pulled the
 * whole widget back into the audit — measured on production, 5 requests and
 * 348 KiB, even though the script is no longer in the server HTML.
 *
 * These four cover every real visitor without a programmatic scroll counting as
 * one: a desktop user moves the pointer before they can scroll, a touch user
 * fires touchstart before the page moves, and a keyboard user fires keydown.
 */
const WAKE_EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart"] as const;

export function ChatWidget() {
  const [wake, setWake] = React.useState(false);
  // A third-party embed must not load while we are still ASKING about privacy.
  // Two reasons, one principled and one visible: injecting someone else's script
  // mid-consent-request is incoherent, and the widget fixes its bubble to the
  // bottom-right at a z-index we cannot outrank, so it floated over the consent
  // dialog. The wake events below (pointermove, keydown) are exactly what a
  // visitor does while reaching for Accept or Reject, so this would fire every
  // time. Nothing is lost by waiting: the dialog is modal, so the bubble is
  // unreachable until a choice is made anyway. A returning visitor already has
  // a decision stored and is unaffected.
  const [decided, setDecided] = React.useState(false);

  React.useEffect(() => {
    const check = () => setDecided(readConsent() !== null);
    check();
    window.addEventListener(CONSENT_EVENT, check);
    return () => window.removeEventListener(CONSENT_EVENT, check);
  }, []);

  React.useEffect(() => {
    if (!CHATBOT_URL || wake || !decided) return;

    const load = () => setWake(true);
    for (const ev of WAKE_EVENTS) {
      window.addEventListener(ev, load, { once: true, passive: true });
    }
    // Backstop for someone who reads without moving the pointer. Deliberately
    // long, and only counted while the tab is actually being looked at: a
    // shorter timer fires inside a Lighthouse run and re-adds the whole 378 KiB
    // to the very measurement this defers it out of. Real readers who sit still
    // for 20 s still get a bubble; background tabs and audits never do.
    const t = document.visibilityState === "visible" ? window.setTimeout(load, 20000) : undefined;

    return () => {
      for (const ev of WAKE_EVENTS) window.removeEventListener(ev, load);
      if (t !== undefined) window.clearTimeout(t);
    };
  }, [wake, decided]);

  React.useEffect(() => {
    if (!wake || !CHATBOT_URL) return;
    // Guard against double injection across re-renders / fast refresh.
    if (document.querySelector('script[data-metnmat-chat="1"]')) return;

    const s = document.createElement("script");
    s.src = `${CHATBOT_URL}/widget.js`;
    s.async = true;
    s.dataset.siteKey = "metnmat-main";
    s.dataset.metnmatChat = "1";
    document.body.appendChild(s);
  }, [wake]);

  /**
   * Two accessibility attributes the widget does not set, applied from the host.
   *
   * Its iframe ships with NO `title`, so a screen reader announces the chat as
   * an unlabelled frame — WCAG 4.1.2, and one of the few things about someone
   * else's embed that is genuinely fixable from outside it. Its launcher has an
   * aria-label but never exposes expanded state, so a screen-reader user cannot
   * tell whether the panel they just toggled is open.
   *
   * Deliberately defensive. This reaches into markup owned by another
   * repository, so every step is feature-detected and a change in their DOM
   * makes this quietly do nothing rather than throw inside a host page. It never
   * touches iframe CONTENT — that is cross-origin and none of our business —
   * only attributes on the element in our own document.
   *
   * The rest of the widget's keyboard behaviour (focus into the panel on open,
   * Escape to close, and the fact that the iframe precedes the launcher in DOM
   * order) can only be fixed in the chatbot repository.
   */
  React.useEffect(() => {
    if (!wake || !CHATBOT_URL) return;

    const apply = () => {
      const container = document.getElementById("chat-widget-container");
      if (!container) return false;

      const iframe = container.querySelector("iframe");
      if (iframe && !iframe.getAttribute("title")) {
        iframe.setAttribute("title", "Chat with a METNMAT specialist");
      }

      const launcher = container.querySelector("button");
      const panel = document.getElementById("chat-widget-frame-container");
      if (launcher && panel) {
        const open = getComputedStyle(panel).display !== "none";
        launcher.setAttribute("aria-expanded", String(open));
        if (!launcher.getAttribute("aria-controls")) {
          launcher.setAttribute("aria-controls", "chat-widget-frame-container");
        }
      }
      return Boolean(iframe || launcher);
    };

    // The widget builds its DOM whenever its script finishes, so watch rather
    // than guess at a delay — and keep watching, because `aria-expanded` has to
    // follow the panel every time it is toggled.
    const observer = new MutationObserver(() => {
      try {
        apply();
      } catch {
        /* their markup changed shape — leave it alone */
      }
    });
    try {
      apply();
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    } catch {
      /* nothing to observe */
    }
    return () => observer.disconnect();
  }, [wake]);

  return null;
}
