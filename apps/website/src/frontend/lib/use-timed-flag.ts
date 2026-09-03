"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A boolean that turns itself off again — "Added to cart", "Copied".
 *
 * WHAT THIS REPLACES. Four components did the same thing by hand:
 *
 *     setCopied(true);
 *     setTimeout(() => setCopied(false), 1500);
 *
 * discarding the timer id. Two consequences, both real:
 *
 *  1. The timers accumulate and fight each other. Click "Add to cart" at t=0
 *     and again at t=1.4 s: the first timer fires at t=1.5 s and clears the
 *     confirmation 0.1 s after the second click, so the second click appears
 *     not to have worked. The confirmation should last its full duration from
 *     the LAST action, which is what restarting the timer gives.
 *  2. The callback outlives the component. Navigating away inside the window
 *     leaves a timer holding a setState on an unmounted tree. React 19 ignores
 *     it rather than warning, so it is invisible rather than harmless-by-design.
 *
 * Both go away by owning the handle: clear before re-arming, and clear on
 * unmount.
 */
export function useTimedFlag(durationMs: number): readonly [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const trigger = useCallback(() => {
    clear();
    setOn(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setOn(false);
    }, durationMs);
  }, [clear, durationMs]);

  return [on, trigger] as const;
}
