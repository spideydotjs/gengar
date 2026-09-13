# ── Stage 1: Build React Frontend ─────────────────────────────────────
FROM node:20-bookworm-slim AS client-builder

WORKDIR /app/client

# Install frontend dependencies
COPY client/package*.json ./
RUN npm ci || npm install

# Build production bundle to /app/client/dist
COPY client/ ./
RUN npm run build

# ── Stage 2: Production Application Runner ─────────────────────────────
FROM mcr.microsoft.com/playwright:v1.62.1-noble

LABEL maintainer="Gengar Dark-Web OSINT"
LABEL description="Ghost in the Darknet - Ahmia Search & Hidden Service Prober"

WORKDIR /app

# Environment configuration
ENV NODE_ENV=production \
    PORT=6700 \
    HOST=0.0.0.0 \
    TOR_SOCKS=socks5h://tor:9050

# Install production backend dependencies
COPY package*.json ./
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm ci --omit=dev

# Copy application source code
COPY src/ ./src/
COPY bin/ ./bin/
COPY index.js ./

# Copy compiled frontend from Stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Ensure persistent directories exist
RUN mkdir -p /app/screenshots /app/data/scans /app/data/evidence

EXPOSE 6700

# Health check verifies Express server and API respond
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:6700/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "index.js"]
