# Main-thread safety audit

Every continuously-running mechanism reachable from a live route, classified. Produced
2026-09-03 by a 14-agent adversarial sweep whose findings were then verified by three
independent lenses each (reproduce / severity / fix-safety), and cross-checked against
runtime measurement on production in a real browser.

**161 distinct mechanisms. 0 are FREEZE_CAPABLE.**

| Classification | Count | Meaning |
|---|---:|---|
| FREEZE_CAPABLE | 0 | can hang the tab: unbounded, or a microtask/synchronous loop that never yields |
| NEEDS_FIX | 44 | a real lifecycle or correctness defect (leak, duplicate, work after unmount) |
| OPTIMIZED | 32 | correct and bounded, but carries meaningful steady-state cost |
| SAFE | 85 | correct and cheap |

A loop is **not** counted safe merely because it eventually yields. The distinction that
matters for this incident is between work that is *expensive* and work that *never returns
to the event loop* — only the second produces "Page Unresponsive".

## The one that froze the page

`components/chat/chat-widget.tsx` — a MutationObserver on `document.body` with
`{subtree: true, attributes: true}` whose callback wrote `aria-expanded` unconditionally.
`setAttribute` queues a mutation record even when the value is unchanged, the launcher sat
inside the observed subtree, and MutationObserver callbacks are microtasks. Fixed in
`0e5dc5a`; **measured on production at 1 observer callback for the whole page load, and 2
per chat panel toggle, constant across six toggles.**

Nothing else found in this audit shares that property.

## Runtime measurement (production, real browser)

Taken on `https://www.metnmat.com/` with the page visible and no user interaction:

| Metric | Idle 30 s | Notes |
|---|---:|---|
| Long tasks | 0 | nothing blocked the thread for 50 ms |
| Total blocking time | 0 ms | |
| MutationObserver callbacks | 0 | the incident's diagnostic number |
| Input lag, median | 24.3 ms | one to two frames |
| rAF callbacks per second | 109.5 | across six hero canvases, ~1.8 animating at any moment |

Per-second sampling over 18 s showed **4 seconds with exactly zero rAF callbacks and zero
canvas operations**, which is the idle-gate from `3d640b7` working: the vaporize loop stops
entirely between dissolves rather than redrawing a static picture 60 times a second.

The six hero canvases were also confirmed to run in lockstep — over 32 s each completed
exactly 5 vaporize cycles, drift 0 — so the number and its label cannot fall out of step.

## Classification table

| Class | File | Lines | Kind | Hidden | Offscreen | Unmount | Multiplies | Cost |
|---|---|---|---|---|---|---|---|---|
| NEEDS_FIX | `frontend/components/blog/toc.tsx` | 17-34 | IntersectionObserver | no | yes | no | yes | Exactly 2 observers x N headings per article page instead of 1 x N. For a 10-heading arti… |
| NEEDS_FIX | `frontend/components/chat/chat-widget.tsx` | 186-199 | MutationObserver | yes | yes | no | no | Zero steady-state — it fires only on a real childList change to the container, which the … |
| NEEDS_FIX | `frontend/components/chat/chat-widget.tsx` | 204-219 | MutationObserver | yes | yes | no | no | Happy path: the observer lives from script injection until the widget's DOM lands — a few… |
| NEEDS_FIX | `frontend/components/commerce/add-to-cart-button.tsx` | 45-51 | setTimeout | yes | yes | yes | yes | Negligible CPU. The cost is a visible correctness defect: click at t=0 and again at t=100… |
| NEEDS_FIX | `frontend/components/commerce/attachment-uploader.tsx` | 170-209 | setTimeout | yes | yes | yes | yes | Zero steady-state cost — it is a one-shot. The cost is correctness: in `next dev` (Strict… |
| NEEDS_FIX | `frontend/components/commerce/auth-card.tsx` | 119-127 | setTimeout | yes | yes | yes | yes | Negligible. One orphaned 1.5 s closure per copy click, plus a truncated tick on a second … |
| NEEDS_FIX | `frontend/components/commerce/product-buy-box.tsx` | 102-107 | setTimeout | yes | yes | yes | yes | Negligible CPU; same truncated-confirmation defect as add-to-cart-button — a second click… |
| NEEDS_FIX | `frontend/components/commerce/profile-form.tsx` | 92-101 | setTimeout | yes | yes | yes | yes | Negligible. Same truncated-tick and orphaned-closure profile as auth-card.tsx. |
| NEEDS_FIX | `frontend/components/home/hero-stats.tsx` | 46-49 | requestAnimationFrame | no | no | no | yes | No CPU cost. Measured drift ~0.08 s per ~6.2 s cycle between the number and label of one … |
| NEEDS_FIX | `frontend/components/layout/mobile-nav.tsx` | 83-90 | ReactEffect | no | no | yes | yes | Zero CPU — 0 ms of main-thread work, 0 listeners left behind. The cost is a stuck global … |
| NEEDS_FIX | `frontend/components/ui/animated-shader-background.tsx` | 167-171 | addEventListener | no | yes | no | no | The full steady-state cost of mechanism 1, incurred for zero visible benefit, for an unbo… |
| NEEDS_FIX | `frontend/components/ui/animated-shader-background.tsx` | 27-32, 173-184 | Other | no | no | yes | yes | One WebGL2 context plus one antialiased drawing buffer retained per unmounted /about visi… |
| NEEDS_FIX | `frontend/components/ui/animated-shader-background.tsx` | 126-177 | IntersectionObserver | no | yes | no | no | After one tab switch with the hero scrolled away, the page runs 60 rAF callbacks per seco… |
| NEEDS_FIX | `frontend/components/ui/animated-shader-background.tsx` | 128,145 | Other | yes | yes | no | no | One synchronous 96.9 ms main-thread block per /about page load on this hardware — a Long … |
| NEEDS_FIX | `frontend/components/ui/animated-shader-background.tsx` | 167-171 | addEventListener | yes | yes | no | no | Restores the full steady-state cost of the shader for content that is entirely invisible.… |
| NEEDS_FIX | `frontend/components/ui/animated-shader-background.tsx` | 126-146 | requestAnimationFrame | no | yes | no | no | Main-thread JS per frame is negligible: one float add and a single-mesh three render (sce… |
| NEEDS_FIX | `frontend/components/ui/animated-shader-background.tsx` | 173-184 | ReactEffect | no | no | yes | yes | No CPU cost. Each leaked context holds its GPU allocations until GC: on the measured live… |
| NEEDS_FIX | `frontend/components/ui/animated-shader-background.tsx` | 126-171 | requestAnimationFrame | no | yes | no | no | The fragment shader at 101-114 runs a 35-iteration loop per pixel, each iteration calling… |
| NEEDS_FIX | `frontend/components/ui/animated-text-cycle.tsx` | 34-45 | setInterval | yes | yes | no | yes | Per instance each 2.6 s cycle spends 0.3 s exiting + 0.4 s entering = 0.7 s animating at … |
| NEEDS_FIX | `frontend/components/ui/animated-text-cycle.tsx` | 34-45, 49-60 | setInterval | yes | yes | no | yes | Per instance per 2.6s cycle: mode="wait" runs exit (0.3s) then enter (0.4s) = ~0.7s of an… |
| NEEDS_FIX | `frontend/components/ui/highlighter.tsx` | 18-30, 55-95 | addEventListener | no | yes | no | yes | On /contact: 3 window mousemove listeners, each firing a non-bailing React state update p… |
| NEEDS_FIX | `frontend/components/ui/highlighter.tsx` | 162-174, 186-189,… | requestAnimationFrame | no | yes | no | no | On /contact, continuously from mount until navigation, including while the section is scr… |
| NEEDS_FIX | `frontend/components/ui/highlighter.tsx` | 18-95 | addEventListener | no | yes | no | yes | Chrome coalesces mousemove to the rAF cadence, so ~60 events/s on a 60 Hz display and ~12… |
| NEEDS_FIX | `frontend/components/ui/highlighter.tsx` | 142-326 | requestAnimationFrame | no | yes | no | yes | quantity=120 (contact/page.tsx:61). Per frame: 1 clearRect + 120 x (translate + beginPath… |
| NEEDS_FIX | `frontend/components/ui/highlighter.tsx` | 162-174, 283-319 | requestAnimationFrame | no | yes | no | yes | quantity=120 on /contact. Per frame: 1 clearRect + 120 iterations, each doing context.tra… |
| NEEDS_FIX | `frontend/components/ui/highlighter.tsx` | 18-30, 61-64, 77-… | addEventListener | no | yes | no | yes | /contact mounts 3 useMousePosition() callers → 3 window mousemove listeners. HighlightGro… |
| NEEDS_FIX | `frontend/components/ui/radial-orbital-timeline.tsx` | 48-71 | ReactEffect | no | no | no | no | One extra React render pass per node click (two passes instead of one). In development un… |
| NEEDS_FIX | `frontend/components/ui/radial-orbital-timeline.tsx` | 48-71 (with 126-1… | ReactEffect | no | no | no | no | One guaranteed extra full render pass per node click. A render of this tree is ~40 fibers… |
| NEEDS_FIX | `frontend/components/ui/reveal.tsx` | 48-58 | IntersectionObserver | no | yes | yes | yes | One observer, 15 targets on /about, none ever released. Per frame with a lifecycle update… |
| NEEDS_FIX | `frontend/components/ui/service-card-stack.tsx` | 110-127 | setTimeout | yes | yes | yes | yes | Negligible CPU. Correctness only: an early setLeaving(false) truncates the 140 ms exit tr… |
| NEEDS_FIX | `frontend/components/ui/spotlight-card.tsx` | 32-44 | addEventListener | no | yes | no | yes | With N GlowCards mounted: N `document` pointermove listeners. Per dispatched pointermove … |
| NEEDS_FIX | `frontend/components/ui/spotlight-card.tsx` | 73 | Other | no | no | no | no | Zero CPU cost — this is a correctness/UX defect, not a performance one. Its cost is that … |
| NEEDS_FIX | `frontend/components/ui/spotlight-card.tsx` | 32-44 | addEventListener | no | yes | no | yes | Ten category cards on production /shop. Per pointermove event: 10 listeners x (2 setPrope… |
| NEEDS_FIX | `frontend/components/ui/vapour-text-effect.tsx` | 276-280 | requestAnimationFrame | no | no | no | yes | No steady-state cost. One skipped stat per occurrence, and a permanent number-vs-label mi… |
| NEEDS_FIX | `frontend/components/ui/vapour-text-effect.tsx` | 245-251 | requestAnimationFrame | no | no | no | no | 60 rAF wakeups per second per affected canvas with zero output, unbounded in time. Each w… |
| NEEDS_FIX | `frontend/components/ui/vapour-text-effect.tsx` | 237-243 | requestAnimationFrame | no | no | no | no | No steady-state cost. One visibly wrong frame per tab return or long stall: the stat snap… |
| NEEDS_FIX | `frontend/components/ui/vapour-text-effect.tsx` | 174-194 | ReactEffect | no | no | no | no | No steady-state cost. One skipped stat per scroll-past that lands in the ~2.8 s animating… |
| NEEDS_FIX | `frontend/lib/analytics/collector.ts` | 232-322 | addEventListener | yes | yes | yes | yes | Steady state with no consent toggling: 6 permanent listeners, never removed — acceptable … |
| NEEDS_FIX | `frontend/lib/analytics/collector.ts` | 264-271 | addEventListener | yes | yes | yes | yes | Zero steady-state CPU (event-driven, fires only at unload). The cost is per-unload and pe… |
| NEEDS_FIX | `frontend/lib/analytics/collector.ts` | 272-274 | addEventListener | yes | yes | yes | yes | After k consent grants, one tab-switch dispatches k handlers; handler 1 does the real sen… |
| NEEDS_FIX | `frontend/lib/analytics/collector.ts` | 278-304 | addEventListener | no | yes | yes | yes | Zero on an idle page. Per click, with k live generations: k ancestor-chain walks. Typical… |
| NEEDS_FIX | `frontend/lib/analytics/collector.ts` | 306-322 | addEventListener | no | yes | yes | yes | Zero on an idle page. Per focus change, k ancestor walks with a single-branch selector — … |
| NEEDS_FIX | `frontend/lib/analytics/collector.ts` | 190-322 | addEventListener | no | yes | yes | yes | After k Accepts in one tab: 5k permanently-bound listeners instead of 5. Per anchor click… |
| NEEDS_FIX | `test/observer-guardrails.test.ts` | 43-95 | Other | no | no | no | no | No runtime cost — this is a detection gap, not a workload. Its price is paid only when th… |
| OPTIMIZED | `frontend/components/chat/chat-widget.tsx` | 204-219 | MutationObserver | yes | yes | no | no | Per callback: one getElementById (hash lookup, ~0.1 us) — negligible. The cost is record … |
| OPTIMIZED | `frontend/components/chat/chat-widget.tsx` | 149-168 | LayoutRead | yes | yes | no | no | Today: 4 forced style recalculations per open/close cycle plus 1 per host theme toggle — … |
| OPTIMIZED | `frontend/components/chat/chat-widget.tsx` | 71-89 | setTimeout | yes | yes | no | no | One 20 s timer and four one-shot listeners — nil while pending. The realised cost is the … |
| OPTIMIZED | `frontend/components/commerce/product-gallery.tsx` | 130-135 | setInterval | yes | yes | no | no | 1000 / 4500 = 0.22 state commits per second on every product detail page, forever. Each c… |
| OPTIMIZED | `frontend/components/commerce/shop-showcase.tsx` | 54-59 | setInterval | yes | yes | no | no | 0.2 state commits per second, forever, on /shop. Each commit re-renders the showcase and … |
| OPTIMIZED | `frontend/components/commerce/shop-showcase.tsx` | 54-59 (and produc… | setInterval | yes | yes | no | yes | One React state update and one slide cross-fade every 5000ms (shop showcase) and every 45… |
| OPTIMIZED | `frontend/components/commerce/store-provider.tsx` | 72-77 | ReactEffect | no | no | no | no | Idle page: exactly zero — neither effect runs without a state change, and StoreProvider d… |
| OPTIMIZED | `frontend/components/home/hero-stats.tsx` | 189-193 | setInterval | yes | yes | no | no | One React render of HeroStats + 3 StaticSlots every 4 s, forever, on every phone and ever… |
| OPTIMIZED | `frontend/components/home/hero-stats.tsx` | 60-92 | MutationObserver | yes | yes | no | yes | 2 getComputedStyle calls (one per useDisplayStyle instance) per notification. Notificatio… |
| OPTIMIZED | `frontend/components/home/product-mosaic.tsx` | 60-72, 97-104 (wi… | Other | no | yes | no | no | getFeaturedProducts(8) split into two columns of 4, each duplicated → 8 MosaicCards per c… |
| OPTIMIZED | `frontend/components/layout/site-header.tsx` | 23, 25, 65-70 | LayoutRead | no | no | no | no | Header height is 56px (h-14) on mobile and 100px (h-14 + h-11) on desktop, spanning the f… |
| OPTIMIZED | `frontend/components/ui/animated-shader-background.tsx` | 126-146 | requestAnimationFrame | no | yes | no | no | Per frame, with ~800 transcendental ops per fragment (derivation quoted above). Desktop 1… |
| OPTIMIZED | `frontend/components/ui/animated-shader-background.tsx` | 148-156 | ResizeObserver | no | yes | no | no | Steady state on a static page: zero — no notifications without a box-size change. Worst r… |
| OPTIMIZED | `frontend/components/ui/animated-shader-background.tsx` | 29,39,60-118 | Other | no | yes | no | no | 2,147,974 fragments x ~839 special-function ops = 1.80 x 10^9 per frame; at the measured … |
| OPTIMIZED | `frontend/components/ui/animated-shader-background.tsx` | 34-40, 148-156 | ResizeObserver | no | yes | no | no | 2 layout reads plus 1 extra layout pass per resize notification, i.e. ~180 reads/s during… |
| OPTIMIZED | `frontend/components/ui/card-fan-carousel.tsx` | 263-291 | addEventListener | no | yes | no | no | Zero at rest — nothing runs unless the pointer enters a card or the window is resized. Du… |
| OPTIMIZED | `frontend/components/ui/card-fan-carousel.tsx` | 49-61, 134-291 | addEventListener | no | yes | no | no | 2 viewport reads per invocation. Invocations: once per centerIndex change (a click), once… |
| OPTIMIZED | `frontend/components/ui/info-card.tsx` | 28-47 | addEventListener | no | no | no | no | 1 getBoundingClientRect per mousemove, ~60/s, and only while the pointer is inside one ca… |
| OPTIMIZED | `frontend/components/ui/marquee.tsx` | 17-29 (with trust… | Other | no | yes | no | no | 62 cards × (w-44 = 176px + gap-14 = 56px) = 14,384 CSS px wide, roughly 140px tall includ… |
| OPTIMIZED | `frontend/components/ui/radial-orbital-timeline.tsx` | 107-113 | setInterval | no | no | no | no | 20 ticks/s (1000/50). Each tick = 1 React render pass over a ~40-element subtree. Arithme… |
| OPTIMIZED | `frontend/components/ui/radial-orbital-timeline.tsx` | 107-113 | setInterval | no | no | no | no | While on screen in a foreground tab: 20 ticks/s x ~40 fibers = ~800 fiber reconciliations… |
| OPTIMIZED | `frontend/components/ui/radial-orbital-timeline.tsx` | 207 (driven by 19… | Other | no | no | no | no | 5 main-thread CSS transitions running continuously at the display refresh rate while the … |
| OPTIMIZED | `frontend/components/ui/radial-orbital-timeline.tsx` | 200-202 (with 37) | Other | no | no | no | no | 20 renders/s x 5 nodes x 2 invocations (detach with null, attach with element) = 200 ref … |
| OPTIMIZED | `frontend/components/ui/radial-orbital-timeline.tsx` | 85-113 | setInterval | no | no | no | no | 1000 / 50 = 20 state commits per second while the orbit is on screen on /about. Each comm… |
| OPTIMIZED | `frontend/components/ui/radial-orbital-timeline.tsx` | 85-113 | setInterval | no | no | no | no | 20 React renders per second while the orbit is on screen in a foreground tab. Each render… |
| OPTIMIZED | `frontend/components/ui/vapour-text-effect.tsx` | 206-340 | requestAnimationFrame | no | no | no | no | Measured, six canvases, effectiveDpr 2, lg desktop (338x88 number + 338x72 label backing … |
| OPTIMIZED | `frontend/components/ui/vapour-text-effect.tsx` | 342-369 | ReactEffect | no | no | no | no | Measured at effectiveDpr 2, six canvases, once per ~6.2 s cycle: ~650 KB of getImageData … |
| OPTIMIZED | `frontend/lib/analytics/collector.ts` | 153-173, 275 | addEventListener | no | no | yes | no | One rAF and three layout reads (`scrollHeight`, `innerHeight`, `scrollY`) per scrolled fr… |
| OPTIMIZED | `frontend/lib/analytics/collector.ts` | 216-225 | addEventListener | yes | yes | yes | no | One early-returning callback per cross-tab localStorage write, which on this site happens… |
| OPTIMIZED | `frontend/lib/analytics/collector.ts` | 153-173, 275 | requestAnimationFrame | no | no | yes | no | Zero on an idle page — no scroll means no rAF is ever requested, so this contributes noth… |
| OPTIMIZED | `frontend/lib/analytics/collector.ts` | 61-90, 126-146 | Other | yes | yes | yes | no | Per tracked event: at least 4 synchronous localStorage reads + 1 JSON.parse + at least 2 … |
| OPTIMIZED | `frontend/lib/particle-render.ts` | 97-152 | Other | no | no | no | no | Measured, six canvases: 18,344 ops for a settled field at effectiveDpr 2; up to 36,016 op… |
| SAFE | `app/about/page.tsx` | 27,75 | Other | no | no | no | no | Zero on every route except /about. On /about, one dynamically-imported chunk carrying ~12… |
| SAFE | `app/api/geocode/pincode/route.ts` | 28-59 | setTimeout | no | no | no | no | One timer per request, cleared in a finally. No browser main-thread cost at all. |
| SAFE | `app/api/geocode/reverse/route.ts` | 30-58 | setTimeout | no | no | no | no | One timer per request, cleared in a finally. No browser main-thread cost. |
| SAFE | `app/checkout/page.tsx` | 537-548 | setTimeout | yes | yes | no | no | At most one live timer, only while a payment is in flight. Zero idle cost. |
| SAFE | `backend/lib/customer.ts` | 90-115 | setTimeout | no | no | no | no | At most 150 ms of added server latency on the retry path only. No browser main-thread cos… |
| SAFE | `frontend/components/blog/blog-toolbar.tsx` | 34-72 | setTimeout | no | no | no | no | One 450 ms one-shot per typing pause. Zero idle cost. |
| SAFE | `frontend/components/blog/toc.tsx` | 17-43 | IntersectionObserver | no | no | no | no | Zero forced layout. One state commit per crossing of the -100px/-70% band during scroll —… |
| SAFE | `frontend/components/blog/view-tracker.tsx` | 14-34 | setTimeout | yes | yes | no | no | One 2 s one-shot per article page load, one fetch. Zero steady-state cost. |
| SAFE | `frontend/components/chat/chat-widget.tsx` | 64-89 | addEventListener | no | no | no | no | Effectively zero. These are user-decision and lifecycle events — consent changes, hash ch… |
| SAFE | `frontend/components/chat/chat-widget.tsx` | 71-88 | setTimeout | no | no | no | no | One 20 s one-shot per page load, at most. Zero steady-state cost. It is the deferral mech… |
| SAFE | `frontend/components/chat/chat-widget.tsx` | 186-197 | MutationObserver | yes | yes | no | no | Exactly 2 callbacks per panel open (the display='block' batch, then the +10 ms opacity/tr… |
| SAFE | `frontend/components/chat/chat-widget.tsx` | 64-69 | addEventListener | yes | yes | no | no | One window listener for the life of the page; one localStorage read per consent event, of… |
| SAFE | `frontend/components/chat/chat-widget.tsx` | 91-102 | ReactEffect | yes | yes | yes | no | One cross-origin fetch of ~378 KiB total (the file's own measured figure, lines 21-24), o… |
| SAFE | `frontend/components/chat/chat-widget.tsx` | 123-225 | MutationObserver | yes | yes | no | no | One getComputedStyle per notification. Notifications now occur only when the third-party … |
| SAFE | `frontend/components/chat/chat-widget.tsx` | 149-199 | MutationObserver | yes | yes | no | no | Zero at rest. On a theme toggle: one extra host callback performing one getComputedStyle(… |
| SAFE | `frontend/components/commerce/cart-rail.tsx` | 61-76 | addEventListener | no | no | no | no | Zero at rest. Per click site-wide: one `targetPathname` call, which for non-left-clicks c… |
| SAFE | `frontend/components/commerce/cart-toast.tsx` | 17-28 | setTimeout | yes | yes | no | no | One 5 s one-shot per cart removal. Zero idle cost. |
| SAFE | `frontend/components/commerce/country-picker.tsx` | 52-58 | setTimeout | no | no | no | no | One 0 ms macrotask per dropdown open. Immaterial. |
| SAFE | `frontend/components/commerce/country-picker.tsx` | 81-84 | ReactEffect | no | no | no | no | 1 forced layout per arrow-key press while the country dropdown is open. Zero otherwise. |
| SAFE | `frontend/components/commerce/currency-provider.tsx` | 101-176 | ReactEffect | yes | no | no | no | One pre-paint pass over four storage reads (a cookie regex, two sessionStorage gets, one … |
| SAFE | `frontend/components/commerce/quote-provider.tsx` | 21-40 | ReactEffect | no | no | no | no | Zero on an idle page — QuoteProvider has no effects and does not render. When a quote dra… |
| SAFE | `frontend/components/commerce/search-bar.tsx` | 108-159 | setTimeout | no | no | no | no | At most one 160 ms and one 1100 ms one-shot alive at a time, both keystroke-driven. Zero … |
| SAFE | `frontend/components/home/featured-projects-carousel.tsx` | 57-65 | IntersectionObserver | no | no | no | no | 1 observer, 1 target on the homepage. Deliveries happen only when the stage crosses 35% v… |
| SAFE | `frontend/components/home/featured-projects-carousel.tsx` | 39-85 | setTimeout | no | no | no | no | 0.18 state commits per second, and only while the section is at least 35% on screen in a … |
| SAFE | `frontend/components/home/featured-projects-carousel.tsx` | 47-85, 220-234 | setTimeout | no | no | no | no | One React state update every 5500ms, and only while the section is at least 35% visible i… |
| SAFE | `frontend/components/home/hero-stats.tsx` | 63-92 | ResizeObserver | no | yes | no | no | Zero at idle. Fires only on a font-size change of the observed span: 2 firings across a f… |
| SAFE | `frontend/components/home/hero-stats.tsx` | 83-88 | MutationObserver | yes | yes | no | no | Zero at idle. One record per theme-toggle click wakes both MOs. Per click: 2 read() calls… |
| SAFE | `frontend/components/home/hero-stats.tsx` | 66-79 | LayoutRead | yes | yes | no | no | RO path: 1 cached 4-property read per firing, ≤2 firings per full resize drag — effective… |
| SAFE | `frontend/components/home/hero-stats.tsx` | 94-104 | addEventListener | yes | yes | no | no | 2 MediaQueryList listeners for the life of the homepage. Fires when crossing 640px or whe… |
| SAFE | `frontend/components/home/hero-stats.tsx` | 189-193 | setInterval | yes | yes | no | no | Only on phones (<640px) or with prefers-reduced-motion. One timer at 0.25 Hz; each tick i… |
| SAFE | `frontend/components/home/hero-stats.tsx` | 106-155 | ReactEffect | no | yes | no | no | Per theme toggle, on a DPR-2 laptop at the lg breakpoint. Column width = (max-w-xl 576px … |
| SAFE | `frontend/components/home/hero-stats.tsx` | 188-193 | setInterval | yes | yes | no | no | 0.25 state commits per second → three <span> text-node updates every 4 s. Roughly 0.02 ms… |
| SAFE | `frontend/components/home/hero-stats.tsx` | 60-92 | MutationObserver | yes | yes | no | no | One getComputedStyle (a forced style recalc) per notification, x2 instances. Notification… |
| SAFE | `frontend/components/home/hero-stats.tsx` | 94-104 | addEventListener | no | yes | no | no | One boolean write per media-query transition. |
| SAFE | `frontend/components/layout/mobile-nav.tsx` | 43-91 | addEventListener | no | no | no | no | Zero while the menu is closed, which is its state on essentially every page view. While o… |
| SAFE | `frontend/components/layout/route-progress.tsx` | 48-73 | addEventListener | yes | no | no | no | Idle: zero. Two listeners for the life of the tab. Per click anywhere on the page: one `E… |
| SAFE | `frontend/components/layout/route-progress.tsx` | 44-46 | ReactEffect | yes | no | no | no | At most one extra render of one component per navigation, and only on the first navigatio… |
| SAFE | `frontend/components/layout/route-progress.tsx` | 37-73 | setTimeout | no | no | no | no | Two one-shots per qualifying link click, both cancelled the moment the route commits. Zer… |
| SAFE | `frontend/components/layout/route-progress.tsx` | 37-73 | addEventListener | no | no | no | no | One capture-phase document click listener for the session. Per click: one call to targetP… |
| SAFE | `frontend/components/legal/consent-banner.tsx` | 118-175 | ReactEffect | no | no | no | no | Zero unless the preferences dialog is open. While open: one keydown listener; on Tab, one… |
| SAFE | `frontend/components/legal/consent-banner.tsx` | 77-89 | ReactEffect | no | no | no | no | One window listener for the app lifetime; fires only when the footer's Privacy choices bu… |
| SAFE | `frontend/components/legal/consent-banner.tsx` | 118-175 | LayoutRead | no | no | no | no | 2 layout reads, once, when the visitor opens the cookie preferences dialog. Zero otherwis… |
| SAFE | `frontend/components/ui/animated-shader-background.tsx` | 158-165 | IntersectionObserver | no | no | no | no | One intersection computation for one element per rendering-steps pass in which the browse… |
| SAFE | `frontend/components/ui/animated-shader-background.tsx` | 158-165 | IntersectionObserver | no | yes | no | no | Effectively zero: a handful of callbacks per page, each doing one boolean test and a star… |
| SAFE | `frontend/components/ui/animated-shader-background.tsx` | 148-156 | ResizeObserver | no | yes | no | no | Zero at rest. On a genuine resize, one setSize (which reallocates the backing store) and … |
| SAFE | `frontend/components/ui/animated-shader-background.tsx` | 16-48, 128-185 | requestAnimationFrame | no | no | no | no | Full-viewport fragment-shader work at the display refresh rate, but only while the /about… |
| SAFE | `frontend/components/ui/card-fan-carousel.tsx` | 214-291 | setTimeout | no | no | no | no | One 50 ms one-shot per mouseleave. Zero idle cost — this component does no work at all un… |
| SAFE | `frontend/components/ui/deferred-image.tsx` | 30-66 | IntersectionObserver | no | no | no | yes | On /shop: one observer per category tile (ten in the current catalogue), created after th… |
| SAFE | `frontend/components/ui/deferred-image.tsx` | 30-66 | IntersectionObserver | no | no | no | yes | One IntersectionObserver per deferred image, each living from the load event until that i… |
| SAFE | `frontend/components/ui/progressive-flux-loader.tsx` | 197-232 | setTimeout | no | no | no | no | Zero today — the code path is unreachable because every call site is controlled. If it we… |
| SAFE | `frontend/components/ui/progressive-flux-loader.tsx` | 198-232 | requestAnimationFrame | no | yes | no | yes | Zero today — the loop never starts. If the component were ever used uncontrolled it would… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 84-105 | IntersectionObserver | yes | yes | no | no | Effectively zero at rest. An intersection crossing or a tab focus change costs one boolea… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 116-124 | addEventListener | no | yes | no | no | Zero at rest — resize events do not fire on an idle page. During an active window drag: o… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 170-175, 222, 238 | Other | no | yes | no | no | Zero main thread. Compositor-only (opacity and transform), on at most 7 small elements, s… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 85-124 | addEventListener | no | no | no | no | Zero while off-screen or backgrounded — that is the whole design. While visible and foreg… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 85-113 | IntersectionObserver | no | no | no | no | 1 observer, 1 target, on /about only. Deliveries only on 1% visibility crossings — a coup… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 116-124 (with 179… | addEventListener | no | yes | no | no | Zero on an idle page. During an active window drag-resize: one forced layout read plus at… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 84-105 | IntersectionObserver | no | no | no | no | Effectively zero. One IntersectionObserver registration and one document listener for the… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 170-177 | Other | no | yes | no | no | Three permanently animating composited layers for the lifetime of the /about mount, runni… |
| SAFE | `frontend/components/ui/radial-orbital-timeline.tsx` | 116-124 | addEventListener | no | yes | no | no | 1 offsetWidth read on mount, plus 1 per resize event (~60/s during a drag-resize, 0 other… |
| SAFE | `frontend/components/ui/spotlight-card.tsx` | 33-53, 70-75 | addEventListener | no | yes | no | no | One document pointermove listener total, and four document.documentElement.setProperty ca… |
| SAFE | `frontend/components/ui/use-dialog.ts` | 59-105 | addEventListener | no | no | no | no | 1 forced layout plus N cheap reads per Tab keypress, where N is the focusable count of on… |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 821-842 | IntersectionObserver | no | no | no | yes | 6 observers x 1 target on the desktop homepage (0 on phones and under prefers-reduced-mot… |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 174,439-482 | setTimeout | yes | no | no | no | One 0 ms and at most one 1000 ms one-shot per canvas per font change. Negligible. |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 183-203,300-312 | setTimeout | yes | no | no | no | One live timer per hero canvas (six on the desktop homepage), each a WAIT_DURATION one-sh… |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 300-313, 198-203 | setTimeout | yes | no | no | no | One macrotask per ~6.2 s per component (six on the homepage): ~1 wakeup/second total, eac… |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 174-179 | setTimeout | yes | no | no | no | One macrotask per viewport entry. |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 821-842 | IntersectionObserver | no | yes | no | no | One boolean comparison per intersection change; zero renders when the value is unchanged. |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 372-406 | ResizeObserver | no | yes | no | no | One object comparison per notification; zero renders and zero canvas work when the size i… |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 439-484 | setTimeout | yes | yes | no | no | Zero in practice — always cancelled within the same commit. |
| SAFE | `frontend/components/ui/vapour-text-effect.tsx` | 372-406 | ResizeObserver | no | no | no | yes | 1 getBoundingClientRect per mounted canvas at mount. hero-stats mounts 6 canvases (3 slot… |
| SAFE | `frontend/lib/analytics/collector.ts` | 118-124 | setTimeout | yes | yes | yes | no | At most one pending 5000ms timer at any instant, armed only by real user-generated events… |
| SAFE | `frontend/lib/analytics/collector.ts` | 216-225 | addEventListener | yes | yes | yes | no | One listener per page load for the life of the page. Fires only when another tab writes l… |
| SAFE | `frontend/lib/analytics/collector.ts` | 116-146,190-200 | setTimeout | yes | yes | yes | no | At most one live 5 s one-shot at any moment, page-wide, and only while events are pending… |
| SAFE | `frontend/lib/analytics/collector.ts` | 148-173, 279 | addEventListener | no | no | yes | no | 3 layout reads per animation frame WHILE SCROLLING only, i.e. at most 60 x 3 = 180 reads/… |
| SAFE | `frontend/lib/analytics/collector.ts` | 148-179, 261-326 | addEventListener | yes | yes | yes | no | Five permanent listeners per page load, fixed. Per scroll frame: one rAF callback perform… |
| SAFE | `frontend/lib/analytics/collector.ts` | 102-104 | Other | no | no | no | no | None — this entry records an absence. The practical consequence: every remaining loop in … |
| SAFE | `frontend/lib/analytics/provider.tsx` | 21-25 | ReactEffect | no | no | no | no | One window listener for the lifetime of the app. Fires once per consent decision; each fi… |
| SAFE | `frontend/lib/analytics/provider.tsx` | 27-40 | setTimeout | yes | no | no | no | One 300ms timer per navigation or consent change, always superseded rather than stacked. … |
| SAFE | `frontend/lib/analytics/provider.tsx` | 21-40 | ReactEffect | yes | no | no | no | One listener for the tab's life plus one timer per navigation. Per fire: a single querySe… |
| SAFE | `frontend/lib/analytics/provider.tsx` | 27-40 | setTimeout | yes | no | no | no | One 300 ms one-shot per navigation. Zero idle cost. |
| SAFE | `frontend/lib/pay-flow.ts` | 59-76,136-179 | setTimeout | yes | yes | no | no | One timer per in-flight request and at most one per script load, all cleared on settle. Z… |
| SAFE | `frontend/lib/stable-updates.ts` | 47-84 | Other | yes | yes | no | no | Four string/number comparisons per observer delivery. Its value is negative cost: it is w… |
| SAFE | `middleware.ts` | 56-82 (and src/in… | Other | no | no | no | no | Middleware: a header read and two string comparisons per request, plus one URL clone on t… |
| SAFE | `index.js (SEPARATE REPO — third-party code we do not own,…` | 246-257 | MutationObserver | yes | yes | no | no | One extra microtask pair per host light/dark theme toggle — their callback plus ours. Unm… |

Columns are the audit's answers to: does it run while the tab is hidden, does it run while
its element is off screen, does it survive unmount, and can it multiply across mounts.

## What was fixed in this pass

| Mechanism | File | Evidence it was real |
|---|---|---|
| Delegated analytics listeners re-bound on every consent re-grant | `lib/analytics/collector.ts` | measured on production: exactly 5 new listeners per withdraw-and-re-grant, linear over 4 cycles |
| One document pointermove listener per spotlight card | `ui/spotlight-card.tsx` | measured on production /shop: 10 cards, 10 listeners, 40 style writes per event |
| `touch-action: none` on every category tile | `ui/spotlight-card.tsx` | computed style confirmed on all 10 tiles; blocks touch panning |
| Body scroll lock had five uncoordinated owners | `layout/mobile-nav.tsx`, `legal/consent-banner.tsx`, `ui/use-dialog.ts` | interleaved close restores `hidden` and strands the page unscrollable |
| Homepage text cyclers ran ungated forever | `ui/animated-text-cycle.tsx` | two instances, no visibility or viewport gate, driving a blur filter |
| Frame chain respun forever with no particles | `ui/vapour-text-effect.tsx` | unbounded: nothing on that path can satisfy its own exit condition |
| Upload scheduled from inside a `setState` updater | `commerce/attachment-uploader.tsx` | a re-invoked updater uploads the same file twice |
| Confirmation timers discarded their handles | 4 commerce components + `ui/service-card-stack.tsx` | rapid clicks cut the confirmation short; timers outlive unmount |
| The guardrail test itself failed open | `test/observer-guardrails.test.ts` | the incident, relocated to an element root, passed every rule |

## Known and accepted, not fixed

| Mechanism | Where | Why it is being left |
|---|---|---|
| framer-motion's shared viewport observer never unobserves | `ui/reveal.tsx` via framer-motion 11.18 | the leak is inside the library, costs microseconds per frame, and `once: true` stops the callback doing work. Rewriting Reveal would touch every animated section on the site for no measurable gain |
| WebGL context never explicitly released | `ui/animated-shader-background.tsx` (/about) | real, but /about only; browsers cap live contexts and evict silently. Needs a considered fix plus a device test, not a rushed one |
| Shader loop restarts on tab focus without re-checking intersection | `ui/animated-shader-background.tsx` (/about) | renders full-tilt while scrolled away; same file, same caveat |
| 120-particle rAF loop with no visibility or reduced-motion gate | `ui/highlighter.tsx` (/contact) | /contact only; the gate is the same shape as the one applied to `animated-text-cycle` |
| `setState` calls nested inside a `setState` updater | `ui/radial-orbital-timeline.tsx` (/about) | React anti-pattern, no observed misbehaviour; wants its own change with a visual check |
| Carousel intervals run while the tab is hidden | `commerce/product-gallery.tsx`, `commerce/shop-showcase.tsx` | a cheap index change every few seconds, not an animation loop; gating them is a small follow-up |

None of these is freeze-capable. Each is recorded here so the next session does not have to
re-derive it.

## How the guardrails work now

`test/observer-guardrails.test.ts` no longer encodes a source-text shape. It checks the
invariant on the real exported values — **an observer must never watch the attributes it
writes** — and backs that with a root-agnostic source scan plus repository-wide structural
rules (every `setInterval` cleared, every self-rescheduling rAF cancellable, no timer inside
a `setState` updater, one owner for the body scroll lock).

Verified by re-introducing three regressions and confirming each is caught:

| Regression | Caught by |
|---|---|
| Panel observer's filter widened to include `aria-expanded` | the invariant unit test |
| Panel observer's `attributeFilter` removed entirely | the invariant unit test |
| Unfiltered attribute observer inlined on an **element** root | the root-agnostic scan (the shape the old test missed) |
