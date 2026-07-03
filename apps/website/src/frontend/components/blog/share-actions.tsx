"use client";

/** Copy link / native share / print — with screen-reader status feedback. */
import React from "react";
import { Link2, Printer, Share2 } from "lucide-react";

export function ShareActions({ title }: { title: string }) {
  const [message, setMessage] = React.useState("");
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Link copied to clipboard.");
    } catch {
      setMessage("Could not copy — use your browser's share menu.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, url: window.location.href });
    } catch {
      /* user dismissed */
    }
  };

  const cls =
    "inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className={cls}>
          <Link2 aria-hidden className="h-4 w-4" /> Copy link
        </button>
        {canShare && (
          <button type="button" onClick={share} className={cls}>
            <Share2 aria-hidden className="h-4 w-4" /> Share
          </button>
        )}
        <button type="button" onClick={() => window.print()} className={`${cls} hidden sm:inline-flex`}>
          <Printer aria-hidden className="h-4 w-4" /> Print
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-1 min-h-4 text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
