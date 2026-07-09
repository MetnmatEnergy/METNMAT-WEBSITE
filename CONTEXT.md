# METNMAT — AI / Developer Context (single-file brief)

> **New session? Read this file and you have everything.** It is the one-stop brief for
> understanding the project, running it locally, and shipping changes live. Deeper detail
> lives in `HANDOVER.md`, `ENVIRONMENT_VARIABLES.md`, and `PRODUCTION_AUDIT_REPORT.md`.
> _Last updated: 2026-07-09 (end of session — everything below is LIVE unless marked open). `main` @ `5325c30`; prod **website `metnmat-website-00192-cwj` / dashboard `metnmat-dashboard-00102-zhn`**._
>
> **Shipped 2026-07-09 (all live) — storefront account, checkout & services push:**
> **(1) Customer member codes** `MNM-U-YY-000001` — atomic per-year Mongo `$inc` counter (`Counters` collection + `hooks/customer-code.ts`), immutable, backfilled for existing customers in `seed.ts`. **(2) Pro researcher signup** — optional Role select + Institution; **two-pane auth redesign** (`commerce/auth-card.tsx`); shared form primitives (`ui/field.tsx`). **(3) Profile view/edit mode** + **Google-style profile picture** — the avatar has a camera badge → Radix **modal** (`commerce/avatar-modal.tsx` + `ui/dialog.tsx`): 48 bundled **Noto-Emoji** illustrations (`public/avatars/*.svg`, Apache-2.0, NOTICE+LICENSE included) + photo upload (client-resized 256px JPEG) + take-a-picture; **saves INSTANTLY** via `POST /api/account/avatar` (a PARTIAL patch — only the picture, never other fields); appears in profile card, account header, AND the site-header account menu. **(4) Header account dropdown** (`commerce/account-menu.tsx` + `ui/dropdown-menu.tsx`, Radix) — state fetched CLIENT-side (`/api/account/me`) so the shared server header stays static-prerenderable. **(5) Checkout**: internationalized labels (PIN/ZIP, Town/City, Phone/landline) + **flag + searchable dial-code country picker** (`commerce/country-picker.tsx`, synced two-ways with shipping) + marketplace order summary. **(6) Services**: GSAP **fanned card deck** (`ui/card-fan-carousel.tsx`, needs `gsap`) replaced the ExpandingCards showcase (now-unused `ui/expand-cards.tsx`). Security surface (customer codes atomicity/immutability, avatar data-URI XSS + partial-save, static-prerender preservation) was adversarially reviewed via Workflows. **Verification gotcha:** the dev preview never hydrated client JS this session — everything was verified via SSR curl/DOM-eval + direct API calls + review workflows, NOT interactive preview clicks.
>
> **Shipped since 2026-07-04 (all live):** flat "M" brand favicon (site + admin); brand-colour
> social links + Amazon storefront (top bar + footer); second email mk@metnmat.com; 3 offices
> (Howrah HQ / Mumbai / Sambalpur — footer 3-col with hours-less "Get in touch" + wide HQ-only
> map strip); tagline dropped "first"; SEO tab title "METNMAT — Electrochemical Systems |
> Reference Electrodes | metnmat.com"; LocalBusiness JSON-LD + `/llms.txt` GEO layer; homepage
> blog teaser shows real covers; homepage "What we do" = InfoCard (cursor-tracking conic border);
> services "Every service, explained" = framer-motion draggable card-stack deck; contact WhatsApp
> CTA inside the message-form card; CTA band brand-banner bg (light-mode); logo white-plate
> removed + dark-mode logo variant (theme-swapped); **homepage Featured case study is CMS-driven**
> (Homepage global `featuredProject` → defaults to a project WITH a cover so a real photo shows;
> revalidates on any project save); **project covers 6/15 seeded** (text-safe rendering across
> card/hero/spotlight/home — covers are text-left/art-right, cropped `object-left`); projects +
> blog hero spacing tightened; **blog: inline diagrams** (Lexical `upload` nodes → captioned
> figures; editor already supports admin image insert) on all 3 articles; **3rd blog article**
> "CO₂ Fuel Cells" added (cover + authored diagram; `## ` headings now supported in seeded body).
> Seed gotcha learned: `ensureRealBlogArticles`/`ensureRealProjects` early-return once migrated —
> add NEW seeded content via a standalone create-if-missing (see `EXTRA_ARTICLE_SLUGS`,
> `PROJECT_COVERS`, `BLOG_FIGURES` in `apps/dashboard/src/seed.ts`). Payload Lexical `upload`
> node v3 shape is documented in auto-memory [[metnmat-blog-platform]]._

---

## 1. What this is

**METNMAT Research & Innovations** — production e-commerce + content platform for
electrochemical hardware and materials R&D. **Globally used; this is the company's main
site — ship carefully.**

Three apps on **Google Cloud Run**, GCP project **`metnmat-website`**, region
**`asia-south1`**:

| App | Source | Cloud Run service | Live URL |
|-----|--------|-------------------|----------|
| **Website** (Next.js 15 / React 19) | monorepo → `apps/website` | `metnmat-website` | www.metnmat.com |
| **Dashboard / CMS** (Payload CMS 3.85 on Next.js 15) | monorepo → `apps/dashboard` | `metnmat-dashboard` | admin.metnmat.com |
| **Chatbot** (Bun + Express + Mastra + Groq) | `Metnmat-customer-agent-main` (separate dir, NOT in git) | `metnmat-chatbot` | chat.metnmat.com |

Monorepo: **pnpm 11.5.1 + Turborepo, Node 22**. Data: **MongoDB Atlas** (`metnmat_cms`
prod / `metnmat_cms_dev` dev). Media: **private GCS bucket `metnmat-media-prod`** via
Payload. Also: Resend (email), Razorpay (payments), Upstash Redis (rate limits), Google
OAuth (customer sign-in). GitHub: `MetnmatEnergy/METNMAT-WEBSITE`.

Local path: `C:\Users\ritik\OneDrive\Desktop\METNMAT` (main checkout, branch `main`).

---

## 2. Workflow: ship a change (user-confirmed: DIRECT push to main)

No feature branches, no PRs (`gh` is not installed). **A push to `main` auto-deploys
both apps via Cloud Build** (~5–10 min). `gcloud` in the shell is authed
(`metnmat-deployer@` SA).

```bash
# 1) gates before every push (a push goes straight to prod):
pnpm --filter website typecheck && pnpm --filter website lint
pnpm --filter dashboard typecheck && pnpm --filter dashboard lint
npx vitest run                       # root test/ — 91 tests
pnpm --filter website build && pnpm --filter dashboard build

# 2) ship:
git add … && git commit -m "…" && git push origin main

# 3) monitor + verify:
gcloud builds list --region=global --ongoing        # wait until empty
curl -s -o /dev/null -w '%{http_code}' https://www.metnmat.com/
# rollback: gcloud run services update-traffic <svc> --to-revisions=<REV>=100 --region=asia-south1
```

**Deploy gotchas:** image-only deploys (a NEW env var/secret needs manual
`gcloud run services update`); `NEXT_PUBLIC_*` baked at build; content edits in /admin
are live with NO deploy (revalidate ping + 60s ISR). ⚠️ Duplicate website trigger
(`rmgpgab-metnmat-website-…`) still enabled → two website builds per push (harmless).

---

## 3. Local dev (⚠️ read the warning)

```bash
pnpm install --frozen-lockfile
pnpm --filter dashboard dev   # http://localhost:3001 (Payload; seeds on boot)
pnpm --filter website dev     # http://localhost:3000
```

⚠️ **BEFORE any local testing that writes data:** check `apps/dashboard/.env` —
`MONGODB_URI` db name **must end in `_dev`** (`metnmat_cms_dev`). It has pointed at PROD
before and test data leaked into production. `GCS_BUCKET` should stay commented out
locally (media→local disk). `RESEND_API_KEY` is LIVE even locally — test emails really
send (notify inbox: energy@metnmat.com).

Preview quirk: the built-in preview browser sometimes fails to run page JS/screenshots —
verify via curl/a11y-snapshot/computed styles, or restart the preview server.

---

## 4. CMS admin (admin.metnmat.com)

- **Sign-in = 4-digit PIN pad** (`/pin-login` route → Payload login; password is
  HMAC-derived from the PIN via `PAYLOAD_PIN_PEPPER`). Email/password is break-glass only.
- **Single super-admin: Mukesh Kumar (company director), mukesh@metnmat.com** — signs in
  with his 4-digit PIN (he has it; never commit credentials). All previous staff profiles
  were removed 2026-07-04. He creates staff + assigns roles.
- **Env-driven director bootstrap** exists in `seed.ts` (`ensureDirectorAccount`):
  set `DIRECTOR_EMAIL/NAME/PIN[/RESET=true]` on Cloud Run → boot creates/reconciles the
  account (collision-safe by email OR pin) → then REMOVE the env vars.
- **Composable RBAC:** fixed roles (users.roles) + **Staff Roles** designer collection
  (`staff-roles`): admin composes roles from areas (sales, support, operations, accounts,
  catalog, content, assets, settings, administration) → assigned via `users.customRoles`
  (populated per-request via `users.auth.depth=1` → revocation is instant). Custom roles
  can NEVER grant admin powers. All checks flow through `src/access/index.ts` helpers
  (`hasArea`, `hasRoleOrArea`; canManageCatalog split into catalog/sales/orders/tickets
  variants). **`isStaff` (user.collection==="users") gates internal collections — never
  use bare `isLoggedIn`: storefront customers are also `req.user`!**
- **Light/dark mode:** both palettes in `apps/dashboard/src/app/(payload)/custom-admin.css`
  keyed off `html[data-theme]`; header ThemeToggle (persists via `payload-theme` cookie);
  SSR theme via Sec-CH-Prefers-Color-Scheme headers (next.config.mjs). Admin components
  must use theme CSS vars only (no raw hexes).
- **Dashboard** (`admin/BeforeDashboard.tsx`): real-data KPIs/charts/recent orders/quick
  links, hand-rendered SVG (no chart deps), theme-aware.

---

## 5. Website features (all CMS-driven, live)

- **Shop** (products/categories/cart/Razorpay checkout), Google customer sign-in,
  quote/RFQ flows — pre-existing, untouched invariants.
- **Blog platform** (`/blog`, `/blog/[slug]`, `/blog/submit`, RSS, sitemap):
  posts collection (drafts + scheduling via future publishedDate — no cron), taxonomy
  collections, authors, concurrency-safe like/dislike + view counts (atomic endpoints,
  counters guarded against admin-save clobber), Request-to-Publish workflow (private
  uploads, review statuses, convert-to-draft button), slug-change 301s, signed draft
  previews. 2 real articles (IEM, AEMWE) with cover images.
- **Projects platform** (`/projects`, `/projects/[slug]`): 15 real case studies from
  metnmat.in in 6 categories, premium listing (category filter via `?category=`, featured
  spotlight) + detail pages (highlights, gallery, related). Public sees only
  published+active. Covers not yet uploaded (branded placeholder until staff add images).
- **Maintenance banner:** Website Settings → Maintenance Notice — one switch shows a
  site-wide amber notice (site stays usable); fail-safe off.
- Revalidate coverage is 100%: every admin save pings the website → live in seconds.

---

## 6. Critical gotchas (each cost real debugging time)

1. **`importMap.js` regeneration:** every LOCAL dashboard dev boot regenerates
   `apps/dashboard/src/app/(payload)/admin/importMap.js` WITHOUT `GcsClientUploadHandler`
   (GCS is off locally). **Re-add the import + map entry before every commit** or prod
   admin uploads break. Check: `grep -c GcsClientUploadHandler <file>` should be 2.
2. **`loading.tsx` breaks 404s:** ANY `loading.tsx` in a segment chain (parents count)
   makes dynamic routes stream → `notFound()` renders the 404 UI but with HTTP 200.
   Blog/projects `[slug]` routes deliberately have none, and read `await draftMode()`
   before fetching. Diagnostic: real 404s have Content-Length; broken ones are chunked.
3. **Seed migrations are ONE-SHOT** (`ensureRealProjects`, `ensureRealBlogArticles`):
   they run only while old placeholders exist or the DB is fresh — staff deletions are
   never resurrected, staff content never overwritten. Don't "simplify" them back to
   create-if-missing.
4. **Counter guard:** posts like/view counters are `$inc`'d on the MAIN collection with
   `{timestamps:false}`; the beforeChange guard re-reads them fresh (originalDoc is a
   VERSIONS snapshot — using it resets counters on publish).
5. **Payload `/me` respects read access** — users.read must allow self (`canReadStaff`
   returns a Where for non-admins) or the admin panel breaks for non-admin staff.
6. **Synthetic staff emails must stay opaque** (old format embedded the PIN — scrubbed;
   never reintroduce). GraphQL is REMOVED (route files deleted) — don't restore it
   (Payload binds req.user at depth 0 there, silently ignoring custom-role areas).
7. **Payload REST `where` via curl needs `-g`** (brackets glob otherwise). Windows curl
   `-F @file` needs Windows-style paths.
8. The website's `api()` fallback content is used ONLY when the CMS is unreachable —
   empty results must render empty (unpublishing must hide content).

---

## 7. Open / optional items

**▶ DO FIRST — disable the duplicate website Cloud Build trigger (STILL PENDING).**
TWO triggers deploy the same website Cloud Run service on every push: the canonical
`metnmat-website-auto-deploy` (committed `cloudbuild.website.deploy.yaml`) and a
wizard-generated duplicate `rmgpgab-metnmat-website-asia-south1-MetnmatEnergy-METNMAT-WExqs`
(no config file). Both build, then race on deploy → wasted builds + occasional
false-alarm FAILUREs (live site always correct — winner deploys the same commit).
**Attempted repeatedly, could not do it from the shell:** the `--disabled` flag does
NOT exist on this `gcloud` (use `gcloud beta builds triggers export|import` with a
`disabled: true` line); the deployer SA (`metnmat-deployer@`) can EXPORT but lacks
trigger-EDIT permission; the `energy@metnmat.com` account needs interactive
`gcloud auth login`. **Easiest fix — the user does it: GCP Console → Cloud Build →
Triggers (region: global) → `…WExqs` → ⋮ → Disable.** Leave the dashboard
`rmgpgab-…-dashboard-…` trigger alone.

**Account/checkout follow-ups offered this session (optional):** desktop webcam
capture for the avatar "Take a picture" (currently a mobile `capture` input; desktop
falls back to file picker); more avatar illustrations (`AVATAR_ILLUSTRATIONS` +
`public/avatars/`); decouple phone-country from shipping-country on checkout
(currently SYNCED per an earlier request); guaranteed flag *images* on Windows for
the dial-code picker (emoji flags render as 2-letter codes on Windows desktop).
Note: any customer who set an OLD emoji avatar renders their initial until they
re-pick (the switch to illustration ids replaced emoji values).

Other open / optional:
- Confirm live Google OAuth consent once (prod redirect URI
  `https://www.metnmat.com/api/account/google/callback` in Google console).
- Project covers: **6 of 15 done** (microstructure-control-heat-treatment,
  ferritic-stainless-steel-texture, casting-yield-optimization,
  alumina-insulation-fiber-board, oxygen-free-copper-alloy, modeling-simulations).
  9 remain (aluminum-foam, composite-materials, surface-casting-improvement,
  material-synthesis, new-aluminum-alloy, wear-resistant-composites,
  waste-heat-recycling-system, casting-defects, high-temperature-ceramic). Paste
  artwork (text-left / art-right, 1600×900) → add to `PROJECT_COVERS` in seed.ts.
- Offered & liked but not yet done: a SECOND diagram per blog article (e.g. PEM-vs-AEM
  for IEM, four electrolyte configs for AEMWE); a text-free crop of the microstructure
  cover (its baked title duplicates the page heading).
- Interactive browser click-check of blog reactions on prod (API verified via curl;
  the built-in preview browser is flaky for client-JS/image loading — all UI this
  session was verified via curl/DOM-eval/computed-styles + offline sharp composites).
- Old shop routes (`/shop/p/<bad-slug>`) return soft-200s — pre-existing, low priority.

---

## 8. How to work next session

Say what you want changed. The assistant will: read this file + its auto-memory, build
the change, verify locally against the dev DB (browser + curl), run all gates, run an
adversarial review for substantive changes, then push to `main` (auto-deploy) and verify
live. Real credentials/secrets live only in gitignored `.env` files, GCP Secret Manager,
and with the director — never in this file or the repo.
