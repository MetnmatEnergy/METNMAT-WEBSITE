# METNMAT Platform

Monorepo for **METNMAT Research & Innovations** — India's first private metallurgy & materials R&D company.

Stack (locked): **Next.js + NestJS + MongoDB**, four codebases sharing one MongoDB Atlas as the sync layer. See `METNMAT_Tech_Stack.pdf` for the full specification.

## Structure

```
metnmat/
├── apps/
│   ├── website/        ✅ public marketing + shop site (Next.js, App Router) — built
│   ├── website-api/    ⬜ Website API (NestJS)            — to come
│   ├── dashboard/      ⬜ Operations Dashboard (Next.js)   — to come
│   └── dashboard-api/  ⬜ Dashboard API (NestJS)           — to come
└── packages/
    └── (shared types / ui — to come)
```

## Getting started

```bash
pnpm install          # install all workspaces
pnpm dev              # run the website (apps/website) on http://localhost:3000
pnpm build            # production build of the website
```

## apps/website

A **styled skeleton** of the public site. Every tab/route and the full design system are in place; **content is intentionally placeholder** and centralized in `apps/website/src/lib/placeholder.ts` — replace it tab-by-tab with real company data (or wire it to Payload CMS / the Website API later).

Routes: `/` `·` `/about` `·` `/services` `·` `/projects` `·` `/blog` (+ `/blog/[slug]`) `·` `/shop` (+ `/shop/[slug]`) `·` `/contact` `·` `/quote`.
