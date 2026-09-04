"use client";

import type { PropsWithChildren } from "react";
import React, { useEffect, useRef, useState } from "react";
import { shouldStartLoop } from "@/frontend/lib/loop-gate";

/**
 * Mouse-follow spotlight ("highlighter") + ambient particles. Adapted to the
 * METNMAT brand: the glow uses the brand red instead of lime. Self-contained
 * (no external deps). Wrap cards in <HighlightGroup> and each card in
 * <HighlighterItem> to get a brand glow that tracks the cursor across the group.
 */

interface MousePosition {
  x: number;
  y: number;
}

/**
 * Run a callback on pointer movement, at most once per animation frame.
 *
 * WHAT THIS REPLACES. The original wrote the cursor position into React state
 * on every `mousemove`. A mouse reports well above 60 Hz, and /contact mounts
 * three consumers of this hook, so a single sweep across the page produced
 * hundreds of state updates and re-rendered the particle canvas and both
 * highlight groups for each one — to compute values that are then written
 * straight to the DOM as CSS custom properties and never rendered by React at
 * all.
 *
 * A ref plus one rAF-coalesced listener does the same work with no re-render
 * and at most one call per frame. The listener is passive, so it can never
 * delay a scroll.
 */
function useMouseMove(onMove: (position: MousePosition) => void): void {
  const callback = useRef(onMove);
  useEffect(() => {
    callback.current = onMove;
  });

  useEffect(() => {
    let frame: number | null = null;
    const latest: MousePosition = { x: 0, y: 0 };
    const handleMouseMove = (event: MouseEvent) => {
      latest.x = event.clientX;
      latest.y = event.clientY;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        callback.current(latest);
      });
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
}

interface HighlightGroupProps {
  children: React.ReactNode;
  className?: string;
  refresh?: boolean;
}

export const HighlightGroup: React.FC<HighlightGroupProps> = ({
  children,
  className = "",
  refresh = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [boxes, setBoxes] = useState<HTMLElement[]>([]);

  useEffect(() => {
    if (containerRef.current) {
      setBoxes(Array.from(containerRef.current.children).map((el) => el as HTMLElement));
    }
  }, []);

  useEffect(() => {
    initContainer();
    window.addEventListener("resize", initContainer);
    return () => window.removeEventListener("resize", initContainer);
  }, [setBoxes]);

  useEffect(() => {
    initContainer();
  }, [refresh]);

  const initContainer = () => {
    if (containerRef.current) {
      containerSize.current.w = containerRef.current.offsetWidth;
      containerSize.current.h = containerRef.current.offsetHeight;
    }
  };

  const onMouseMove = (position: MousePosition) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { w, h } = containerSize.current;
    const x = position.x - rect.left;
    const y = position.y - rect.top;
    if (!(x < w && x > 0 && y < h && y > 0)) return;
    mouse.current.x = x;
    mouse.current.y = y;

    /*
     * Read every rectangle, THEN write every property.
     *
     * The original interleaved them — and took two separate
     * getBoundingClientRect() calls per box, one for left and one for top. Each
     * write invalidates layout, so the next read had to force a synchronous
     * recalculation: 2N forced layouts per pointer move. Batching makes it one
     * layout for the whole group, and halves the reads.
     */
    const offsets = boxes.map((box) => {
      const b = box.getBoundingClientRect();
      return { box, left: b.left - rect.left, top: b.top - rect.top };
    });
    for (const { box, left, top } of offsets) {
      box.style.setProperty("--mouse-x", `${x - left}px`);
      box.style.setProperty("--mouse-y", `${y - top}px`);
    }
  };

  useMouseMove(onMouseMove);

  return (
    <div className={className} ref={containerRef}>
      {children}
    </div>
  );
};

interface HighlighterItemProps {
  children: React.ReactNode;
  className?: string;
}

export const HighlighterItem: React.FC<PropsWithChildren<HighlighterItemProps>> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`relative overflow-hidden p-px before:pointer-events-none before:absolute before:-left-48 before:-top-48 before:z-30 before:h-96 before:w-96 before:translate-x-[var(--mouse-x)] before:translate-y-[var(--mouse-y)] before:rounded-full before:bg-brand before:opacity-0 before:blur-[100px] before:transition-opacity before:duration-500 after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-3xl after:opacity-0 after:transition-opacity after:duration-500 before:hover:opacity-20 after:group-hover:opacity-100 ${className}`}
    >
      {children}
    </div>
  );
};

interface ParticlesProps {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  refresh?: boolean;
  color?: string;
  vx?: number;
  vy?: number;
}

function hexToRgb(hex: string): number[] {
  hex = hex.replace("#", "");
  const hexInt = parseInt(hex, 16);
  const red = (hexInt >> 16) & 255;
  const green = (hexInt >> 8) & 255;
  const blue = hexInt & 255;
  return [red, green, blue];
}

export const Particles: React.FC<ParticlesProps> = ({
  className = "",
  quantity = 30,
  staticity = 50,
  ease = 50,
  refresh = false,
  color = "#d81f26",
  vx = 0,
  vy = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<Circle[]>([]);
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const rafId = useRef<number | undefined>(undefined);
  const running = useRef(false);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext("2d");
    }
    // Lays out the canvas and paints one frame of particles. That frame is also
    // the whole animation for someone who has asked for reduced motion.
    initCanvas();

    /*
     * The loop used to start on mount and run until unmount — 120 particles,
     * six canvas operations each, sixty times a second, whether or not the card
     * was on screen and whether or not the tab was in front. It now runs only
     * while the canvas is actually visible to someone.
     */
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let inView = false;

    const start = () => {
      if (!shouldStartLoop({ alreadyRunning: running.current, prefersReducedMotion: reduced, inView, pageHidden: document.hidden })) return;
      running.current = true;
      rafId.current = window.requestAnimationFrame(animate);
    };
    const stop = () => {
      running.current = false;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = undefined;
    };

    const io = new IntersectionObserver(
      (entries) => {
        inView = Boolean(entries[0]?.isIntersecting);
        if (inView) start();
        else stop();
      },
      { threshold: 0 }
    );
    if (canvasContainerRef.current) io.observe(canvasContainerRef.current);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", initCanvas);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", initCanvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const initCanvas = () => {
    resizeCanvas();
    drawParticles();
  };

  const onMouseMove = (position: MousePosition) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const { w, h } = canvasSize.current;
      const x = position.x - rect.left - w / 2;
      const y = position.y - rect.top - h / 2;
      const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2;
      if (inside) {
        mouse.current.x = x;
        mouse.current.y = y;
      }
    }
  };

  useMouseMove(onMouseMove);

  type Circle = {
    x: number;
    y: number;
    translateX: number;
    translateY: number;
    size: number;
    alpha: number;
    targetAlpha: number;
    dx: number;
    dy: number;
    magnetism: number;
  };

  const resizeCanvas = () => {
    if (canvasContainerRef.current && canvasRef.current && context.current) {
      circles.current.length = 0;
      canvasSize.current.w = canvasContainerRef.current.offsetWidth;
      canvasSize.current.h = canvasContainerRef.current.offsetHeight;
      canvasRef.current.width = canvasSize.current.w * dpr;
      canvasRef.current.height = canvasSize.current.h * dpr;
      canvasRef.current.style.width = `${canvasSize.current.w}px`;
      canvasRef.current.style.height = `${canvasSize.current.h}px`;
      context.current.scale(dpr, dpr);
    }
  };

  const circleParams = (): Circle => {
    const x = Math.floor(Math.random() * canvasSize.current.w);
    const y = Math.floor(Math.random() * canvasSize.current.h);
    const size = Math.floor(Math.random() * 2) + 1;
    const targetAlpha = parseFloat((Math.random() * 0.3 + 0.1).toFixed(1));
    const dx = (Math.random() - 0.5) * 0.2;
    const dy = (Math.random() - 0.5) * 0.2;
    const magnetism = 0.1 + Math.random() * 4;
    return { x, y, translateX: 0, translateY: 0, size, alpha: 0, targetAlpha, dx, dy, magnetism };
  };

  // "rgba(r, g, b, " built once. It used to be re-joined for every particle on
  // every frame — 120 string allocations a frame for a value that never changes.
  const rgbPrefix = React.useMemo(() => `rgba(${hexToRgb(color).join(", ")}, `, [color]);

  const drawCircle = (circle: Circle, update = false) => {
    if (context.current) {
      const { x, y, translateX, translateY, size, alpha } = circle;
      context.current.translate(translateX, translateY);
      context.current.beginPath();
      context.current.arc(x, y, size, 0, 2 * Math.PI);
      context.current.fillStyle = `${rgbPrefix}${alpha})`;
      context.current.fill();
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!update) {
        circles.current.push(circle);
      }
    }
  };

  const clearContext = () => {
    if (context.current) {
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
    }
  };

  const drawParticles = () => {
    clearContext();
    for (let i = 0; i < quantity; i++) {
      drawCircle(circleParams());
    }
  };

  const remapValue = (
    value: number,
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): number => {
    const remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
    return remapped > 0 ? remapped : 0;
  };

  const animate = () => {
    clearContext();
    circles.current.forEach((circle: Circle, i: number) => {
      const edge = [
        circle.x + circle.translateX - circle.size,
        canvasSize.current.w - circle.x - circle.translateX - circle.size,
        circle.y + circle.translateY - circle.size,
        canvasSize.current.h - circle.y - circle.translateY - circle.size,
      ];
      const closestEdge = edge.reduce((a, b) => Math.min(a, b));
      const remapClosestEdge = parseFloat(remapValue(closestEdge, 0, 20, 0, 1).toFixed(2));
      if (remapClosestEdge > 1) {
        circle.alpha += 0.02;
        if (circle.alpha > circle.targetAlpha) circle.alpha = circle.targetAlpha;
      } else {
        circle.alpha = circle.targetAlpha * remapClosestEdge;
      }
      circle.x += circle.dx + vx;
      circle.y += circle.dy + vy;
      circle.translateX +=
        (mouse.current.x / (staticity / circle.magnetism) - circle.translateX) / ease;
      circle.translateY +=
        (mouse.current.y / (staticity / circle.magnetism) - circle.translateY) / ease;
      if (
        circle.x < -circle.size ||
        circle.x > canvasSize.current.w + circle.size ||
        circle.y < -circle.size ||
        circle.y > canvasSize.current.h + circle.size
      ) {
        circles.current.splice(i, 1);
        drawCircle(circleParams());
      } else {
        drawCircle({ ...circle }, true);
      }
    });
    // A stop() during this frame must end the chain, not be overwritten by it.
    if (!running.current) return;
    rafId.current = window.requestAnimationFrame(animate);
  };

  return (
    <div className={className} ref={canvasContainerRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
};
