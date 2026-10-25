# NestJS (Fastify) API image. Multi-stage so the production image only
# carries the compiled JS + production deps (no TypeScript, no devDeps).
#
# One image, three entry points - choose with the container command:
#   node dist/main.js     the API (default)
#   node dist/worker.js   the background worker that runs jobs (WORKER_ENGINES=audit gives one engine its own)
#   node dist/migrate.js  apply pending SQL migrations and exit (a deploy step; then run the API and the
#                         worker with DB_AUTO_MIGRATE=false)
# By default the API and the worker apply pending migrations themselves at boot (DB_AUTO_MIGRATE=true).

# ─── Build stage ─────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install all deps (incl. dev) so `nest build` can run.
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# Drop devDeps before copying into the runtime stage. Pruning (instead
# of a second `npm ci --omit=dev`) keeps the already-built native
# modules (bcrypt) without needing a toolchain in the runtime image.
RUN npm prune --omit=dev

# ─── Runtime stage ───────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Tini as PID 1 so SIGTERM from `docker stop` reaches Node cleanly —
# main.ts calls enableShutdownHooks(), which only helps if the signal
# actually arrives.
RUN apk add --no-cache tini

# Non-root. node:alpine ships a `node` user (UID 1000).
USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package*.json ./

ENV NODE_ENV=production \
    APP_PORT=5000
EXPOSE 5000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
