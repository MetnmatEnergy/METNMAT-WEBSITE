"use client";

import * as React from "react";
import { FOCUSABLE_SELECTOR, wrapTabTarget } from "@/frontend/lib/focus-trap";

/**
 * The behaviour every modal overlay on the site owes a keyboard user.
 *
 * Three overlays each hand-rolled a subset of this and each missed something
 * different: the quote drawer had no tab trap, the quote modal never gave focus
 * back to its trigger, the mobile filter drawer declared `aria-modal` while
 * doing no focus management at all. One implementation is the only way they stop
 * drifting apart.
 *
 * Handles, while `open`:
 *   - moving focus into the dialog
 *   - keeping Tab and Shift+Tab inside it
 *   - Escape to close
 *   - locking body scroll
 *   - returning focus to whatever opened it
 *
 * It deliberately does NOT own the backdrop click, the markup, or the
 * transition — those differ per overlay and are the caller's business.
 */
export function useDialog({
  open,
  onClose,
  containerRef,
}: {
  open: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
}): void {
  // What had focus when the dialog opened, so closing can hand it back.
  const triggerRef = React.useRef<HTMLElement | null>(null);
  // Read inside listeners so a caller passing an inline arrow does not
  // re-register them on every render.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // ── Focus in, and back out again ──────────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      // Captured BEFORE we move focus, or we would record the dialog itself.
      triggerRef.current = document.activeElement as HTMLElement | null;
      containerRef.current?.focus();
      return;
    }
    const trigger = triggerRef.current;
    triggerRef.current = null;
    // Only if it is still in the document — the trigger can unmount while the
    // dialog is open (navigating away, a re-render dropping a product card).
    if (trigger && document.contains(trigger)) trigger.focus();
  }, [open, containerRef]);

  // ── Escape, tab trap, scroll lock ─────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const root = containerRef.current;
      if (!root) return;

      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        // offsetParent is null for anything display:none or inside it. A
        // `position: fixed` element also reports null, so check the box too —
        // this dialog is itself fixed.
        (el) =>
          !el.hasAttribute("inert") &&
          el.getAttribute("aria-hidden") !== "true" &&
          (el.offsetParent !== null || el.getClientRects().length > 0)
      );

      const active = document.activeElement as HTMLElement | null;
      const target = wrapTabTarget(items, active && root.contains(active) ? active : null, e.shiftKey);

      if (items.length === 0) {
        // Nothing to tab to — keep focus on the dialog rather than letting it
        // fall through to the page behind.
        e.preventDefault();
        root.focus();
        return;
      }
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, containerRef]);
}
