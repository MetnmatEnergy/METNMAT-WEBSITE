"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { shouldStartLoop } from "@/frontend/lib/loop-gate";

/**
 * Full-bleed animated plasma/aurora background (WebGL via three.js), recolored to
 * the METNMAT brand red/dark palette. Fills its parent (give the parent
 * position:relative), pauses when offscreen or the tab is hidden, and renders a
 * single static frame for prefers-reduced-motion. Place behind a scrim for text
 * legibility. Decorative only (aria-hidden).
 */
export function AnimatedShaderBackground({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // No WebGL — the parent's CSS fallback background shows instead.
    }

    const sizeOf = () => ({
      w: container.clientWidth || 1,
      h: container.clientHeight || 1,
    });
    let { w, h } = sizeOf();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h);
    Object.assign(renderer.domElement.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });
    container.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(w, h) },
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;

        #define NUM_OCTAVES 3

        float rand(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);
          float res = mix(
            mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
            mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
          return res * res;
        }

        float fbm(vec2 x) {
          float v = 0.0;
          float a = 0.3;
          vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.4;
          }
          return v;
        }

        void main() {
          vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
          vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
          vec2 v;
          vec4 o = vec4(0.0);

          float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

          for (float i = 0.0; i < 35.0; i++) {
            v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
            float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));
            // METNMAT brand: deep crimson / ember reds (was teal/blue aurora).
            vec4 brandColors = vec4(
              0.65 + 0.35 * sin(i * 0.2 + iTime * 0.4),
              0.05 + 0.10 * cos(i * 0.3 + iTime * 0.5),
              0.10 + 0.12 * sin(i * 0.4 + iTime * 0.3),
              1.0
            );
            vec4 currentContribution = brandColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
            float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
            o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
          }

          o = tanh(pow(o / 100.0, vec4(1.6)));
          gl_FragColor = o * 1.35;
        }
      `,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId = 0;
    let running = false;
    let lastTime = 0;
    /*
     * Both conditions must hold for the loop to run. The visibilitychange
     * handler used to call start() on its own, so returning to the tab restarted
     * a full-viewport fragment shader even when the hero was scrolled far off
     * screen — the IntersectionObserver had stopped it, and coming back undid
     * that without consulting it.
     */
    let inView = false;
    const renderOnce = () => renderer.render(scene, camera);

    const loop = (now: number) => {
      // Wall clock, not a fixed 0.016 per frame. Frame-counting ran the
      // animation at double speed on a 120 Hz display and skipped ahead by the
      // whole pause after the loop had been stopped.
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
      lastTime = now;
      material.uniforms.iTime.value += delta;
      renderOnce();
      frameId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!shouldStartLoop({ alreadyRunning: running, prefersReducedMotion: prefersReduced, inView, pageHidden: document.hidden })) return;
      running = true;
      lastTime = 0; // resume where it left off rather than jumping
      frameId = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    };

    // One frame now, so the hero is never an empty box. This is also the single
    // static frame for prefers-reduced-motion. The loop itself is started by the
    // IntersectionObserver below, once it confirms the element is on screen.
    renderOnce();

    const ro = new ResizeObserver(() => {
      const s = sizeOf();
      w = s.w;
      h = s.h;
      renderer.setSize(w, h);
      material.uniforms.iResolution.value.set(w, h);
      if (!running) renderOnce();
    });
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        inView = Boolean(entries[0]?.isIntersecting);
        if (inView) start();
        else stop();
      },
      { threshold: 0 }
    );
    io.observe(container);

    // start() re-checks inView, so returning to the tab cannot resume a shader
    // whose element is off screen.
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      /*
       * dispose() frees three.js's own GPU objects but NOT the WebGL context.
       * A browser allows only a small number of live contexts (Chrome ~16) and
       * silently drops the oldest when that is exceeded — so repeatedly
       * navigating to /about and away could evict a context still in use
       * elsewhere, and the backgrounds would start failing to initialise.
       * forceContextLoss() is three's documented way to hand it back now rather
       * than whenever the renderer happens to be collected.
       */
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} aria-hidden className={className} />;
}

export default AnimatedShaderBackground;
