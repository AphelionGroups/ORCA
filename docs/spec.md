# System & Architecture Specification

This document details the technical specifications, system architecture, database schema, and component communication patterns for **ORCA**.

---

## 1. High-Level Architecture

```
                     ┌───────────────────────────────────────────────┐
                     │           SolidJS SPA (Web/Tablet)            │
                     │  - Multi-Domain Space Switcher (Work/Venture) │
                     │  - Global Quick Capture Modal (Ctrl + K)      │
                     │  - Project Hub (Docs + Board + Tasks)         │
                     │  - Custom Spatial DOM Canvas + SVG Connectors │
                     │  - Unified Calendar & Daily Planning Ritual   │
                     │  - Vanilla CSS Design Tokens + Kobalte        │
                     └───────────────────────┬───────────────────────┘
                                             │ HTTPS / REST (JSON)
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │              ORCA Core API (Go)               │
                     │              (Modular Monolith)               │
                     │  ┌─────────────────────────────────────────┐  │
                     │  │ Auth & Workspace Module (Tenant Scoping)│  │
                     │  ├─────────────────────────────────────────┤  │
                     │  │ Spaces & Domain Context Module          │  │
                     │  ├─────────────────────────────────────────┤  │
                     │  │ Project Hub & Business Documents Module │  │
                     │  ├─────────────────────────────────────────┤  │
                     │  │ Task & Project Execution Module         │  │
                     │  ├─────────────────────────────────────────┤  │
                     │  │ Calendar, Time-Blocking & Daily Planner │  │
                     │  ├─────────────────────────────────────────┤  │
                     │  │ Spatial Board & Milanote Canvas Module  │  │
                     │  ├─────────────────────────────────────────┤  │
                     │  │ Universal Cross-Link Engine             │  │
                     │  └─────────────────────────────────────────┘  │
                     │  ┌─────────────────────────────────────────┐  │
                     │  │ Background Sync Worker (Calendar Sync)  │  │
                     │  └─────────────────────────────────────────┘  │
                     └───────────────┬───────────────┬───────────────┘
                                     │               │
                                     ▼               ▼
                           ┌──────────────────┐  ┌─────────────┐
                           │    PostgreSQL    │  │ Redis (Ops) │
                           │(Supabase / Local)│  │  (Queue /   │
                           │ (UUIDv7 + JSONB) │  │   Locking)  │
                           └──────────────────┘  └─────────────┘
                                     ▲
                                     │ (Future Phase)
                           ┌─────────┴────────┐
                           │ AI Worker Service│
                           │ (Letta Runtime)  │
                           └──────────────────┘
```

---

## 2. Frontend Architecture (SolidJS)

### A. Rationale for SolidJS
- **Fine-Grained Reactivity:** Reactivity without Virtual DOM overhead. Component functions execute only once upon mounting; signal mutations update DOM nodes directly and in complete isolation.
- **Spatial Canvas Performance:** When dozens or hundreds of cards shift coordinates `(x, y)`, SolidJS only modifies the CSS attribute `transform: translate3d(x, y, 0)` without triggering expensive re-renders inside the cards (rich text editors, checklists, images).

### B. Spatial DOM Canvas Design (Milanote Pattern)
ORCA's canvas is **not a raster or bitmap canvas**; it is an optimized **Spatial DOM Board**:
1. **Viewport Container:** Manages pan and zoom gestures via CSS `transform: scale(z) translate(x, y)` on the primary container div.
2. **Card Layer (HTML):** Every node (sticky note, task card, image, text block) is a standard HTML `div`. This allows the application to retain native browser accessibility, text selection, spell-checking, and interactive forms.
3. **Connector Layer (SVG):** A transparent SVG overlay renders dynamic Bézier curves and relational lines between connector anchor points across cards.

### C. The "Project Hub" UI Paradigm
Every project integrates three concurrent views sharing an identical data context:
- **Docs & Plans Tab:** Rich Markdown document authoring for strategies, SOPs, and PRDs, featuring direct text-to-task conversion.
- **Spatial Board Tab:** Freeform visual canvas for moodboards, idea graphs, and mind maps; canvas cards convert into tasks with one click.
- **Tasks Tab:** Linear-style execution interface (Kanban board & List view) aggregating all tasks created from documents or boards.

### D. Global Quick Capture & Daily Planning
- **Quick Capture Modal (`Ctrl+K`):** Global modal triggerable anywhere to capture thoughts into the Inbox without disrupting current work.
- **Daily Planning Ritual Drawer:** A side drawer allowing users to drag and drop priority tasks directly into open calendar slots.

---

## 3. Backend Architecture (Go)

### A. Rationale for Go
- **Minimal Resource Footprint:** Idle RAM consumption is only $\sim 15\text{--}30\text{ MB}$, making it exceptionally well-suited for low-cost VPS instances or lightweight Kubernetes clusters.
- **Single Static Binary:** Clean compilation producing lightweight container images under $25\text{ MB}$.
- **Native Concurrency:** Goroutines provide lightweight scheduling for background sync routines without requiring complex external brokers.

### B. Modular Monolith Layout
The Go backend is structured using domain-driven packaging:
```
cmd/
  server/               # HTTP API entrypoint
  migrate/              # Database migration CLI
internal/
  platform/             # Database connection pools, config, logging, middleware
  workspace/            # Workspace domain & tenant scoping
  space/                # Spaces domain (Day Job, Personal, Ventures)
  auth/                 # Authentication & session domain
  doc/                  # Business documents & markdown domain
  project/              # Project Hub coordination domain
  task/                 # Task & Kanban execution domain
  calendar/             # Events, time-blocking & calendar sync domain
  board/                # Spatial canvas & note blocks domain
  link/                 # Universal polymorphic cross-link domain
```

---

## 4. Database Schema (PostgreSQL)

All primary keys use **UUIDv7** (time-ordered, B-Tree index friendly, and safely client-generatable). All core entities enforce `workspace_id` for multi-tenant isolation and row-level security, alongside `created_at`, `updated_at`, and `deleted_at` timestamps for auditing and future sync readiness.

### A. Tenancy, Users & Spaces
```sql
-- Workspace Boundary (Tenant Isolation)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY, -- UUIDv7
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Spaces: Context partition (Day Job, Personal, Ventures)
CREATE TABLE spaces (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'briefcase',
    color VARCHAR(20) DEFAULT '#3b82f6',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT unique_space_slug_per_workspace UNIQUE(workspace_id, slug)
);
```

### B. Project Hub & Documentation Layer
```sql
-- Projects: Initiative containers housing Docs, Boards, and Tasks
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'planning', 'active', 'on_hold', 'completed', 'archived'
    target_date TIMESTAMPTZ,
    kanban_columns JSONB NOT NULL DEFAULT '["Backlog", "Todo", "In Progress", "Done"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Documents: Long-form strategy docs (Brand Guidelines, PRDs, SOPs)
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL DEFAULT 'general', -- 'brand_guideline', 'prd', 'activity_plan', 'sop', 'general'
    content TEXT NOT NULL DEFAULT '',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### C. Spatial Canvas & Brainstorming Board
```sql
-- Note Boards: 2D Spatial Canvases
CREATE TABLE note_boards (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    viewport_state JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Note Blocks: Canvas elements (Sticky notes, text, shapes, media, task embeds)
CREATE TABLE note_blocks (
    id UUID PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES note_boards(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'sticky', 'text', 'card', 'image', 'task_embed'
    pos_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    width DOUBLE PRECISION,
    height DOUBLE PRECISION,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### D. Tasks & Time-Blocking Calendar
```sql
-- Tasks: Execution items (supporting Inbox triage and Daily Planning)
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- NULL indicates Inbox status
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE, -- Subtasks
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'done', 'cancelled'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    due_date TIMESTAMPTZ,
    planned_date DATE,
    estimated_minutes INT, -- Time-blocking estimate
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Events: Calendar schedule and time-block allocations
CREATE TABLE events (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
    linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- Bound task for time-blocking
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    external_provider VARCHAR(50), -- 'google_calendar'
    external_event_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### E. Universal Cross-Link Engine
```sql
-- Generic polymorphic link engine connecting arbitrary entity pairs
CREATE TABLE entity_links (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_type VARCHAR(50) NOT NULL, -- 'document', 'note_block', 'task', 'event', 'note_board'
    from_id UUID NOT NULL,
    to_type VARCHAR(50) NOT NULL,
    to_id UUID NOT NULL,
    relation_type VARCHAR(50) NOT NULL DEFAULT 'relates_to', -- 'converted_to', 'connects_to', 'blocks', 'timeblocks'
    metadata JSONB DEFAULT '{}'::jsonb, -- SVG line handles, anchors, curve parameters
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_entity_link UNIQUE(workspace_id, from_type, from_id, to_type, to_id, relation_type)
);
```

---

## 5. Deployment Topology (Dev vs Production)

ORCA adopts a dual-tier Docker Compose architecture:
1. **Local Development (`compose.yml` + `compose.override.yml`):**
   - Automatically provisions local `postgres:16-alpine` and `redis:7-alpine`.
   - Mounts migration and demo seed scripts on initial start.
2. **Production (`compose.yml` only):**
   - Runs exclusively the `api` and `web` containers.
   - Connects to managed external cloud databases (**Supabase**) and Redis (**Upstash**).
   - Zero excess resource consumption on host servers.
