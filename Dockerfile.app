# Dockerfile.app
#
# Production image for the Next.js apps (apps/web, apps/dashboard).
# Uses Next.js `output: "standalone"` to produce a self-contained server bundle.
#
# Build:  docker buildx build --platform linux/amd64 \
#           --build-arg APP=web \
#           -f Dockerfile.app -t aigarth/web:latest --load .
#
# Run:    docker run --rm -p 3003:3003 -e PORT=3003 aigarth/web:latest
#
# The standalone output is rooted at apps/<app>/.next/standalone/. We copy
# the entire standalone tree, then layer the .next/static and public/ folders
# back in (Next explicitly excludes these from standalone).

# syntax=docker/dockerfile:1.7
ARG APP=web

FROM node:20-bookworm-slim AS builder
ARG APP
# Public env vars (NEXT_PUBLIC_*) are inlined into the client bundle at
# `next build` time, so they must be present in the build context, not
# just at runtime. Pass the GA measurement ID with
#   --build-arg NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
# at build time. Empty / unset means "no analytics".
ARG NEXT_PUBLIC_GA_ID=""
ENV NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID}
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY tsconfig.base.json turbo.json ./
COPY packages/ packages/
COPY services/ services/
COPY apps/ apps/

# Full install for build. Cache mount reuses pnpm store across
# services and apps in the same buildx run.
RUN --mount=type=cache,target=/pnpm/store,id=pnpm-store \
    pnpm install --frozen-lockfile

# Build the app and its workspace deps. next.config.mjs sets output: "standalone"
# so this produces apps/<app>/.next/standalone/
RUN --mount=type=cache,target=/pnpm/store,id=pnpm-store \
    --mount=type=cache,target=/repo/.turbo,id=turbo-cache \
    --mount=type=cache,target=/repo/apps/${APP}/.next/cache,id=next-cache \
    pnpm --filter @aigarth/${APP}... build

# Standalone output is sufficient on its own for runtime. Static and public
# are NOT included — copy them in next so the runtime stage has them.

# ---- runtime stage ----
FROM node:20-bookworm-slim AS runtime
ARG APP
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the standalone bundle (includes apps/<app>/server.js, plus node_modules
# and the apps/<app>/ package.json + .next tree)
COPY --from=builder --chown=node:node /repo/apps/${APP}/.next/standalone/ /app/

# Standalone omits .next/static and public — copy them in.
# The standalone bundle expects them at apps/<app>/.next/static and
# apps/<app>/public, mirroring the dev layout.
COPY --from=builder --chown=node:node /repo/apps/${APP}/.next/static /app/apps/${APP}/.next/static
COPY --from=builder --chown=node:node /repo/apps/${APP}/public /app/apps/${APP}/public

# server.js is at apps/<app>/server.js inside the standalone output.
WORKDIR /app/apps/${APP}

USER node

EXPOSE 3000

HEALTHCHECK NONE

# PORT is set per app in compose (3003 for web, 4000 for dashboard).
CMD ["node", "server.js"]
