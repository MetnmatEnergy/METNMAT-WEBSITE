# Production freeze — baseline

Established 2026-09-03, before any change in this pass. Nothing was modified while this was gathered.

## Versions

| | |
|---|---|
| Branch | `main` |
| Local HEAD | `3d640b7` |
| `origin/main` | `3d640b7` (0 ahead, 0 behind) |
| Deployed release | `3d640b7` — deploy run 33747700533, `symlink swapped` 11:06:53, `health check OK` 11:07:15 |
| Rollback target | `0e5dc5a` (recorded by the deploy as `previous release`) |
| Working tree | clean |
| Stack | Next.js 15.1.6 · React 19.0.0 · App Router |

Local, origin and production are the same commit. Any finding below is a finding about what is live.

## The incident, and what has already been done about it

Chrome showed **Page Unresponsive** on the homepage from 2026-09-02.

**Proven cause** (`0e5dc5a`): a `MutationObserver` on `document.body` with `{subtree:true, attributes:true}`
whose callback wrote `aria-expanded` unconditionally. `setAttribute` queues a mutation record even when
the value is unchanged, the launcher was inside the observed subtree, and MutationObserver callbacks are
**microtasks** — a microtask loop never yields to paint, layout or input. Written during an accessibility
pass in `03c1d5f`.

**Two earlier fixes were real defects but not the incident**, and must not be re-chased as if they were:

| Commit | What it fixed | Why it was not the freeze |
|---|---|---|
| `ed19545` | per-particle regex + `fillStyle` churn in the canvas renderer | makes frames cheaper; cannot stop a microtask loop |
| `01bc7eb` | ResizeObserver → fresh-object state → resize feedback | runs in the rendering steps, so it yields a frame — it janks, it does not hang |

**Hardening since** (`3d640b7`): the hero vaporize effect stopped running its frame loop in the idle
states, capped the canvas backing scale at 2, removed a stale-closure `renderCanvas` from a
ResizeObserver callback, and moved the wait timer into a ref.

## Loop-primitive inventory (`apps/website/src`)

| Primitive | Files | Hits |
|---|---|---|
| `new MutationObserver` | 2 | 3 |
| `new ResizeObserver` | 3 | 3 |
| `new IntersectionObserver` | 6 | 6 |
| `requestAnimationFrame` | 5 | 10 |
| `setInterval` | 5 | 5 |
| `setTimeout` | 24 | 35 |
| `addEventListener` | 23 | 40 |
| `setAttribute` | 3 | 6 |
| `getComputedStyle` | 2 | 2 |
| `getBoundingClientRect` | 3 | 6 |
| `requestIdleCallback` | 0 | 0 |
| `PerformanceObserver` | 0 | 0 |

No WebGL/three.js usage was found by name in `src`, despite `three@0.169` being a dependency —
`animated-shader-background.tsx` is the file to check for reachability.

### Files carrying an observer

`blog/toc.tsx` · `chat/chat-widget.tsx` · `home/featured-projects-carousel.tsx` · `home/hero-stats.tsx` ·
`ui/animated-shader-background.tsx` · `ui/deferred-image.tsx` · `ui/radial-orbital-timeline.tsx` ·
`ui/vapour-text-effect.tsx`

### Files carrying a `requestAnimationFrame` loop

`ui/animated-shader-background.tsx` · `ui/highlighter.tsx` · `ui/progressive-flux-loader.tsx` ·
`ui/vapour-text-effect.tsx` · `lib/analytics/collector.ts`

### Files carrying a `setInterval`

`commerce/product-gallery.tsx` · `commerce/shop-showcase.tsx` · `home/hero-stats.tsx` ·
`ui/animated-text-cycle.tsx` · `ui/radial-orbital-timeline.tsx`

## Homepage component tree

`app/page.tsx` → Hero · TrustedBy · ServicesPreview · FeaturedProjectsCarousel · ProductsPreview ·
BlogTeaser · Faq · CtaBand · JsonLd.

`app/layout.tsx` mounts, around every route: CurrencyProvider · StoreProvider · QuoteProvider ·
RouteProgress · MaintenanceBanner · **ChatWidget** · ConsentBanner · AnalyticsProvider.

The hero mounts `HeroStats`, which mounts three `VaporSlot`s of two canvases each — **six canvases**,
all above the fold on a desktop viewport, all animating together.

## Suspected freeze vectors going in

1. **Chat widget observers** — the historical cause. Re-verify from current source, not from comments.
2. **Six concurrent canvas rAF loops** — the aggregate cost, not any one loop.
3. **ResizeObserver feedback** in `hero-stats.tsx` (`useDisplayStyle` reads `getComputedStyle` in an RO
   callback) and `vapour-text-effect.tsx`.
4. **Analytics consent re-registration** — a previous sweep reported listeners multiplying on re-grant.
5. **Timers surviving unmount** — 35 `setTimeout` sites, most unaudited.
6. **`radial-orbital-timeline.tsx`** — named as a risk; reachability unknown.
7. **`animated-shader-background.tsx`** — a shader render loop and WebGL context lifecycle.

## Tests already covering this ground

| File | Covers |
|---|---|
| `test/observer-guardrails.test.ts` | no unfiltered document-level attribute observer; identity-preserving RO state writes; the four `3d640b7` fixes, pinned structurally |
| `test/chat-widget-a11y.test.ts` | `planA11yWrites` returns an empty plan on a settled DOM; a faithful replay of the observer loop |
| `test/particle-render.test.ts` | canvas ops per frame; the antialiased-edge fixture that corrected a false comment |
| `test/vapour-cycle.test.ts` | the DPR cap arithmetic; which states run the loop |
| `test/stable-updates.test.ts` | `nextSize` / `nextDisplayStyle` identity preservation |
| `test/route-progress.test.ts` | navigation progress target resolution |

## Known risks carried in

- A code comment in this repo has been **wrong before** in a way tests did not catch: `particle-render.ts`
  claimed one `fillStyle` per idle frame; the real figure was roughly twelve thousand. Comments are not
  evidence.
- `docs/upgrade/AUDIT.md` is a dated snapshot (2026-07-31); read its status section before acting on a row.
- Browser automation had failed for the whole preceding session, so every prior claim was made from code
  and deterministic tests rather than from a running browser.
