# Where things live (frontend vs backend)

This app keeps **frontend** and **backend** in clearly separated folders so you
always know where to make a change.

```
apps/website/src/
│
├── app/                ROUTING LAYER (thin — wires URLs to code)
│   ├── page.tsx, about/, services/, ...   → pages (import UI from @/frontend)
│   ├── api/                                → BACKEND endpoints (HTTP)
│   │   ├── health/route.ts                 GET  /api/health
│   │   ├── contact/route.ts                POST /api/contact
│   │   ├── quote/route.ts                   POST /api/quote
│   │   └── products/route.ts               GET  /api/products
│   ├── layout.tsx, globals.css, sitemap.ts, robots.ts
│
├── frontend/           🎨 FRONTEND — everything the user sees
│   ├── components/         UI building blocks
│   │   ├── layout/         header, footer, top-bar, nav, logo, page-hero
│   │   ├── ui/             button, card, badge, container, marquee, ...
│   │   ├── home/           homepage sections (hero, stats, etc.)
│   │   ├── cards/          product / service / project / blog cards
│   │   └── seo/            JSON-LD
│   └── lib/
│       ├── site.ts         nav + brand + contact config
│       ├── placeholder.ts  ALL placeholder page content (replace per tab)
│       └── utils.ts        cn() class helper
│
└── backend/            ⚙️ BACKEND — server-side logic (no UI)
    ├── config/env.ts       reads process.env (Mongo URI, keys)
    ├── db/mongo.ts         MongoDB connection (stub → wire later)
    ├── models/             data shapes (Enquiry, Product, BlogPost)
    ├── validation/         request validation (→ swap to Zod)
    └── services/           business logic
        ├── enquiries.service.ts   create contact/quote enquiries
        └── catalog.service.ts     read products / posts
```

## Rule of thumb

| I want to change…                                   | Go to…                         |
| --------------------------------------------------- | ------------------------------ |
| How a page looks / its text                         | `src/frontend/`                |
| Placeholder content (services, products, posts…)    | `src/frontend/lib/placeholder.ts` |
| Nav links, brand name, contact info                 | `src/frontend/lib/site.ts`     |
| What an API endpoint does                           | `src/app/api/*/route.ts` + `src/backend/services/` |
| Database / env / validation                         | `src/backend/`                 |
| Add a new page (URL)                                | add a folder under `src/app/`  |

**Import aliases:** `@/frontend/...`, `@/backend/...`, `@/app/...` (all under `src/`).

## Current state

- Frontend: full styled skeleton, placeholder content.
- Backend: route handlers + services are **stubs** that validate input and echo
  back (no database yet). Search for `TODO(backend)` to find what to wire next.
- The contact/quote **forms are not yet connected** to `/api/contact` and
  `/api/quote` — that's the next step when you want them live.
