# Multi-stage Dockerfile for LinkedIn Post Scheduler
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies (root, server, client)
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# Copy source code
COPY . .

# Build Vite frontend to client/dist
RUN cd client && npm run build

# ─── Production Runner ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy built frontend, server, and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist

# Create persistent data directory for SQLite
RUN mkdir -p /app/server/data

VOLUME ["/app/server/data"]

EXPOSE 3001

CMD ["node", "server/index.js"]
