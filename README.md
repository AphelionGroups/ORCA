# ORCA

> **Personal & Business Operating System:** Milanote visual canvas + Notion documents + Google Calendar time-blocking + Linear task management, consolidated into a single, self-hostable workspace ready for an AI intelligence layer.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: MVP Development](https://img.shields.io/badge/Status-Active%20Development-orange.svg)](#project-roadmap)

---

## 📌 Executive Summary

**ORCA** is a unified workspace and operating system designed for managing the full spectrum of personal and professional life (Day Job, Personal Life, Venture A, Venture B, etc.) without losing focus or juggling fragmented tools:

1. **Multi-Domain Spaces:** Clean context isolation between employment, side businesses, and personal affairs with an instant space switcher and an aggregated *All-Spaces view*.
2. **Project Hub (Docs + Board + Tasks):** Blends three essential workflow layers into each project:
   - **Docs & Plans:** Long-form markdown strategy documents, Brand Guidelines, PRDs, and SOPs with text-to-task conversion.
   - **Spatial Board:** Freeform visual brainstorming canvas (Milanote style) with sticky notes, shapes, SVG relational connectors, and card-to-task conversion.
   - **Tasks Execution:** Linear-style Kanban and List views with priority, estimation, due dates, and drag-and-drop state transitions.
3. **Calendar & Time-Blocking:** Unified multi-space schedule view featuring task-to-calendar drag-and-drop time-blocking and *Daily Planning* rituals.
4. **Global Quick Capture (`Ctrl+K`):** Instantly captures fleeting ideas, notes, or action items into the Inbox in seconds without breaking focus.

Engineered from the ground up as a **self-host first-class citizen** with a **modular monolith** architecture and minimal resource overhead ($<30\text{ MB}$ idle backend memory footprint), ORCA runs seamlessly on home lab servers, cloud VPS instances via Docker Compose, and Kubernetes clusters (RKE).

---

## 🏗️ Core Tech Stack

| Layer | Technology | Primary Rationale |
|---|---|---|
| **Frontend App** | **SolidJS + TypeScript + Vite** | Fine-grained reactivity without Virtual DOM overhead; blazingly fast and memory-efficient for spatial canvas interactions. |
| **Styling & Components** | **Vanilla CSS (Design Tokens & CSS Variables) + Kobalte / Corvu** | Full styling flexibility, zero utility-class abstractions, peak canvas rendering performance, and complete control over custom visual aesthetics. |
| **Canvas / Board Engine** | **Custom Spatial DOM + SVG Connectors** | Milanote-inspired architecture: cards are native HTML elements (enabling native rich text and forms), while dynamic relational lines are rendered via an SVG layer. |
| **Backend API** | **Go (Golang)** | Single static binary, tiny RAM footprint ($\sim 15\text{--}30\text{ MB}$), native goroutine concurrency for sync workers, and zero maintenance overhead. |
| **Database** | **PostgreSQL** | Strong relational integrity, `JSONB` columns for flexible canvas block payloads, and time-ordered UUIDv7 as the primary key standard. |
| **Deployment** | **Docker Compose & Helm (Kubernetes RKE)** | Portable container distribution, friendly for home labs, self-hosters, and enterprise clusters. |

---

## 🗺️ Project Roadmap

```
┌───────────────────────────────────────────────────────────┐
│                    ORCA PROJECT ROADMAP                   │
└───────────────────────────────────────────────────────────┘
                           │
                           ▼
  [ v0.1 — Core MVP (Current Focus) ]
  • Go Modular Monolith API + PostgreSQL (Auth, Spaces, Projects, Docs, Tasks, Calendar, Boards).
  • SolidJS SPA Shell (Sidebar Context Switcher, Global Quick Capture Ctrl+K).
  • Spaces Management (Day Job, Personal, Venture A, Venture B, All-Spaces View).
  • Project Hub:
    - Tab Docs & Plans (Long-form Markdown, Brand Doc, PRD, Activity Plan, Text-to-Task).
    - Tab Spatial Board (Milanote Canvas, Draggable Cards, Sticky Notes, SVG Connector Arrows, Card-to-Task).
    - Tab Tasks (Kanban, List View, Status, Priority, Due Date, Subtasks).
  • Calendar View & Time-Blocking (Task-to-Calendar drag & drop + Daily Planning ritual).
  • Dual-mode Docker Compose deployment (Local Dev vs Cloud Production).
                           │
                           ▼
  [ v0.2 — Brainstorming & Tablet Expansion ]
  • Freehand Pen / Stylus layer powered by `perfect-freehand` on SVG canvas.
  • Tablet gesture optimizations (Palm rejection, pinch-to-zoom, Apple Pencil / S-Pen).
  • Unified Cross-linking inspector (Task ↔ Note Card ↔ Calendar Event).
                           │
                           ▼
  [ v0.3 — Local-First & Synchronization ]
  • Local-first engine (IndexedDB cache in client browser).
  • Background CRDT / delta sync engine for zero-latency editing and full offline support.
                           │
                           ▼
  [ v0.4 — AI Intelligence Layer (External Agent) ]
  • Letta AI / Agent Core integration via external worker service.
  • Daily planner executive summary & context ingestion from notes + schedule + tasks.
                           │
                           ▼
  [ v1.0 — Open Source Release & RKE Helm Chart ]
  • Production Helm Chart for Kubernetes / RKE.
  • Comprehensive self-hosting and backup automation documentation.
```

---

## 📚 Documentation Index

All system specifications and design guidelines are organized in the [`docs/`](docs/) directory:

- **[Security & Upgrade Guide](docs/security-upgrade.md):** Required JWT configuration, tenant isolation, versioned migrations, upload persistence, and validation.
- **[Self-Hosting & Deployment Guide](docs/self-hosting-guide.md):** Complete guide for installing ORCA locally, on VPS instances, with Supabase, Cloud Redis, and SSL reverse proxies.
- **[Context & Design Philosophy](docs/context.md):** Background problems, architectural principles, and long-term product vision.
- **[System & Architecture Specification](docs/spec.md):** Detailed frontend architecture, backend modular layout, database schema, and communication patterns.
- **[Functional Requirements (FR)](docs/functional-requirements.md):** Granular functional requirements by module (Tasks, Calendar, Board, Project Hub, Auth).
- **[Development & Contribution Guide](docs/development-guide.md):** Coding standards, project layout, git workflow, and developer setup.
- **[Architecture Decision Records (ADR)](docs/adr/):** Historical log of significant technical choices:
  - [ADR 0001: Record Architecture Decisions](docs/adr/0001-record-architecture-decisions.md)
  - [ADR 0002: SolidJS Frontend & Custom Spatial DOM Canvas](docs/adr/0002-frontend-solidjs-and-spatial-dom.md)
  - [ADR 0003: Go Modular Monolith Backend](docs/adr/0003-backend-go-modular-monolith.md)
  - [ADR 0004: Data Architecture: UUIDv7 & Local-First Readiness](docs/adr/0004-data-architecture-uuidv7-and-future-sync.md)
  - [ADR 0005: Defer AI Layer & Local-First for MVP](docs/adr/0005-defer-ai-and-local-first-for-mvp.md)
  - [ADR 0006: Tablet Stylus & Pen Input Architecture](docs/adr/0006-future-tablet-stylus-architecture.md)

---

## 🚀 Quickstart & Deployment (Dev vs Prod)

ORCA features an **intelligent Docker Compose setup**: the launch command remains identical (`docker compose up -d --build`), while the runtime environment automatically adapts between local development and cloud production:

### 1. Local Development (All-in-One Local Stack)
In local development, Docker Compose automatically overlays [`compose.override.yml`](compose.override.yml) onto [`compose.yml`](compose.yml):
- Starts local **PostgreSQL 16** and **Redis 7** containers with database schemas and demo seed data automatically applied.
- Starts **API (Go)** and **Web Frontend (Nginx/SolidJS)**.

```bash
# Clone the repository
git clone https://github.com/AphelionGroups/ORCA.git
cd ORCA

# Launch local dev environment (PostgreSQL, Redis, Go API, Frontend)
docker compose up -d --build
```

### 2. Production Deployment (Cloud PostgreSQL / Supabase + Cloud Redis)
On production servers, deploy **only** [`compose.yml`](compose.yml) (do not copy or include `compose.override.yml`):
- Runs **only** the lightweight **API** and **Web** containers ($<50\text{ MB}$ total idle RAM).
- Connects to external managed databases like **Supabase** via `DATABASE_URL`.
- Connects to external cache providers like **Upstash** via `REDIS_URL`.
- Simply configure `.env` (refer to [`.env.example`](.env.example)) and run the exact same command:

```bash
# In production, explicitly exclude the development override:
docker compose -f compose.yml up -d --build
```

> 📖 **Full Deployment Guide:** For step-by-step Supabase setup, Cloud Redis, Caddy/Nginx reverse proxy, and SSL, see the **[Self-Hosting Guide](docs/self-hosting-guide.md)**.

---

## 🌐 Service Access Endpoints

| Component | Default URL / Port | Description |
|---|---|---|
| **Web Frontend (Operating System)** | [`http://localhost:3000`](http://localhost:3000) | SolidJS SPA interface with dark obsidian theme & reverse proxy `/api/`. |
| **Backend REST API** | [`http://localhost:8080/api/v1`](http://localhost:8080/api/v1) | Go Modular Monolith API. Healthcheck available at `/healthz`. |
| **PostgreSQL Database (Dev Only)** | `localhost:5432` | User: `orca`, Pass: `orca_secret`, DB: `orca_db`. Auto-seeded with demo data. |
| **Redis Cache (Dev Only)** | `localhost:6379` | Local in-memory cache and pub/sub broker. |

> **Authentication and tenancy:** Requests use a Bearer JWT. The workspace comes from the signed token; an optional `X-Workspace-ID` must match it. Each registration creates a separate workspace. Production requires a unique `JWT_SECRET` of at least 32 bytes. See the [security upgrade guide](docs/security-upgrade.md) before deployment.

---

## 🧪 Automated Testing & Health Verification

Validate all backend API endpoints and frontend assets automatically:

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File ./scripts/verify_e2e.ps1

# Linux / macOS (Bash)
chmod +x ./scripts/verify_e2e.sh
./scripts/verify_e2e.sh
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).