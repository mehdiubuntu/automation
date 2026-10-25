# React SPA image. Multi-stage:
#   1. Build the Vite bundle with node:22-alpine.
#   2. Serve the static assets with nginx:alpine on :3000.
#
# VITE_API_BASE_URL is baked at BUILD time (Vite inlines import.meta.env.*
# during the build, not at runtime). The default /api/v1 assumes the SPA
# is served same-origin with the API reachable under /api — the nginx in
# this image proxies /api/ to the `backend` compose service, so the
# default works out of the box for the composed stack. Override the build
# arg only for split-origin deployments.

# ─── Build stage ─────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

# tsc -b && vite build — the typecheck runs here too.
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# SPA-aware config: try_files fallback to index.html (React Router
# survives hard refresh) + same-origin /api proxy to the backend.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000
