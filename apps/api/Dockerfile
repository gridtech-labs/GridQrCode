# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all deps (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build TypeScript
RUN pnpm --filter api build

# ── Stage 2: Production ───────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm for production install
RUN corepack enable && corepack prepare pnpm@latest --activate

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 apiuser

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built output from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared ./packages/shared

# Create uploads dir for local dev fallback
RUN mkdir -p ./apps/api/public/uploads && chown -R apiuser:nodejs ./apps/api/public

USER apiuser

WORKDIR /app/apps/api

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
