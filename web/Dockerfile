# =========================================================
# ORCA Frontend SolidJS SPA - Production Dockerfile
# Multi-stage build with Nginx reverse proxy
# =========================================================

# --- Stage 1: Build Static Assets ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# In production container, API is served via Nginx reverse proxy at /api/v1
ENV VITE_API_URL=/api/v1

RUN npm run build

# --- Stage 2: Production Nginx Server ---
FROM nginx:alpine

# Remove default nginx html
RUN rm -rf /usr/share/nginx/html/*

# Copy built SPA assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
