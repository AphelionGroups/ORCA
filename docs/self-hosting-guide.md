> **Security update:** Read [Security and deployment upgrade](security-upgrade.md) before following this guide. Production requires a unique `JWT_SECRET`; fresh production databases have no demo user; registration creates isolated workspaces; run all versioned migrations through the API or migration CLI. Redis is currently an optional provisioned service and is not used by the API.

# ORCA Self-Hosting & Deployment Guide

This guide provides comprehensive, step-by-step instructions for installing and running **ORCA** in self-hosted environments—from local home labs to cloud VPS instances and production Kubernetes clusters.

---

## 📋 Table of Contents
- [Architecture & Deployment Models](#architecture--deployment-models)
- [System Requirements](#system-requirements)
- [Quickstart: Local Development / All-in-One](#quickstart-local-development--all-in-one)
- [Production Deployment (Supabase & Cloud Redis)](#production-deployment-supabase--cloud-redis)
  - [1. Database Setup (Supabase / Cloud PostgreSQL)](#1-database-setup-supabase--cloud-postgresql)
  - [2. Redis Setup (Upstash / Cloud Redis)](#2-redis-setup-upstash--cloud-redis)
  - [3. Server Configuration (.env)](#3-server-configuration-env)
  - [4. Launch with Docker Compose](#4-launch-with-docker-compose)
- [Reverse Proxy & SSL Configuration](#reverse-proxy--ssl-configuration)
  - [Option A: Caddy (Automatic HTTPS)](#option-a-caddy-automatic-https)
  - [Option B: Nginx](#option-b-nginx)
  - [Option C: Cloudflare Tunnel (Zero-Trust)](#option-c-cloudflare-tunnel-zero-trust)
- [Environment Variables Reference](#environment-variables-reference)
- [Database Migrations & Seeding](#database-migrations--seeding)
- [Backup and Restore](#backup-and-restore)
- [Troubleshooting & Healthchecks](#troubleshooting--healthchecks)

---

## 🏗️ Architecture & Deployment Models

ORCA utilizes an intelligent Docker Compose structure that keeps commands identical across environments while tailoring the running services:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE TOPOLOGY                         │
└────────────────────────────────────────────────────────────────────────┘

    [ Local Development ]                   [ Production / Cloud ]
     `docker compose up`                     `docker compose up`
     (compose.yml + override)                (compose.yml only + .env)
             │                                        │
    ┌────────┴────────┐                      ┌────────┴────────┐
    │  orca-web (SPA) │                      │  orca-web (SPA) │
    └────────┬────────┘                      └────────┬────────┘
             │ reverse proxy                          │ reverse proxy
    ┌────────┴────────┐                      ┌────────┴────────┐
    │  orca-api (Go)  │                      │  orca-api (Go)  │
    └───┬──────────┬──┘                      └───┬──────────┬──┘
        │          │                             │          │
        ▼          ▼                             ▼          ▼
 ┌────────────┐ ┌───────────┐             ┌────────────┐ ┌─────────────┐
 │  orca-db   │ │orca-redis │             │  Supabase  │ │ Cloud Redis │
 │ (Postgres) │ │ (Cache)   │             │ (Managed)  │ │  (Upstash)  │
 └────────────┘ └───────────┘             └────────────┘ └─────────────┘
```

1. **Local Development Mode (`compose.override.yml`):**
   - Automatically merges with `compose.yml`.
   - Spawns local PostgreSQL 16 and Redis 7 containers.
   - Automatically migrates the schema and loads sample demo seed data.
2. **Production Mode (`compose.yml` only):**
   - Omits `compose.override.yml`.
   - Runs **only** the `api` (Go modular monolith) and `web` (SolidJS Nginx SPA) containers.
   - Connects to managed external cloud databases (e.g. Supabase, AWS RDS) and Redis (e.g. Upstash, Redis Cloud).
   - Extremely resource-efficient: idle memory footprint is $<50\text{ MB}$ total.

---

## 💻 System Requirements

| Specification | Minimum (Dev / Single-user) | Recommended (Production / Team) |
|---|---|---|
| **CPU** | 1 vCPU / Core | 2 vCPU |
| **RAM** | 512 MB (Production with Cloud DB) / 1 GB (Local DB) | 2 GB |
| **Disk Space** | 2 GB free disk space | 10 GB SSD |
| **Operating System** | Linux (Ubuntu, Debian, Alpine), macOS, Windows | Ubuntu 22.04 LTS or Alpine Linux |
| **Software** | Docker Engine 24.0+ & Docker Compose v2.20+ | Docker Engine & Docker Compose |

---

## ⚡ Quickstart: Local Development / All-in-One

To run ORCA with all dependencies (including local PostgreSQL and Redis) self-contained on your local machine:

```bash
# 1. Clone the repository
git clone https://github.com/AphelionGroups/ORCA.git
cd ORCA

# 2. Start all services (Database, Redis, API, Web)
docker compose up -d --build

# 3. Verify services are healthy
docker compose ps
```

Once running:
- **Web Interface:** [http://localhost:3000](http://localhost:3000)
- **API Healthcheck:** [http://localhost:8080/healthz](http://localhost:8080/healthz)
- **API Base URL:** [http://localhost:8080/api/v1](http://localhost:8080/api/v1)

---

## 🚀 Production Deployment (Supabase & Cloud Redis)

In production, you want high availability, automated backups, and minimal server load. Using **Supabase** for PostgreSQL and **Upstash** (or similar) for Redis provides enterprise-grade infrastructure with minimal cost.

### 1. Database Setup (Supabase / Cloud PostgreSQL)

1. Create a project in [Supabase](https://supabase.com).
2. Go to **Project Settings** $\rightarrow$ **Database** $\rightarrow$ **Connection string**.
3. Select **URI** mode:
   - For pooled connections (recommended): use port `6543` (Transaction Pooler).
   - Example:
     ```
     postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
     ```
4. Run the initial database migration:
   - **Method A (Supabase SQL Editor):** Apply all migrations in filename order, or preferably use `AUTO_MIGRATE=true` / `go run ./cmd/migrate` so versions are tracked. Applying only the initial schema is insufficient.
   - **Method B (ORCA Migrate CLI):**
     ```bash
     DATABASE_URL="postgres://postgres.[REF]:[PASS]@[HOST]:6543/postgres?sslmode=require" go run ./cmd/migrate/main.go
     ```

### 2. Redis Setup (Upstash / Cloud Redis)

1. Create a serverless Redis database on [Upstash](https://upstash.com) or Redis Cloud.
2. Retrieve the `REDIS_URL` connection string:
   ```
   rediss://default:[PASSWORD]@[ENDPOINT]:6379
   ```

### 3. Server Configuration (.env)

On your production server, prepare a `.env` file in the project directory:

```ini
# =========================================================
# ORCA Production Environment Configuration
# =========================================================
PORT=8080
ENV=production

# Supabase PostgreSQL Connection String
DATABASE_URL=postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require

# Cloud Redis Connection String
REDIS_URL=rediss://default:[PASSWORD]@[ENDPOINT]:6379

# Port Bindings
API_PORT=8080
WEB_PORT=3000

# CORS & Allowed Domains
CORS_ALLOWED_ORIGINS=https://orca.yourdomain.com,http://localhost:3000

# Connection Pool Tuning
DB_MAX_CONNS=25
DB_MIN_CONNS=5
DB_MAX_CONN_LIFETIME=1h
```

### 4. Launch with Docker Compose

Ensure **only** `compose.yml` is used (do not copy or include `compose.override.yml` on the production server):

```bash
# Start production containers (API & Web frontend only)
docker compose up -d --build

# Inspect running containers
docker compose ps
```

---

## 🔒 HTTPS & Reverse Proxy Options

By default, the ORCA web frontend container serves pure HTTP on port `3000` (or `80`), keeping container images lightweight and free of certificate bloat. SSL/TLS termination is typically handled at the infrastructure/network layer:

### Option A: Cloudflare Tunnel (Zero-Trust - Recommended for Homelab / CGNAT)

If your server runs behind home internet, CGNAT, or you do not want to expose open ports to the internet:
1. In Cloudflare Zero Trust (**Networks** $\rightarrow$ **Tunnels**), create or use an existing tunnel.
2. In **Public Hostname**, configure your domain to point to your local service:
   - **Service Type:** `HTTP`
   - **URL:** `localhost:3000` (or your container IP/port)
3. Cloudflare automatically handles edge SSL, DDoS protection, and routing without needing open ports or SSL certificates on your host.

---

### Option B: Caddy (Automatic HTTPS)

Create a `Caddyfile`:

```caddy
orca.yourdomain.com {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-Proto https
    }
}
```

Run Caddy:
```bash
caddy run --config Caddyfile
```

### Option B: Host Nginx

Create `/etc/nginx/sites-available/orca.conf`:

```nginx
server {
    listen 80;
    server_name orca.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name orca.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/orca.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/orca.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option C: Cloudflare Tunnel (Zero-Trust)

If you don't want to open ports 80/443 on your firewall:
1. Install `cloudflared`.
2. Configure tunnel routing:
   ```yaml
   ingress:
     - hostname: orca.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
3. Run the tunnel: `cloudflared tunnel run orca`.

---

## ⚙️ Environment Variables Reference

| Variable | Default (Dev) | Description |
|---|---|---|
| `PORT` | `8080` | Internal port the Go HTTP API binds to. |
| `ENV` | `development` | Runtime environment (`development` or `production`). |
| `DATABASE_URL` | `postgres://orca:orca_secret@localhost:5432/orca_db?sslmode=disable` | PostgreSQL connection URI. Supports Supabase, RDS, local Postgres. |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URI (supports `redis://` or `rediss://` for TLS). |
| `API_PORT` | `8080` | Host port mapped to the API container. |
| `WEB_PORT` | `3000` | Host port mapped to the Nginx frontend container. |
| `CORS_ALLOWED_ORIGINS`| `http://localhost:3000,...` | Comma-separated list of allowed origins for browser access. |
| `DB_MAX_CONNS` | `25` | Maximum active PostgreSQL pool connections. |
| `DB_MIN_CONNS` | `5` | Minimum idle PostgreSQL pool connections. |
| `DB_MAX_CONN_LIFETIME`| `1h` | Maximum lifetime of a database connection before being recycled. |

---

## 🗄️ Database Migrations & Seeding

Migrations are located in [`migrations/`](../migrations/):
- `000001_init_schema.up.sql`: Core schema (Workspaces, Users, Spaces, Projects, Documents, Boards, Blocks, Tasks, Events, Links).
- `000001_init_schema.down.sql`: Rollback script.
- `scripts/seed_demo.sql`: Demo dataset with sample Spaces (`🏢 Day Job`, `👤 Personal`, `🚀 Aphelion Labs`, `📈 E-Commerce`), boards, and tasks.

To apply migrations manually:
```bash
# Using Go Migrate CLI
DATABASE_URL="your-connection-string" go run ./cmd/migrate/main.go
```

---

## 💾 Backup and Restore

### Automated PostgreSQL Backup (Local Docker)
```bash
# Backup
docker exec -t orca-db pg_dump -U orca orca_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
cat backup.sql | docker exec -i orca-db psql -U orca -d orca_db
```

### Supabase Backup
Supabase provides automated daily backups via its dashboard under **Project Settings** $\rightarrow$ **Backups**. For manual dumps:
```bash
pg_dump "postgres://postgres.[ref]:[pass]@[host]:6543/postgres?sslmode=require" -F c -b -v -f orca_supabase_backup.dump
```

---

## 🩺 Troubleshooting & Healthchecks

### 1. Healthcheck Endpoints
- **API Health:**
  ```bash
  curl -s http://localhost:8080/healthz | jq
  ```
  Expected output:
  ```json
  {
    "app": "ORCA",
    "database": "connected",
    "status": "ok",
    "uptime": "5m12s"
  }
  ```
- **Web Nginx Health:**
  ```bash
  curl -i http://localhost:3000/healthz
  # Expected: HTTP/1.1 200 OK -> healthy
  ```

### 2. Common Issues & Solutions

- **Issue: `Database is unreachable` on API startup**
  - *Fix:* Ensure PostgreSQL is accepting connections. If using Supabase, make sure `?sslmode=require` is appended to the connection string and check that project pausing is disabled.
- **Issue: CORS errors in browser console**
  - *Fix:* Add your public frontend domain to `CORS_ALLOWED_ORIGINS` in your `.env` file (e.g., `https://orca.yourdomain.com`).
- **Issue: Local Postgres port 5432 conflict**
  - *Fix:* If you already have a local PostgreSQL running on your host, change `POSTGRES_PORT=5433` in your `.env` file.
