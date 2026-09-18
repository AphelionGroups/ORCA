# Spesifikasi Sistem & Arsitektur

Dokumen ini mendokumentasikan spesifikasi teknis, arsitektur sistem, skema basis data, dan pola komunikasi antar komponen untuk **ORCA**.

---

## 1. Arsitektur Tingkat Tinggi

```
                     ┌───────────────────────────────────────────────┐
                     │           SolidJS SPA (Web/Tablet)            │
                     │  - Multi-Domain Space Switcher (Kantor/Bisnis)│
                     │  - Global Quick Capture Modal (Ctrl + K)      │
                     │  - Project Hub (Docs + Board + Tasks)         │
                     │  - Custom Spatial DOM Canvas + SVG Connectors │
                     │  - Unified Calendar & Daily Planning Ritual   │
                     │  - Tailwind CSS + Kobalte Primitives          │
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
                     │  │ Background Sync Worker (Google Cal Sync)│  │
                     │  └─────────────────────────────────────────┘  │
                     └───────────────┬───────────────┬───────────────┘
                                     │               │
                                     ▼               ▼
                           ┌──────────────────┐  ┌─────────────┐
                           │    PostgreSQL    │  │ Redis (Ops) │
                           │  (Primary Store) │  │  (Queue/    │
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

## 2. Arsitektur Frontend (SolidJS)

### A. Alasan Pemilihan SolidJS
- **Fine-Grained Reactivity:** Reaktivitas tanpa Virtual DOM. Fungsi komponen hanya dipanggil 1 kali saat mount; pembaruan sinyal langsung mengubah DOM node secara terisolasi.
- **Performa Canvas Spatial:** Saat ratusan kartu berpindah koordinat (`x, y`), SolidJS hanya memperbarui atribut CSS `transform: translate3d(x, y, 0)` kartu tersebut tanpa memicu re-render pada isi kartu (rich text editor, checklist, gambar).

### B. Desain Spatial DOM Board (Milanote Pattern)
Canvas ORCA **bukan canvas bitmap/raster**, melainkan **Spatial DOM Board**:
1. **Viewport Container:** Mengelola gesture pan dan zoom (menggunakan CSS `transform: scale(z) translate(x, y)` pada div container utama).
2. **Card Layer (HTML):** Setiap kartu (sticky note, task card, image, text) adalah elemen `div` biasa. Hal ini memungkinkan pemanfaatan fitur native browser seperti text selection, accessibility, spellcheck, dan embed komponen form interaktif.
3. **Connector Layer (SVG):** Layer SVG transparan di belakang/atas kartu yang menggambar kurva Bézier atau garis ortogonal yang menghubungkan titik-titik konektor antar kartu secara reaktif.

### C. Pola Antarmuka "Project Hub"
Setiap proyek menyajikan tiga tampilan terintegrasi yang berbagi konteks data yang sama:
- **Tab Docs & Plans:** Editor dokumen kaya (Markdown) untuk strategi, SOP, PRD, dan rencana aktivitas dengan kemampuan menyorot teks untuk langsung dijadikan task (*text-to-task*).
- **Tab Spatial Board:** Papan kanvas visual untuk brainstorming, moodboard, dan diagram alur; kartu di kanvas dapat dikonversi menjadi task dengan satu klik (*card-to-task*).
- **Tab Tasks:** Tampilan eksekusi (Kanban board & List view) yang menampung seluruh task yang lahir dari dokumen maupun kanvas.

### D. Global Quick Capture & Daily Planning
- **Quick Capture Modal (`Ctrl+K`):** Komponen modal global yang dapat dipanggil di layar mana pun untuk memasukkan ide kilat ke dalam Inbox tanpa memecah alur kerja yang sedang aktif.
- **Daily Planning Ritual Drawer/View:** Tampilan samping kalender di mana pengguna menarik (*drag-and-drop*) daftar tugas prioritas hari ini ke dalam slot waktu kalender.

---

## 3. Arsitektur Backend (Go)

### A. Alasan Pemilihan Go
- **Resource Footprint Sangat Rendah:** Konsumsi RAM idle hanya ~15–30 MB, menjadikannya sangat ideal untuk self-host di VPS atau cluster Kubernetes berspesifikasi minimal.
- **Single Static Binary:** Proses deployment sangat sederhana, menghasilkan Docker image berbasis Alpine/Distroless berukuran < 25 MB.
- **Goroutine & Concurrency Native:** Penjadwalan background worker (seperti sync rutin Google Calendar) tidak membutuhkan dependency tambahan yang rumit.

### B. Struktur Internal Modular Monolith
Backend Go diatur menggunakan struktur modular berbasis domain (*Domain-Driven Packaging*):
```
cmd/
  server/               # Entrypoint HTTP API
internal/
  platform/             # Database, config, logger, middleware
  workspace/            # Domain Workspace & Tenant Scoping
  space/                # Domain Spaces (Kantor, Pribadi, Bisnis A, Bisnis B)
  auth/                 # Domain Autentikasi (Session / JWT)
  doc/                  # Domain Business Documents & Knowledge Base
  project/              # Domain Project Hub & Koordinasi Inisiatif
  task/                 # Domain Task & Kanban Management
  calendar/             # Domain Event, Time-blocking & Google Calendar Sync
  board/                # Domain Spatial Board & Note Blocks
  link/                 # Domain Cross-linking relasional
```

## 4. Skema Basis Data (PostgreSQL)

Semua tabel menggunakan **UUIDv7** sebagai Primary Key (time-ordered, terurut waktu, ramah indexing B-Tree, dan aman di-generate di sisi client). Seluruh entitas utama memiliki `workspace_id` untuk isolasi tenant & Row-Level Security (RLS), serta `created_at`, `updated_at`, dan `deleted_at` untuk audit & kesiapan sinkronisasi.

### A. Identitas, Multi-Tenancy & Spaces
```sql
-- Ruang lingkup akun utama (Tenant Boundary)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY, -- UUIDv7
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Pengguna sistem
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

-- Spaces: Pemisah peran kehidupan/pekerjaan (Kantor, Pribadi, Bisnis A, Bisnis B)
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

### B. Project Hub & Planning Layer
```sql
-- Projects: Wadah inisiatif yang menaungi Docs, Boards, dan Tasks
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

-- Documents: Dokumen bisnis panjang (Brand Guidelines, PRD, Activity Plan, SOP)
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Nullable: Dokumen proyek atau dokumen mandiri Space
    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL DEFAULT 'general', -- 'brand_guideline', 'prd', 'activity_plan', 'sop', 'general'
    content TEXT NOT NULL DEFAULT '',                -- Format Markdown / Rich Content
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### C. Spatial Brainstorming Board (Milanote Pattern)
```sql
-- Note Boards: Kanvas spatial 2D
CREATE TABLE note_boards (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Nullable: Kanvas proyek atau kanvas mandiri Space
    title VARCHAR(255) NOT NULL,
    viewport_state JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Note Blocks: Komponen kartu di kanvas (Sticky notes, gambar, teks, embed)
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

### D. Tasks & Unified Time-Blocking Calendar
```sql
-- Tasks: Tugas eksekusi (Mendukung Inbox dan Daily Planning)
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Jika NULL, berada di Inbox Space
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE, -- Subtasks
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'done', 'cancelled'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    due_date TIMESTAMPTZ,      -- Deadline resmi
    planned_date DATE,         -- Tanggal fokus eksekusi (Daily Planning)
    estimated_minutes INT,     -- Estimasi durasi (menit) untuk time-blocking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Events: Kalender terpadu dan time-blocking slot
CREATE TABLE events (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
    linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- Terhubung dengan task (time-blocking)
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
Tabel generik polimorfik untuk menghubungkan entitas apa pun (misal: teks dokumen $\rightarrow$ task, kartu board $\rightarrow$ task, atau garis konektor SVG antar kartu di kanvas).
```sql
CREATE TABLE entity_links (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_type VARCHAR(50) NOT NULL, -- 'document', 'note_block', 'task', 'event', 'note_board'
    from_id UUID NOT NULL,
    to_type VARCHAR(50) NOT NULL,   -- 'task', 'event', 'note_block', 'document'
    to_id UUID NOT NULL,
    relation_type VARCHAR(50) NOT NULL DEFAULT 'relates_to', -- 'converted_to', 'connects_to', 'blocks', 'timeblocks'
    metadata JSONB DEFAULT '{}'::jsonb, -- Titik anchor & konfigurasi kurva SVG
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_entity_link UNIQUE(workspace_id, from_type, from_id, to_type, to_id, relation_type)
);
```

---

## 5. Sinkronisasi Google Calendar (Worker Pattern)

1. **OAuth2 Flow:** Pengguna menghubungkan akun Google via OAuth2 (scope `calendar.readonly` untuk MVP v0.1).
2. **Kredensial:** Disimpan terenkripsi di tabel `integration_connections`.
3. **Sync Loop (Goroutine):**
   - Background worker berjalan secara berkala (misal setiap 10–15 menit) atau via webhooks bila didukung.
   - Mengambil event Google Calendar menggunakan `syncToken` inkremental.
   - Melakukan upsert ke tabel `events` lokal.

---

## 6. Deployment Architecture

### A. Fase 1: Docker Compose (Lokal & Single VPS)
- `docker-compose.yml` menyatukan:
  - `orca-api`: Binary Go.
  - `orca-web`: Nginx serving static build SolidJS SPA.
  - `orca-db`: PostgreSQL 16 Alpine.
  - `orca-redis`: Redis 7 Alpine.

### B. Fase 2: Helm Chart (Kubernetes / RKE)
- Memetakan deployment terpisah:
  - Ingress controller (Nginx Ingress + Cert-Manager untuk HTTPS).
  - Pod API (stateless, horizontal scalable).
  - StatefulSet / External PostgreSQL.
  - Secret management untuk token OAuth2 dan database password.
