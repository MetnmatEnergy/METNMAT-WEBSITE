# METNMAT-WEBSITE

Public marketing and shop site for **METNMAT Research & Innovations** — India's first private metallurgy & materials R&D company.

Built with **Next.js 15** (App Router), **React 19**, and **Tailwind CSS**.

## Structure

```
metnmat-website/
├── apps/
│   └── website/        Public site (Next.js, App Router)
└── packages/
    └── types/          Shared TypeScript types
```

## Getting started

```bash
pnpm install          # install all workspaces
pnpm dev              # run the website on http://localhost:3000
pnpm build            # production build
pnpm start            # start production server
```

## Routes

`/` `·` `/about` `·` `/services` `·` `/projects` `·` `/blog` (+ `/blog/[slug]`) `·` `/shop` (+ `/shop/[slug]`) `·` `/contact` `·` `/quote`

## Project layout

See `apps/website/STRUCTURE.md` for where frontend, backend, and API code live.
