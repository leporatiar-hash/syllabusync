# ─── 1. deps ────────────────────────────────────────────────────────────────
FROM node:20.11.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─── 2. builder ─────────────────────────────────────────────────────────────
FROM node:20.11.0-alpine AS builder
WORKDIR /app

# Copy deps first (layer-cached)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Copy source
COPY . .

# Build — produces .next/standalone/ with its own node_modules trace
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── 3. runner ──────────────────────────────────────────────────────────────
FROM node:20.11.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway sets PORT automatically; default to 8080 to match the healthcheck
ENV PORT=8080
# Bind to all interfaces so Railway's healthcheck can reach it
ENV HOSTNAME=0.0.0.0

# Copy the standalone output (includes its own minimal node_modules)
COPY --from=builder /app/.next/standalone ./

# Copy public/ into the standalone root so /brand/classmate-owl.png etc. are served
COPY --from=builder /app/public ./public

# Copy .next/static/ into standalone/.next/static/ — this is the piece Railpack misses.
# Next.js standalone server.js serves /_next/static/* from <CWD>/.next/static/
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080

CMD ["node", "server.js"]
