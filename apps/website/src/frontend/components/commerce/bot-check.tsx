"use client";

import * as React from "react";

/**
 * Client half of the quote form's bot check (server half: backend/lib/form-guard.ts).
 *
 * Two things travel with every submission:
 *  - `formToken`, a signed timestamp fetched from /api/quote/token when the
 *    form is first shown. The server checks that it exists and that enough
 *    time has passed since it was minted for a person to have filled the form.
 *  - `turnstileToken`, from the Cloudflare Turnstile widget, when a site key
 *    was baked into the build. Turnstile is the stronger check and, when
 *    configured, the server relies on it instead of the timing token.
 *
 * Both are collected at submit time, so a form that loaded before the token
 * request finished still gets one. The widget uses Cloudflare's
 * "interaction-only" appearance: invisible for the overwhelming majority of
 * visitors, and only shown when a challenge actually needs a click.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** How long a submit waits for the widget to produce a token before giving up. */
const TURNSTILE_WAIT_MS = 8_000;

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => boolean | void;
      "timeout-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      appearance?: "always" | "execute" | "interaction-only";
    }
  ): string | undefined;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoader: Promise<TurnstileApi> | null = null;

/** Load Cloudflare's script once per page, the first time a form needs it. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoader) {
    turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = TURNSTILE_SCRIPT;
      s.async = true;
      s.defer = true;
      s.onload = () =>
        window.turnstile
          ? resolve(window.turnstile)
          : reject(new Error("turnstile did not initialise"));
      s.onerror = () => {
        turnstileLoader = null;
        reject(new Error("turnstile script failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return turnstileLoader;
}

export type BotCheckFields = { formToken?: string; turnstileToken?: string };

export type BotCheck = {
  /** Render this inside the form, near the submit button. Null when Turnstile is not configured. */
  widget: React.ReactNode;
  /** Gather the fields to spread into the submit payload. May wait briefly for Turnstile. */
  collect: () => Promise<BotCheckFields>;
  /**
   * Call after every submit attempt. Turnstile tokens are single-use, so the
   * widget is reset; pass `formToken: true` when the server said the timing
   * token itself was the problem, so the next attempt fetches a fresh one.
   */
  reset: (opts?: { formToken?: boolean }) => void;
};

/**
 * @param active  Whether the form is currently shown. The drawer and modal are
 *                mounted on every page and merely hidden, so the token fetch and
 *                the Cloudflare script wait until someone actually opens them.
 */
export function useBotCheck(active: boolean): BotCheck {
  const formToken = React.useRef<string | null>(null);
  const formTokenRequest = React.useRef<Promise<string | null> | null>(null);
  const turnstileToken = React.useRef<string | null>(null);
  const widgetId = React.useRef<string | null>(null);

  const fetchFormToken = React.useCallback((): Promise<string | null> => {
    if (formToken.current) return Promise.resolve(formToken.current);
    if (!formTokenRequest.current) {
      formTokenRequest.current = fetch("/api/quote/token", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { token?: string | null } | null) => {
          formToken.current = typeof d?.token === "string" ? d.token : null;
          return formToken.current;
        })
        .catch(() => {
          // Let the submit try again rather than caching the failure.
          formTokenRequest.current = null;
          return null;
        });
    }
    return formTokenRequest.current;
  }, []);

  React.useEffect(() => {
    if (active) void fetchFormToken();
  }, [active, fetchFormToken]);

  const collect = React.useCallback(async (): Promise<BotCheckFields> => {
    const token = await fetchFormToken();
    let turnstile = turnstileToken.current;
    if (SITE_KEY && !turnstile) {
      // The managed widget normally resolves within a second of rendering.
      // Waiting here beats failing the submit for a visitor who typed quickly.
      const until = Date.now() + TURNSTILE_WAIT_MS;
      while (!turnstileToken.current && Date.now() < until) {
        await new Promise((r) => setTimeout(r, 150));
      }
      turnstile = turnstileToken.current;
    }
    return {
      ...(token ? { formToken: token } : {}),
      ...(turnstile ? { turnstileToken: turnstile } : {}),
    };
  }, [fetchFormToken]);

  const reset = React.useCallback((opts?: { formToken?: boolean }) => {
    turnstileToken.current = null;
    if (widgetId.current) {
      try {
        window.turnstile?.reset(widgetId.current);
      } catch {
        /* widget already gone */
      }
    }
    if (opts?.formToken) {
      formToken.current = null;
      formTokenRequest.current = null;
    }
  }, []);

  const onToken = React.useCallback((t: string | null) => {
    turnstileToken.current = t;
  }, []);
  const onWidget = React.useCallback((id: string | null) => {
    widgetId.current = id;
  }, []);

  const widget =
    SITE_KEY && active ? <TurnstileWidget onToken={onToken} onWidget={onWidget} /> : null;

  return { widget, collect, reset };
}

function TurnstileWidget({
  onToken,
  onWidget,
}: {
  onToken: (token: string | null) => void;
  onWidget: (id: string | null) => void;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let id: string | undefined;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !container.current) return;
        id = ts.render(container.current, {
          sitekey: SITE_KEY,
          theme: "auto",
          size: "flexible",
          appearance: "interaction-only",
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
          "timeout-callback": () => onToken(null),
          "error-callback": () => {
            onToken(null);
            setFailed(true);
            return true; // handled — keeps Cloudflare from logging a console error
          },
        });
        onWidget(id ?? null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      onWidget(null);
      onToken(null);
      if (id) {
        try {
          window.turnstile?.remove(id);
        } catch {
          /* already removed */
        }
      }
    };
  }, [onToken, onWidget]);

  return (
    <div data-bot-check="turnstile">
      <div ref={container} />
      {failed && (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          The verification step couldn&apos;t load. If you use a content blocker, allow
          challenges.cloudflare.com and try again, or email us at contact@metnmat.com.
        </p>
      )}
    </div>
  );
}
