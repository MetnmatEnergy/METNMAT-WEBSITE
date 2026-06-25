# syntax=docker/dockerfile:1
# ── METNMAT website (Next.js 15, standalone output) → Google Cloud Run ────────
#
# ROOT Dockerfile so a plain "Dockerfile"-type Cloud Build trigger — one that
# looks for /workspace/Dockerfile and passes no --build-arg — builds the WEBSITE
# correctly. The primary push-to-main deploy uses cloudbuild.website.deploy.yaml
# with `-f Dockerfile.website`; this file is the zero-config equivalent.
#
# The build CONTEXT must be the monorepo ROOT so the pnpm workspace and the
# shared @metnmat/types package resolve.
#
# NEXT_PUBLIC_* are inlined into the client bundle AND into the CSP headers at
# BUILD time (see apps/website/next.config.mjs), so they default to the
# production domains here — a trigger that passes no build-args still produces a
# correct production image. Override per-environment with --build-arg. Node 22
# matches CI and the proven Dockerfile.website (engines allow node >= 20).

FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@11.5.1

# 1) Install deps — layer cached on the lockfile + workspace manifests only.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/website/package.json   apps/website/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile --filter website...

# 2) Source for the website + its workspace dependency.
COPY packages/types packages/types
COPY apps/website  apps/website

# 3) Build. `output: standalone` is enabled via NEXT_OUTPUT; the NEXT_PUBLIC_*
#    values are inlined here (defaults = production domains, overridable).
ARG NEXT_PUBLIC_SITE_URL=https://www.metnmat.com
ARG NEXT_PUBLIC_CMS_URL=https://admin.metnmat.com
ARG NEXT_PUBLIC_CHATBOT_URL=https://chat.metnmat.com
ENV NEXT_OUTPUT=standalone \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_CMS_URL=${NEXT_PUBLIC_CMS_URL} \
    NEXT_PUBLIC_CHATBOT_URL=${NEXT_PUBLIC_CHATBOT_URL}
RUN pnpm --filter website build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
# Cloud Run sends traffic to $PORT (8080). Next's standalone server honors PORT
# and HOSTNAME; no secrets are baked in — runtime env comes from Cloud Run.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# Next standalone = minimal server + traced node_modules. In a monorepo the
# entry lives at apps/website/server.js with static/public beside it.
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/static     ./apps/website/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/public           ./apps/website/public

USER nextjs
EXPOSE 8080
CMD ["node", "apps/website/server.js"]
