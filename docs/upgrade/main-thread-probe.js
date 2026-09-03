/**
 * Main-thread probe for https://www.metnmat.com
 * ---------------------------------------------
 * Paste the whole file into the Chrome DevTools console on the page you want to
 * measure, then use the page normally. It prints a report every 10s and a final
 * summary when you call `__probe.stop()`.
 *
 * It exists because the "Page Unresponsive" freeze cannot be diagnosed from
 * build output or response times — the server was always fast. The question is
 * what the renderer is doing between frames, and these are the numbers that
 * answer it.
 *
 * Everything here is passive: it wraps and forwards, it never blocks, and it
 * changes no behaviour. Reload the page to remove it.
 *
 * WHAT TO LOOK FOR
 *
 *   rafPerSec        Callbacks per second across ALL loops. One animation is
 *                    ~60. Six canvases plus a shader is ~420. A number that
 *                    climbs without bound means loops are being created and
 *                    never cancelled.
 *   activeLoops      Distinct rAF callers still scheduling. Should be stable.
 *                    Growth = a leak, usually an effect without cleanup.
 *   longTasks        Tasks over 50ms. Anything over 1000ms is a frozen frame;
 *                    a steady stream of them is the unresponsive state.
 *   blockingMs       Total Blocking Time: the part of every long task beyond
 *                    50ms. This is the number that correlates with the dialog.
 *   canvasOps        fillRect + fillStyle assignments per second, summed over
 *                    every 2D context. Tens of thousands per second is the
 *                    symptom of a per-pixel particle field being redrawn.
 *   resample         getImageData calls per second. This should be near ZERO
 *                    once text is on screen — it is the particle REBUILD, and a
 *                    non-zero steady rate means a ResizeObserver feedback loop.
 *   observerFires    ResizeObserver + MutationObserver callbacks per second.
 *                    Should settle to 0 on an idle page.
 *   longestTask      The worst single task seen. Over ~15s is what makes Chrome
 *                    offer to kill the page.
 */
(() => {
  if (window.__probe) {
    console.warn("[probe] already running — call __probe.stop() first");
    return;
  }

  const started = performance.now();
  const stats = {
    rafCalls: 0,
    fillRect: 0,
    fillStyleSets: 0,
    getImageData: 0,
    observerFires: 0,
    longTasks: 0,
    blockingMs: 0,
    longestTask: 0,
  };
  /** Distinct rAF callbacks still scheduling, keyed by their source location. */
  const loops = new Map();
  const restore = [];

  // ── requestAnimationFrame ─────────────────────────────────────────────────
  const rawRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    // The stack of the SCHEDULER identifies the loop; a self-rescheduling loop
    // keeps the same signature frame after frame.
    const site = (new Error().stack || "").split("\n")[2] || "unknown";
    return rawRaf((t) => {
      stats.rafCalls++;
      loops.set(site.trim(), (loops.get(site.trim()) || 0) + 1);
      return cb(t);
    });
  };
  restore.push(() => (window.requestAnimationFrame = rawRaf));

  // ── canvas work ───────────────────────────────────────────────────────────
  const proto = CanvasRenderingContext2D.prototype;
  const rawFillRect = proto.fillRect;
  proto.fillRect = function (...a) {
    stats.fillRect++;
    return rawFillRect.apply(this, a);
  };
  restore.push(() => (proto.fillRect = rawFillRect));

  const rawGetImageData = proto.getImageData;
  proto.getImageData = function (...a) {
    stats.getImageData++;
    return rawGetImageData.apply(this, a);
  };
  restore.push(() => (proto.getImageData = rawGetImageData));

  const fillStyleDesc = Object.getOwnPropertyDescriptor(proto, "fillStyle");
  if (fillStyleDesc && fillStyleDesc.set) {
    Object.defineProperty(proto, "fillStyle", {
      ...fillStyleDesc,
      set(v) {
        stats.fillStyleSets++;
        return fillStyleDesc.set.call(this, v);
      },
    });
    restore.push(() => Object.defineProperty(proto, "fillStyle", fillStyleDesc));
  }

  // ── observers ─────────────────────────────────────────────────────────────
  // A ResizeObserver feedback loop is the failure mode that does NOT show up as
  // one long task — it shows up as an endless stream of short ones.
  for (const name of ["ResizeObserver", "MutationObserver", "IntersectionObserver"]) {
    const Raw = window[name];
    if (!Raw) continue;
    window[name] = class extends Raw {
      constructor(cb, ...rest) {
        super((...args) => {
          stats.observerFires++;
          return cb(...args);
        }, ...rest);
      }
    };
    restore.push(() => (window[name] = Raw));
  }

  // ── long tasks ────────────────────────────────────────────────────────────
  let po = null;
  try {
    po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        stats.longTasks++;
        stats.blockingMs += Math.max(0, e.duration - 50);
        if (e.duration > stats.longestTask) stats.longestTask = e.duration;
      }
    });
    po.observe({ entryTypes: ["longtask"] });
  } catch {
    console.warn("[probe] longtask observer unavailable in this browser");
  }

  // ── reporting ─────────────────────────────────────────────────────────────
  let last = { ...stats };
  let lastAt = started;

  const report = (label) => {
    const now = performance.now();
    const secs = (now - lastAt) / 1000;
    const d = (k) => Math.round((stats[k] - last[k]) / secs);
    const row = {
      window: `${secs.toFixed(1)}s`,
      rafPerSec: d("rafCalls"),
      activeLoops: loops.size,
      canvasOpsPerSec: d("fillRect") + d("fillStyleSets"),
      resamplePerSec: d("getImageData"),
      observerFiresPerSec: d("observerFires"),
      longTasks: stats.longTasks - last.longTasks,
      blockingMs: Math.round(stats.blockingMs - last.blockingMs),
      longestTaskMs: Math.round(stats.longestTask),
    };
    console.table({ [label]: row });
    last = { ...stats };
    lastAt = now;
  };

  const timer = setInterval(() => report("last 10s"), 10_000);

  window.__probe = {
    stop() {
      clearInterval(timer);
      if (po) po.disconnect();
      restore.forEach((f) => f());
      const total = (performance.now() - started) / 1000;
      console.log(
        `%c[probe] TOTAL over ${total.toFixed(1)}s`,
        "font-weight:bold"
      );
      console.table({
        total: {
          rafPerSec: Math.round(stats.rafCalls / total),
          activeLoops: loops.size,
          canvasOpsPerSec: Math.round((stats.fillRect + stats.fillStyleSets) / total),
          resamplePerSec: Math.round(stats.getImageData / total),
          observerFiresPerSec: Math.round(stats.observerFires / total),
          longTasks: stats.longTasks,
          blockingMs: Math.round(stats.blockingMs),
          longestTaskMs: Math.round(stats.longestTask),
        },
      });
      console.log("[probe] busiest rAF loops:");
      console.table(
        [...loops.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([site, calls]) => ({ callsPerSec: Math.round(calls / total), site }))
      );
      delete window.__probe;
    },
    stats,
    loops,
  };

  console.log(
    "%c[probe] running. Use the page for 60s, then call __probe.stop()",
    "font-weight:bold;color:#d81f26"
  );
})();
