# Worker tier — an always-on Node service, deployed OFF Vercel.
#
# Vercel functions are stateless and time-limited, which is incompatible with
# monthly reporting runs, report pulls, and PDF generation (spec §15.2). This
# image targets Render / Railway / Fly / ECS.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Dependencies are installed from the workspace root so the worker resolves its
# `workspace:*` packages exactly as it does locally.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @machai/worker...

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker ./apps/worker

# Run as a non-root user. The base image ships one.
USER node

EXPOSE 3001
# The health endpoint the platform's checks hit.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WORKER_PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
