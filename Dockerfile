# syntax=docker/dockerfile:1

# ---- Build: frontend (Vite) + backend (tsc) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Runtime: only compiled output and production dependencies ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    STORAGE_DIR=/data/uploads
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/dist ./dist

# Uploaded files (mount a volume here so they survive container rebuilds).
RUN mkdir -p /data/uploads && chown node:node /data/uploads

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Secrets come from the environment at runtime (docker compose reads .env).
CMD ["node", "build/server/index.js"]
