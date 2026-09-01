# Multi-stage production Dockerfile for Bot Telegram VPN
# Stage 1: Build TypeScript and compile native dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for native addons (sqlite3, ssh2)
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source and scripts
COPY src ./src
COPY scripts ./scripts

# Build TypeScript to ./dist and copy frontend assets
RUN node scripts/build-clean.js

# Prune devDependencies to keep only production modules
RUN npm prune --omit=dev && npm cache clean --force

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Install tini for proper init process & signal handling
RUN apk add --no-cache tini sqlite

ENV NODE_ENV=production
ENV PORT=50123
ENV DB_DIR=/app/data
ENV DB_PATH=/app/data/botvpn.db

# Copy package manifests
COPY package*.json ./

# Copy pre-built production node_modules from builder stage (zero runtime rebuild required)
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled dist, index.js, and helper files
COPY --from=builder /app/dist ./dist
COPY index.js ecosystem.config.js ./
COPY scripts ./scripts

# Create data directory for SQLite persistence
RUN mkdir -p /app/data /app/logs

# Expose web config / webhook port
EXPOSE 50123

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:50123/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
