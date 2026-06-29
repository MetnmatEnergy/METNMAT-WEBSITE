# METNMAT-WEBSITE

Public marketing and shop site for **METNMAT Research & Innovations** — India's first private metallurgy & materials R&D company.

Built with **Next.js 15** (App Router), **React 19**, and **Tailwind CSS**.

## Structure

```
METNMAT-WEBSITE/                  pnpm + Turborepo monorepo
├── apps/
│   ├── website/        Public site + shop (Next.js, App Router)
│   └── dashboard/      Admin CMS (Next.js + Payload CMS 3)
└── packages/
    └── types/          Shared TypeScript types
```

The AI customer-support **chatbot** lives in a separate repo (`Metnmat-customer-agent-main`).
All three deploy to **Google Cloud Run** — see [`HANDOVER.md`](HANDOVER.md) for the
deployment pipeline and [`DEPLOY-GCP.md`](https://github.com/MetnmatEnergy/METNMAT-WEBSITE)
in the chatbot repo for the infra runbook.

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
