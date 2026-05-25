# ============================================================
# Orbit Escape TMA — Dockerfile
# ============================================================
# Build:    docker build -t orbit-escape-tma .
# Run:      docker run -p 3000:3000 --env-file .env orbit-escape-tma
# ============================================================

# Use official Node LTS slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies first (cached layer unless package.json changes)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Remove .env if accidentally included (secrets come from runtime env vars)
RUN rm -f .env

# Create non-root user for security
RUN groupadd -r orbit && useradd -r -g orbit orbit
RUN chown -R orbit:orbit /app
USER orbit

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server
CMD ["node", "server.js"]
