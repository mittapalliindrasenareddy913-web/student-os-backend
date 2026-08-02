FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ─── Production image ───────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 campusos

WORKDIR /app

# Copy only production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Ensure logs directory exists and is writable
RUN mkdir -p logs && chown -R campusos:nodejs logs

USER campusos

EXPOSE 5000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "index.js"]
