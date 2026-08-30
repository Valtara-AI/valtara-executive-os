# Multi-stage build for apps/api (DL-INFRA-001: Railway, Docker-deployable
# per CLAUDE.md non-negotiable #5 - no proprietary managed service this
# can't be migrated off). Built from the monorepo root so npm workspaces
# can resolve @nyxor/* packages; only apps/api's runtime dependency graph
# (shared, database, ai-orchestrator, audit) ends up in the final image.

FROM node:20-slim AS base
WORKDIR /repo

# ---- deps: install once, reused by the build stage ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ai-orchestrator/package.json packages/ai-orchestrator/package.json
COPY packages/audit/package.json packages/audit/package.json
# apps/web and packages/integrations are outside apps/api's runtime graph,
# but `npm ci` still needs every workspace's package.json present to
# resolve the lockfile against package.json's "workspaces" list.
COPY apps/web/package.json apps/web/package.json
COPY packages/integrations/package.json packages/integrations/package.json
RUN npm ci

# ---- build: compile TypeScript to dist/ via project references ----
FROM deps AS build
COPY tsconfig.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/database packages/database
COPY packages/ai-orchestrator packages/ai-orchestrator
COPY packages/audit packages/audit
COPY apps/api apps/api
# Compiles apps/api and every composite package it references (see root
# tsconfig.json) - deliberately not `npm run build`, which would also try
# to `next build` apps/web, which isn't part of this image.
RUN npx tsc --build

# ---- runtime: production deps only, compiled output, no TS toolchain ----
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ai-orchestrator/package.json packages/ai-orchestrator/package.json
COPY packages/audit/package.json packages/audit/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/integrations/package.json packages/integrations/package.json
RUN npm ci --omit=dev --workspace=apps/api --workspace=packages/shared \
      --workspace=packages/database --workspace=packages/ai-orchestrator \
      --workspace=packages/audit --include-workspace-root

COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/database/dist packages/database/dist
COPY --from=build /repo/packages/ai-orchestrator/dist packages/ai-orchestrator/dist
COPY --from=build /repo/packages/audit/dist packages/audit/dist
# Handlebars prompt templates are loaded from disk at runtime relative to
# the repo root (packages/ai-orchestrator/src/prompt-loader.ts), not
# bundled into dist/ - the Docker image needs them at the same relative
# path.
COPY prompts prompts

EXPOSE 3001
# Default CMD runs the HTTP server. The BullMQ worker (SAD §4.2: background
# jobs are their own deployable unit) is the *same* image with the CMD
# overridden to ["node", "apps/api/dist/worker.js"] - a second Railway
# service (or docker-compose service) pointed at this image with that
# override, not a separate build.
CMD ["node", "apps/api/dist/index.js"]
