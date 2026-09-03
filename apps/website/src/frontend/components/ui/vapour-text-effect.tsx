"use client";

import React, { useRef, useEffect, useState, createElement, useMemo, useCallback, memo } from "react";
import { renderParticles, type Particle } from "@/frontend/lib/particle-render";
import { nextSize } from "@/frontend/lib/stable-updates";
import { effectiveDpr, isAnimating, type CycleState } from "@/frontend/lib/vapour-cycle";

// Adapted from the 21st.dev "vaporize text" effect. Trimmed the black-screen demo,
// added an `onTextChange` callback (so a parent can sync sibling content — e.g. a
// label — to the currently shown text), and tidied types/lint for this codebase.

export enum Tag {
  H1 = "h1",
  H2 = "h2",
  H3 = "h3",
  P = "p",
}

type VaporizeTextCycleProps = {
  texts: string[];
  font?: {
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: number;
  };
  color?: string;
  spread?: number;
  density?: number;
  animation?: {
    vaporizeDuration?: number;
    fadeInDuration?: number;
    waitDuration?: number;
  };
  direction?: "left-to-right" | "right-to-left";
  alignment?: "left" | "center" | "right";
  tag?: Tag;
  /** Fires with the index of `texts` whenever the shown text changes (incl. mount). */
  onTextChange?: (index: number) => void;
};


type TextBoundaries = {
  left: number;
  right: number;
  width: number;
};

declare global {
  interface HTMLCanvasElement {
    textBoundaries?: TextBoundaries;
  }
}

export default function VaporizeTextCycle({
  texts = ["Next.js", "React"],
  font = {
    fontFamily: "sans-serif",
    fontSize: "50px",
    fontWeight: 400,
  },
  color = "rgb(255, 255, 255)",
  spread = 5,
  density = 5,
  animation = {
    vaporizeDuration: 2,
    fadeInDuration: 1,
    waitDuration: 0.5,
  },
  direction = "left-to-right",
  alignment = "center",
  tag = Tag.P,
  onTextChange,
}: VaporizeTextCycleProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isInView = useIsInView(wrapperRef as React.RefObject<HTMLElement>);
  const lastFontRef = useRef<string | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [animationState, setAnimationState] = useState<CycleState>("static");
  /*
   * Mirror of animationState for the rebuild effect below, which must know
   * whether the loop is running WITHOUT re-running (and re-sampling the whole
   * canvas) on every state transition.
   */
  const animationStateRef = useRef<CycleState>("static");
  /*
   * The waiting→vaporizing timer. The upstream component discarded the id, so
   * six 3.4 s timers outlived an unmount or a scroll away, and under load the
   * final fade-in frame could run twice and schedule it twice.
   */
  const waitTimerRef = useRef<number | null>(null);
  /*
   * Bumped whenever a rebuild actually produced particles. The frame loop stops
   * dead when there is nothing to draw, so it needs an explicit signal to start
   * again rather than a poll.
   */
  const [particlesVersion, setParticlesVersion] = useState(0);
  const vaporizeProgressRef = useRef(0);
  const fadeOpacityRef = useRef(0);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const transformedDensity = transformValue(density, [0, 10], [0.3, 1], true);

  useEffect(() => {
    animationStateRef.current = animationState;
  }, [animationState]);

  // Notify parent whenever the visible text changes (fires on mount with 0 too).
  useEffect(() => {
    onTextChange?.(currentTextIndex);
  }, [currentTextIndex, onTextChange]);

  // Canvas backing scale — capped; see lib/vapour-cycle for the arithmetic.
  const globalDpr = useMemo(
    () => effectiveDpr(typeof window !== "undefined" ? window.devicePixelRatio : 1),
    []
  );

  // Memoize static styles
  const wrapperStyle = useMemo(() => ({
    width: "100%",
    height: "100%",
    pointerEvents: "none" as const,
  }), []);

  const canvasStyle = useMemo(() => ({
    minWidth: "30px",
    minHeight: "20px",
    pointerEvents: "none" as const,
  }), []);

  // Memoize animation durations
  const animationDurations = useMemo(() => ({
    VAPORIZE_DURATION: (animation.vaporizeDuration ?? 2) * 1000,
    FADE_IN_DURATION: (animation.fadeInDuration ?? 1) * 1000,
    WAIT_DURATION: (animation.waitDuration ?? 0.5) * 1000,
  }), [animation.vaporizeDuration, animation.fadeInDuration, animation.waitDuration]);

  // Memoize font and spread calculations
  const fontConfig = useMemo(() => {
    const fontSize = parseInt(font.fontSize?.replace("px", "") || "50");
    const VAPORIZE_SPREAD = calculateVaporizeSpread(fontSize);
    const MULTIPLIED_VAPORIZE_SPREAD = VAPORIZE_SPREAD * spread;
    return {
      fontSize,
      VAPORIZE_SPREAD,
      MULTIPLIED_VAPORIZE_SPREAD,
      font: `${font.fontWeight ?? 400} ${fontSize * globalDpr}px ${font.fontFamily}`,
    };
  }, [font.fontSize, font.fontWeight, font.fontFamily, spread, globalDpr]);

  // Memoize particle update function
  const memoizedUpdateParticles = useCallback((particles: Particle[], vaporizeX: number, deltaTime: number) => {
    return updateParticles(
      particles,
      vaporizeX,
      deltaTime,
      fontConfig.MULTIPLIED_VAPORIZE_SPREAD,
      animationDurations.VAPORIZE_DURATION,
      direction,
      transformedDensity
    );
  }, [fontConfig.MULTIPLIED_VAPORIZE_SPREAD, animationDurations.VAPORIZE_DURATION, direction, transformedDensity]);

  // Memoize render function
  const memoizedRenderParticles = useCallback((ctx: CanvasRenderingContext2D, particles: Particle[]) => {
    renderParticles(ctx, particles, globalDpr);
  }, [globalDpr]);

  // One settled frame: what the loop would draw when nothing is moving.
  const paintOnce = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    memoizedRenderParticles(ctx, particlesRef.current);
  }, [memoizedRenderParticles]);

  // Start animation cycle when in view
  useEffect(() => {
    if (isInView) {
      const startAnimationTimeout = setTimeout(() => {
        setAnimationState("vaporizing");
      }, 0);
      return () => clearTimeout(startAnimationTimeout);
    } else {
      // Out of view: stop. The loop effect below refuses to run while
      // !isInView, so there is no frame to cancel — but a pending wait timer
      // would still flip the state on a canvas nobody can see. Do its reset now
      // so re-entry starts a clean cycle (what the timer would have produced),
      // and drop the timer.
      setAnimationState("static");
      if (waitTimerRef.current !== null) {
        window.clearTimeout(waitTimerRef.current);
        waitTimerRef.current = null;
        vaporizeProgressRef.current = 0;
        resetParticles(particlesRef.current);
      }
    }
  }, [isInView]);

  // And never let one outlive the component: client-side navigation away from
  // "/" lands inside the 3.4 s window more often than not.
  useEffect(
    () => () => {
      if (waitTimerRef.current !== null) window.clearTimeout(waitTimerRef.current);
    },
    []
  );

  // Animation loop - only run when in view, and only while something moves
  useEffect(() => {
    if (!isInView) return;

    /*
     * Nothing moves in `static` or `waiting`, which is most of every cycle
     * (3.4 s of 5.4 s). The loop used to run through both regardless, clearing
     * and redrawing every particle on all six hero canvases sixty times a
     * second. The renderer's "one fillStyle per idle frame" assumption was
     * false — every antialiased glyph edge carries its own alpha — so that was
     * roughly 26,000 canvas operations a frame at DPR 2, for a picture that
     * never changed. Paint the settled text once and schedule no frame; the
     * wait timer (or the in-view effect) flips the state and this effect
     * restarts.
     */
    if (!isAnimating(animationState)) {
      paintOnce();
      return;
    }

    let lastTime = performance.now();
    let frameId: number;

    const animate = (currentTime: number) => {
      /*
       * Do no work at all in a background tab.
       *
       * Chrome throttles rAF when a tab is hidden but does not stop it, and one
       * throttled frame of this still costs a full pass over every particle.
       * Resetting lastTime keeps deltaTime honest, so the animation resumes
       * where it left off instead of jumping on return.
       */
      if (typeof document !== "undefined" && document.hidden) {
        lastTime = currentTime;
        frameId = requestAnimationFrame(animate);
        return;
      }
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");

      /*
       * Nothing to draw: STOP, do not reschedule.
       *
       * This used to request another frame, which made it an unbounded loop —
       * nothing on this path advances the vaporize progress, decays an opacity
       * or changes state, so the exit condition could never be reached from
       * inside it. It spun at 60 fps forever, producing no pixels. It is
       * reachable whenever the state is "vaporizing" while the particle array
       * is empty, which is what a zero-measured wrapper produces: renderCanvas
       * returns early without assigning particles, while the intersection
       * observer still reports a zero-area element as in view.
       *
       * particlesVersion below is the restart signal: the rebuild effect bumps
       * it whenever sampling actually produced particles, which re-runs this
       * effect and starts a fresh chain.
       */
      if (!canvas || !ctx || !particlesRef.current.length) return;

      // Clear canvas only if we're going to draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update based on animation state (only the moving states reach here)
      switch (animationState) {
        case "vaporizing": {
          // Calculate progress based on duration
          vaporizeProgressRef.current += deltaTime * 100 / (animationDurations.VAPORIZE_DURATION / 1000);

          // Get text boundaries
          const textBoundaries = canvas.textBoundaries;
          if (!textBoundaries) break;

          // Calculate vaporize position based on text boundaries and direction
          const progress = Math.min(100, vaporizeProgressRef.current);
          const vaporizeX = direction === "left-to-right"
            ? textBoundaries.left + textBoundaries.width * progress / 100
            : textBoundaries.right - textBoundaries.width * progress / 100;

          const allVaporized = memoizedUpdateParticles(particlesRef.current, vaporizeX, deltaTime);
          memoizedRenderParticles(ctx, particlesRef.current);

          // Check if vaporization is complete
          if (vaporizeProgressRef.current >= 100 && allVaporized) {
            setCurrentTextIndex(prevIndex => (prevIndex + 1) % texts.length);
            setAnimationState("fadingIn");
            fadeOpacityRef.current = 0;
          }
          break;
        }
        case "fadingIn": {
          fadeOpacityRef.current += deltaTime * 1000 / animationDurations.FADE_IN_DURATION;

          // Fade-in carried its own copy of the same per-particle regex and
          // fillStyle churn. Set the opacity on the particles and hand them to
          // the shared renderer, which batches by colour and merges opaque runs
          // — identical pixels, one code path.
          {
            const fade = Math.min(fadeOpacityRef.current, 1);
            for (const particle of particlesRef.current) {
              particle.x = particle.originalX;
              particle.y = particle.originalY;
              particle.opacity = fade * particle.originalAlpha;
            }
            memoizedRenderParticles(ctx, particlesRef.current);
          }

          if (fadeOpacityRef.current >= 1) {
            setAnimationState("waiting");
            // Guarded: this frame can run once more before React commits
            // "waiting" and swaps the closure, and two timers meant two resets
            // a frame apart, the second landing mid-dissolve.
            if (waitTimerRef.current === null) {
              waitTimerRef.current = window.setTimeout(() => {
                waitTimerRef.current = null;
                vaporizeProgressRef.current = 0;
                resetParticles(particlesRef.current);
                setAnimationState("vaporizing");
              }, animationDurations.WAIT_DURATION);
            }
          }
          break;
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    animationState,
    isInView,
    texts.length,
    direction,
    globalDpr,
    memoizedUpdateParticles,
    memoizedRenderParticles,
    paintOnce,
    particlesVersion,
    animationDurations.FADE_IN_DURATION,
    animationDurations.WAIT_DURATION,
    animationDurations.VAPORIZE_DURATION,
  ]);

  useEffect(() => {
    renderCanvas({
      framerProps: { texts, font, color, alignment },
      canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
      wrapperSize,
      particlesRef,
      globalDpr,
      currentTextIndex,
      transformedDensity,
    });
    // Sampling leaves the canvas blank. While the loop runs, its next frame
    // paints; in the idle states there is no next frame, so paint here — this
    // is what keeps a theme switch or a resize visible mid-wait.
    if (!isAnimating(animationStateRef.current)) paintOnce();
    // Tell the frame loop there is something to draw now. Identity-guarded so a
    // rebuild that produced nothing cannot spin the effect.
    if (particlesRef.current.length) setParticlesVersion((n) => n + 1);

    const currentFont = font.fontFamily || "sans-serif";
    return handleFontChange({
      currentFont,
      lastFontRef,
      canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
      wrapperSize,
      particlesRef,
      globalDpr,
      currentTextIndex,
      transformedDensity,
      framerProps: { texts, font, color, alignment },
    });
  }, [texts, font, color, alignment, wrapperSize, currentTextIndex, globalDpr, transformedDensity, paintOnce]);

  // Handle resize
  useEffect(() => {
    const container = wrapperRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Preserve identity when the size has not really changed. This setter
        // feeds the effect that calls renderCanvas, and renderCanvas resizes a
        // child of the element this observer is watching — so an unconditional
        // new object here is a self-sustaining loop that rebuilds every particle
        // on every iteration. See lib/stable-updates.
        setWrapperSize((prev) => nextSize(prev, width, height));
      }
      // Nothing else. This callback used to call renderCanvas directly as well,
      // with the closure from the first render — so every notification
      // re-sampled the canvas synchronously and painted texts[0] over whatever
      // was showing, and a real size change rebuilt everything twice. The size
      // state above feeds the rebuild effect, which has the current props; that
      // is the one path.
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Initial size detection
  useEffect(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setWrapperSize((prev) => nextSize(prev, rect.width, rect.height));
    }
  }, []);

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
      <SeoElement tag={tag} texts={texts} />
    </div>
  );
}

// ------------------------------------------------------------ //
// SEO ELEMENT
// ------------------------------------------------------------ //
const SeoElement = memo(({ tag = Tag.P, texts }: { tag: Tag; texts: string[] }) => {
  const style = useMemo(() => ({
    position: "absolute" as const,
    width: "0",
    height: "0",
    overflow: "hidden",
    userSelect: "none" as const,
    pointerEvents: "none" as const,
  }), []);

  // Ensure tag is a valid HTML element string
  const safeTag = Object.values(Tag).includes(tag) ? tag : "p";

  return createElement(safeTag, { style }, texts?.join(" ") ?? "");
});
SeoElement.displayName = "SeoElement";

// ------------------------------------------------------------ //
// FONT HANDLING
// ------------------------------------------------------------ //
const handleFontChange = ({
  currentFont,
  lastFontRef,
  canvasRef,
  wrapperSize,
  particlesRef,
  globalDpr,
  currentTextIndex,
  transformedDensity,
  framerProps,
}: {
  currentFont: string;
  lastFontRef: React.MutableRefObject<string | null>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  wrapperSize: { width: number; height: number };
  particlesRef: React.MutableRefObject<Particle[]>;
  globalDpr: number;
  currentTextIndex: number;
  transformedDensity: number;
  framerProps: VaporizeTextCycleProps;
}) => {
  if (currentFont !== lastFontRef.current) {
    lastFontRef.current = currentFont;

    // Re-render after 1 second to catch the loaded font
    const timeoutId = setTimeout(() => {
      cleanup({ canvasRef, particlesRef }); // Clean up before re-rendering
      renderCanvas({
        framerProps,
        canvasRef,
        wrapperSize,
        particlesRef,
        globalDpr,
        currentTextIndex,
        transformedDensity,
      });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      cleanup({ canvasRef, particlesRef });
    };
  }

  return undefined;
};

// ------------------------------------------------------------ //
// CLEANUP
// ------------------------------------------------------------ //
const cleanup = ({ canvasRef, particlesRef }: { canvasRef: React.RefObject<HTMLCanvasElement>; particlesRef: React.MutableRefObject<Particle[]> }) => {
  // Clear canvas
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext("2d");

  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Clear particles
  if (particlesRef.current) {
    particlesRef.current = [];
  }
};

// ------------------------------------------------------------ //
// RENDER CANVAS
// ------------------------------------------------------------ //
const renderCanvas = ({
  framerProps,
  canvasRef,
  wrapperSize,
  particlesRef,
  globalDpr,
  currentTextIndex,
}: {
  framerProps: VaporizeTextCycleProps;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  wrapperSize: { width: number; height: number };
  particlesRef: React.MutableRefObject<Particle[]>;
  globalDpr: number;
  currentTextIndex: number;
  transformedDensity: number;
}) => {
  const canvas = canvasRef.current;
  if (!canvas || !wrapperSize.width || !wrapperSize.height) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = wrapperSize;

  // Scale for retina/high DPI displays
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * globalDpr);
  canvas.height = Math.floor(height * globalDpr);

  // Parse font size
  const fontSize = parseInt(framerProps.font?.fontSize?.replace("px", "") || "50");
  const font = `${framerProps.font?.fontWeight ?? 400} ${fontSize * globalDpr}px ${framerProps.font?.fontFamily ?? "sans-serif"}`;
  const color = parseColor(framerProps.color ?? "rgb(153, 153, 153)");

  // Calculate text position
  let textX;
  const textY = canvas.height / 2;
  const currentText = framerProps.texts[currentTextIndex] || "Next.js";

  if (framerProps.alignment === "center") {
    textX = canvas.width / 2;
  } else if (framerProps.alignment === "left") {
    textX = 0;
  } else {
    textX = canvas.width;
  }

  // Create particles from the rendered text and get text boundaries
  const { particles, textBoundaries } = createParticles(ctx, canvas, currentText, textX, textY, font, color, framerProps.alignment || "left");

  // Store particles and text boundaries for animation
  particlesRef.current = particles;
  canvas.textBoundaries = textBoundaries;
};

// ------------------------------------------------------------ //
// PARTICLE SYSTEM
// ------------------------------------------------------------ //
const createParticles = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  textX: number,
  textY: number,
  font: string,
  color: string,
  alignment: "left" | "center" | "right"
) => {
  const particles: Particle[] = [];

  // Clear any previous content
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set text properties for sampling
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = alignment;
  ctx.textBaseline = "middle";
  ctx.imageSmoothingQuality = "high";
  ctx.imageSmoothingEnabled = true;

  const extCtx = ctx as CanvasRenderingContext2D & { fontKerning?: CanvasFontKerning; textRendering?: string };
  if ("fontKerning" in extCtx) extCtx.fontKerning = "normal";
  if ("textRendering" in extCtx) extCtx.textRendering = "geometricPrecision";

  // Calculate text boundaries
  const metrics = ctx.measureText(text);
  let textLeft;
  const textWidth = metrics.width;

  if (alignment === "center") {
    textLeft = textX - textWidth / 2;
  } else if (alignment === "left") {
    textLeft = textX;
  } else {
    textLeft = textX - textWidth;
  }

  const textBoundaries = {
    left: textLeft,
    right: textLeft + textWidth,
    width: textWidth,
  };

  // Render the text for sampling
  ctx.fillText(text, textX, textY);

  // Sample the rendered text
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Every pixel, deliberately. The upstream component thinned the sample at
  // high DPR, which left visible gaps in the reformed text; this codebase kept
  // full per-pixel alpha instead (below), and the thinning then never applied
  // at any real DPR anyway. The particle count is bounded by the backing scale
  // — see effectiveDpr — not by skipping pixels.
  const sampleRate = 1;

  // Sample the text pixels and create particles
  for (let y = 0; y < canvas.height; y += sampleRate) {
    for (let x = 0; x < canvas.width; x += sampleRate) {
      const index = (y * canvas.width + x) * 4;
      const alpha = data[index + 3];

      if (alpha > 0) {
        // Full per-pixel opacity (anti-aliased edges preserved via `alpha/255`),
        // so the reformed text is crisp and solid — matching the static fallback.
        // The original DPR-based reduction washed the text out to a faded grey.
        const originalAlpha = alpha / 255;
        const rgbPrefix = `rgba(${data[index]}, ${data[index + 1]}, ${data[index + 2]}, `;
        const particle: Particle = {
          x,
          y,
          originalX: x,
          originalY: y,
          color: `${rgbPrefix}${originalAlpha})`,
          rgbPrefix,
          opacity: originalAlpha,
          originalAlpha,
          velocityX: 0,
          velocityY: 0,
          angle: 0,
          speed: 0,
        };

        particles.push(particle);
      }
    }
  }

  // Clear the canvas after sampling
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return { particles, textBoundaries };
};

// Helper functions for particle animation
const updateParticles = (
  particles: Particle[],
  vaporizeX: number,
  deltaTime: number,
  MULTIPLIED_VAPORIZE_SPREAD: number,
  VAPORIZE_DURATION: number,
  direction: string,
  density: number
) => {
  let allParticlesVaporized = true;

  particles.forEach(particle => {
    const shouldVaporize = direction === "left-to-right"
      ? particle.originalX <= vaporizeX
      : particle.originalX >= vaporizeX;

    if (shouldVaporize) {
      if (particle.speed === 0) {
        particle.angle = Math.random() * Math.PI * 2;
        particle.speed = (Math.random() * 1 + 0.5) * MULTIPLIED_VAPORIZE_SPREAD;
        particle.velocityX = Math.cos(particle.angle) * particle.speed;
        particle.velocityY = Math.sin(particle.angle) * particle.speed;
        particle.shouldFadeQuickly = Math.random() > density;
      }

      if (particle.shouldFadeQuickly) {
        particle.opacity = Math.max(0, particle.opacity - deltaTime);
      } else {
        const dx = particle.originalX - particle.x;
        const dy = particle.originalY - particle.y;
        const distanceFromOrigin = Math.sqrt(dx * dx + dy * dy);

        const dampingFactor = Math.max(0.95, 1 - distanceFromOrigin / (100 * MULTIPLIED_VAPORIZE_SPREAD));

        const randomSpread = MULTIPLIED_VAPORIZE_SPREAD * 3;
        const spreadX = (Math.random() - 0.5) * randomSpread;
        const spreadY = (Math.random() - 0.5) * randomSpread;

        particle.velocityX = (particle.velocityX + spreadX + dx * 0.002) * dampingFactor;
        particle.velocityY = (particle.velocityY + spreadY + dy * 0.002) * dampingFactor;

        const maxVelocity = MULTIPLIED_VAPORIZE_SPREAD * 2;
        const currentVelocity = Math.sqrt(particle.velocityX * particle.velocityX + particle.velocityY * particle.velocityY);

        if (currentVelocity > maxVelocity) {
          const scale = maxVelocity / currentVelocity;
          particle.velocityX *= scale;
          particle.velocityY *= scale;
        }

        particle.x += particle.velocityX * deltaTime * 20;
        particle.y += particle.velocityY * deltaTime * 10;

        // Higher base rate → dispersing particles fade out quickly instead of
        // lingering as a wide, unreadable "dust cloud", so the dissolve reads smooth.
        const baseFadeRate = 0.6;
        const durationBasedFadeRate = baseFadeRate * (2000 / VAPORIZE_DURATION);

        particle.opacity = Math.max(0, particle.opacity - deltaTime * durationBasedFadeRate);
      }

      if (particle.opacity > 0.01) {
        allParticlesVaporized = false;
      }
    } else {
      allParticlesVaporized = false;
    }
  });

  return allParticlesVaporized;
};


const resetParticles = (particles: Particle[]) => {
  particles.forEach(particle => {
    particle.x = particle.originalX;
    particle.y = particle.originalY;
    particle.opacity = particle.originalAlpha;
    particle.speed = 0;
    particle.velocityX = 0;
    particle.velocityY = 0;
  });
};

// ------------------------------------------------------------ //
// CALCULATE VAPORIZE SPREAD
// ------------------------------------------------------------ //
const calculateVaporizeSpread = (fontSize: number) => {
  const size = typeof fontSize === "string" ? parseInt(fontSize) : fontSize;

  const points = [
    { size: 20, spread: 0.2 },
    { size: 50, spread: 0.5 },
    { size: 100, spread: 1.5 },
  ];

  if (size <= points[0].size) return points[0].spread;
  if (size >= points[points.length - 1].size) return points[points.length - 1].spread;

  let i = 0;
  while (i < points.length - 1 && points[i + 1].size < size) i++;

  const p1 = points[i];
  const p2 = points[i + 1];

  return p1.spread + (size - p1.size) * (p2.spread - p1.spread) / (p2.size - p1.size);
};

// ------------------------------------------------------------ //
// PARSE COLOR
// ------------------------------------------------------------ //
/**
 * Extracts RGB/RGBA values from a color string format.
 * @param color - Color string (e.g. "rgb(12, 250, 163)")
 * @returns Valid RGBA color string
 */
const parseColor = (color: string) => {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);

  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } else if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }

  console.warn("Could not parse color:", color);
  return "rgba(0, 0, 0, 1)";
};

/**
 * Maps a value from one range to another, optionally clamping the result.
 */
function transformValue(input: number, inputRange: number[], outputRange: number[], clamp = false): number {
  const [inputMin, inputMax] = inputRange;
  const [outputMin, outputMax] = outputRange;

  const progress = (input - inputMin) / (inputMax - inputMin);
  let result = outputMin + progress * (outputMax - outputMin);

  if (clamp) {
    if (outputMax > outputMin) {
      result = Math.min(Math.max(result, outputMin), outputMax);
    } else {
      result = Math.min(Math.max(result, outputMax), outputMin);
    }
  }

  return result;
}

/**
 * Custom hook to check if an element is in the viewport.
 */
function useIsInView(ref: React.RefObject<HTMLElement>) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "50px" }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return isInView;
}
