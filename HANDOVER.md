# METNMAT — Project Handover & Deployment Guide

Handover document for **METNMAT Research & Innovations** — production website, admin
dashboard (CMS), and AI customer-support chatbot.

> **Audience:** the engineering team that will own and deploy this project.
> Everything needed to run it in production is in this document. No prior context required.

---

## 1. What this project is

Three independent applications plus four external service accounts.

```
3 codebases                              4 external accounts
─────────────────────────────────       ──────────────────────────────
1. Website   — public marketing + shop   • MongoDB Atlas — database
2. Dashboard — admin CMS (Payload)        • Supabase      — file storage
3. Chatbot   — AI customer agent          • Resend        — transactional email
                                          • Groq          — chatbot AI model
```

### How they connect

```
                ┌──────────────── WEBSITE (Next.js) ────────────────┐
   visitor ───▶ │  content/images ──▶ Dashboard (CMS)               │
                │  chat bubble    ──▶ Chatbot (/widget.js)          │
                │  quote emails   ──▶ Resend                         │
                └───────────────────────────────────────────────────┘
   DASHBOARD ──▶ MongoDB Atlas + Supabase (storage)
   CHATBOT   ──▶ MongoDB Atlas + Groq (AI)
```

The three apps are **separate deployments**. They communicate over HTTPS via URLs only —
they are **never** merged into one folder or one deployment.

---

## 2. Source code locations

| App | Repo / folder | Framework | Local port |
|-----|---------------|-----------|-----------|
| **Website** | `METNMAT` monorepo → `apps/website` | Next.js 15 / React 19 | 3000 |
| **Dashboard (CMS)** | `METNMAT` monorepo → `apps/dashboard` | Next.js 15 + Payload CMS 3 | 3001 |
| **Chatbot** | `Metnmat-customer-agent-main` (separate repo) | Bun + Express + Mastra | 3002 (3001 default) |

- The **website + dashboard** live in one **pnpm monorepo** (`METNMAT`), managed by Turborepo.
- The **chatbot** is a **separate repository** (its own `package.json`, runtime, and `render.yaml`).
- ⚠️ Push **both** the `METNMAT` monorepo and the chatbot repo to the **company's GitHub org**.

---

## 3. Prerequisites (for whoever builds/deploys)

- **Node.js** ≥ 20 (developed on 22.x)
- **pnpm** 11.5.1 (`npm i -g pnpm@11.5.1`) — for the monorepo
- **Bun** ≥ 1.2 (`https://bun.sh`) — for the chatbot
- Accounts: GitHub, MongoDB Atlas, Supabase, Resend, Groq, plus a host (Vercel + Render recommended)

---

## 4. Deployment order (must follow — each step depends on the previous)

> Deploy back-to-front: the website needs the dashboard + chatbot URLs to exist first.

### Step 0 — Create the external accounts (company-owned)
Create all four under a **company email** (not a personal one):

| Service | What to create | What you get |
|---------|----------------|--------------|
| MongoDB Atlas | A cluster + DB user. **Network Access → allow `0.0.0.0/0`** | `MONGODB_URI` |
| Supabase | A project + a **private** Storage bucket (e.g. `metnmat-media`). Settings → Storage → S3 connection → generate keys | endpoint, region, key id, secret, bucket |
| Resend | Verify the sending domain (`metnmat.com`) — add the DNS records | `RESEND_API_KEY` |
| Groq | An API key. **Upgrade to Dev tier** (see §7) | `GROQ_API_KEY` |

### Step 1 — Deploy the Dashboard (CMS) → `apps/dashboard`
- **Host:** Render / Railway / Vercel (Node server).
- **Build:** `pnpm install && pnpm --filter dashboard build`
- **Start:** `pnpm --filter dashboard start` (serves on port 3001 / host port)
- **Env vars:** see §5.2.
- **Result:** the CMS URL, e.g. `https://metnmat-cms.onrender.com`. Admin panel at `/admin`.
- Products auto-seed on first boot from `apps/dashboard/src/catalog-data.ts`.

### Step 2 — Deploy the Chatbot → `Metnmat-customer-agent-main`
- **Host:** Render (a `render.yaml` blueprint is included — Render reads it automatically).
- Render → New + → **Blueprint** → connect the chatbot repo.
- **Env vars:** see §5.3. Leave `PUBLIC_URL` blank for the first deploy, then set it to the
  Render URL it gives you and redeploy.
- **Verify:** open `https://YOUR-CHATBOT.onrender.com/health` → `{"status":"ready"}`.
- **Result:** the chatbot URL, e.g. `https://metnmat-chatbot.onrender.com`.

### Step 3 — Deploy the Website → `apps/website`
- **Host:** **Vercel** (best for Next.js). Set the **root directory** to `apps/website`.
  - Build: `pnpm install && pnpm --filter website build` · Output: `.next` · Start: `next start`
  - (Vercel auto-detects Next.js; just point it at `apps/website` in the monorepo.)
- **Env vars:** see §5.1 — point `NEXT_PUBLIC_CMS_URL` at the Step-1 URL and
  `NEXT_PUBLIC_CHATBOT_URL` at the Step-2 URL.
- **Result:** the live site.

### Step 4 — Domain & DNS
- Point `metnmat.com` / `metnmat.in` DNS at Vercel (the website).
- Update each app's "public URL" env var to the final domain and redeploy:
  `NEXT_PUBLIC_SITE_URL` (website), `NEXT_PUBLIC_SERVER_URL` (dashboard), `PUBLIC_URL` +
  `ALLOWED_ORIGINS` (chatbot).

---

## 5. Environment variables (the master list)

> Every `.env` file is **gitignored** — values are NOT in the repos. Each team member /
> host must set these. Copy real values from the secure credentials handover (§8), then
> **rotate them** (§7).

### 5.1 Website — `apps/website/.env.local`
| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SITE_URL` | The website's own public URL |
| `NEXT_PUBLIC_CMS_URL` | The **Dashboard** URL (content + images) |
| `NEXT_PUBLIC_CHATBOT_URL` | The **Chatbot** URL (loads `/widget.js`) |
| `RESEND_API_KEY` | Resend key for quote emails |
| `QUOTE_FROM_EMAIL` | Sender, e.g. `METNMAT <noreply@metnmat.com>` |
| `QUOTE_NOTIFY_EMAIL` | Internal inbox that receives quote requests |
| `INTERNAL_API_KEY` | Shared secret — **must match** the Dashboard's value |

### 5.2 Dashboard — `apps/dashboard/.env`
| Var | Purpose |
|-----|---------|
| `PAYLOAD_SECRET` | Random secret for Payload sessions |
| `NEXT_PUBLIC_SERVER_URL` | The Dashboard's own public URL |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB` | DB name (e.g. `metnmat_cms`) |
| `SUPABASE_S3_ENDPOINT` / `_REGION` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | Supabase S3 storage |
| `SUPABASE_BUCKET` | Storage bucket name |
| `WEBSITE_URL` | The website URL (CORS / links) |
| `INTERNAL_API_KEY` | Shared secret — **must match** the Website's value |
| `GCS_*` | *(optional alternative to Supabase — leave blank if using Supabase)* |

### 5.3 Chatbot — `.env` (see `.env.example`)
| Var | Required | Purpose |
|-----|----------|---------|
| `MONGODB_URI` | Yes | Same Atlas cluster (products + conversations) |
| `GROQ_API_KEY` | Yes | Groq AI key |
| `JWT_SECRET` | Yes | Random secret for widget sessions |
| `PUBLIC_URL` | Prod | The chatbot's own public HTTPS URL |
| `ALLOWED_ORIGINS` | Prod | Comma-separated site origins, e.g. `https://www.metnmat.in,https://metnmat.in` |
| `PORT` | No | Default 3001 (host usually injects this) |
| `Meta_WA_*`, `FACEBOOK_*`, `Meta_IG_*` | Optional | WhatsApp / Facebook / Instagram channels |

---

## 6. Post-deploy verification checklist

- [ ] Dashboard `/admin` loads; you can log in; 68 products / 20 categories present.
- [ ] Website loads; product pages show images (proves Website→Dashboard link).
- [ ] Submit a quote request → confirmation email arrives (proves Resend).
- [ ] Chatbot `/health` returns `ready`; chat bubble appears bottom-right on the website.
- [ ] Send the bot "what products do you sell?" → real product answer (proves Groq + Mongo).
- [ ] `INTERNAL_API_KEY` is identical in Website and Dashboard.
- [ ] All "public URL" env vars point to the final domain, not localhost.

---

## 7. Known constraints & production notes

- **Groq free tier = 12,000 tokens/minute.** Heavy or rapid chats can hit this limit.
  **Upgrade to Groq Dev tier** before real traffic → https://console.groq.com/settings/billing
- **Render free tier sleeps** after ~15 min idle (≈50s cold start on the next request).
  Use a paid plan or an uptime pinger for production.
- **MongoDB Atlas Network Access** must allow the hosts' IPs (`0.0.0.0/0` is simplest).
- The chatbot runs from source (`bun run index.ts`), so code edits apply on restart.

---

## 8. Credentials handover (do NOT commit this)

Provide the company a **separate secure document** (password manager / sealed doc) containing
the real values for every variable in §5, plus logins for the 4 external accounts. Then:

1. **🔑 Rotate every key** — all dev keys were used during development and must be regenerated.
2. **👤 Transfer account ownership** to a company email for Atlas, Supabase, Resend, Groq, GitHub, and the hosts.
3. **🗑️ Revoke** your personal access once the company confirms everything works.

---

## 9. Day-2 operations (for the company)

- **Edit site content / products / prices:** Dashboard `/admin` — changes are live, no redeploy.
- **Update the chatbot's product catalog:** it shares the same MongoDB; products sync from the CMS data.
- **After website *code* changes:** redeploy the website (CMS *content* changes need no redeploy).
- **Logs / debugging:** each host (Vercel / Render) has a logs tab per service.

---

*Prepared as part of the internship handover. Questions during transition: keep this doc updated as the source of truth.*
