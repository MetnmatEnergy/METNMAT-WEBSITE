"use client";

import * as React from "react";
import { Trash2, Undo2 } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { cn } from "@/frontend/lib/utils";

/**
 * Global "item removed — Undo" toast. Appears bottom-center whenever a cart
 * item is removed (rail, drawer or cart page), auto-dismisses after 5s.
 * aria-live so screen readers announce it without stealing focus.
 */
export function CartToast() {
  const { lastRemoved, undoRemove, dismissRemoved } = useStore();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!lastRemoved) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      dismissRemoved();
    }, 5000);
    return () => clearTimeout(t);
  }, [lastRemoved, dismissRemoved]);

  if (!lastRemoved) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-3",
        "rounded-full border border-border bg-background/95 py-2 pl-4 pr-2 shadow-2xl backdrop-blur",
        "transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      )}
    >
      <Trash2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm">
        Removed <span className="font-medium">{lastRemoved.product.name}</span>
      </span>
      <button
        type="button"
        onClick={undoRemove}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
      >
        <Undo2 className="h-3.5 w-3.5" /> Undo
      </button>
    </div>
  );
}
