"use client";

import * as React from "react";
import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";
import { REGION_GLYPH, REGION_LABEL, currencyForRegion, isRegion, type Region } from "@/frontend/lib/region";

/**
 * Choose a shopping region.
 *
 * Browser geolocation is requested ONLY when the visitor presses the button —
 * never on load. That is the consent boundary: the page has already resolved a
 * region from the request IP, so this exists to let someone correct it, not to
 * gate the shop behind a permission prompt.
 *
 * Every failure path lands in the same place: the two explicit buttons. A denied
 * permission, a browser without the API, a timeout and an unresolvable
 * coordinate are different messages and identical outcomes.
 */

// A denial is remembered so the prompt is never fired at the same person twice.
// Browsers persist the denial themselves, but a second call still produces an
// error the user never sees a reason for; not asking is clearer than asking and
// silently failing.
const DENIED_KEY = "mm-geo-denied";

type Status =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "error"; message: string };

export function RegionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { region, setRegion } = useCurrency();
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [denied, setDenied] = React.useState(false);

  React.useEffect(() => {
    try {
      setDenied(localStorage.getItem(DENIED_KEY) === "1");
    } catch {
      /* treat as not denied */
    }
  }, []);

  const choose = (r: Region) => {
    setRegion(r);
    onOpenChange(false);
  };

  const detect = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus({
        kind: "error",
        message: "This browser can't share a location. Pick your region below instead.",
      });
      return;
    }
    setStatus({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Coordinates go to the server, which resolves the country. The
          // browser never decides the region on its own.
          const res = await fetch("/api/geo/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          });
          if (!res.ok) throw new Error("resolve failed");
          const j = (await res.json()) as { region?: string };
          if (!isRegion(j?.region)) throw new Error("bad region");
          choose(j.region);
        } catch {
          setStatus({
            kind: "error",
            message: "We found your position but couldn't match it to a region. Pick one below.",
          });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          try {
            localStorage.setItem(DENIED_KEY, "1");
          } catch {
            /* ignore */
          }
          setDenied(true);
          setStatus({
            kind: "error",
            message: "We couldn't detect your location. Please select your shopping region manually.",
          });
          return;
        }
        setStatus({
          kind: "error",
          message: "Your location wasn't available just now. Pick your region below.",
        });
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 }
    );
    // `choose` is stable enough for this callback and re-creating it on every
    // region change would not change behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your shopping region</DialogTitle>
          <DialogDescription>
            This sets the currency, payment methods and delivery options you see.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-2">
          {(["IN", "INTL"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => choose(r)}
              aria-current={region === r}
              className={
                "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition " +
                (region === r
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-foreground/25 hover:bg-surface")
              }
            >
              <span className="flex items-center gap-3">
                <span aria-hidden className="text-lg">
                  {REGION_GLYPH[r]}
                </span>
                <span className="font-medium">{REGION_LABEL[r]}</span>
              </span>
              <span className="text-sm text-muted-foreground">{currencyForRegion(r)}</span>
            </button>
          ))}
        </div>

        {/* Only shown while it can still do something. Once a permission has
            been refused, offering it again just produces the same refusal. */}
        {!denied && (
          <div className="mt-4 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={detect}
              disabled={status.kind === "locating"}
            >
              {status.kind === "locating" ? "Detecting…" : "Detect my location"}
            </Button>
          </div>
        )}

        {status.kind === "error" && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {status.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
