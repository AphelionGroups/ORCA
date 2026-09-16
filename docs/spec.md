# Spesifikasi Sistem & Arsitektur

Dokumen ini mendokumentasikan spesifikasi teknis, arsitektur sistem, skema basis data, dan pola komunikasi antar komponen untuk **ORCA**.

---

## 1. Arsitektur Tingkat Tinggi

```
                     ┌───────────────────────────────┐
                     │   SolidJS SPA (Web/Tablet)    │
                     │  - Custom Spatial DOM Canvas  │
                     │  - SVG Relation Connectors    │
                     │  - Tailwind CSS + Kobalte     │
                     └───────────────┬───────────────┘
                                     │ HTTPS / REST (JSON)
                                     ▼
                     ┌───────────────────────────────┐
                     │      ORCA Core API (Go)       │
                     │       (Modular Monolith)      │
                     │  ┌─────────────────────────┐  │
                     │  │ Auth & Workspace Module │  │
                     │  ├─────────────────────────┤  │
                     │  │ Task & Project Module   │  │
                     │  ├─────────────────────────┤  │
                     │  │ Calendar & Sync Module  │  │
                     │  ├─────────────────────────┤  │
                     │  │ Notes & Spatial Board   │  │
                     │  └─────────────────────────┘  │
                     │  ┌─────────────────────────┐  │
                     │  │ Background Sync Worker  │  │
                     │  │ (Google Calendar Sync)  │  │
                     │  └─────────────────────────┘  │
                     └───────┬───────────────┬───────┘
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
  workspace/            # Domain Workspace & Multi-tenancy
  auth/                 # Domain Autentikasi (Session / JWT)
  task/                 # Domain Task & Project Management
  calendar/             # Domain Event & Google Calendar Integration
  board/                # Domain Spatial Board & Note Blocks
  link/                 # Domain Cross-linking relasional
```

---

## 4. Skema Basis Data (PostgreSQL)

Semua tabel menggunakan **UUIDv7** sebagai Primary Key (time-ordered, terurut waktu, ramah indexing B-Tree, dan aman di-generate di sisi client).

### A. Identitas & Multi-Tenancy
```sql
CREATE TABLE workspaces (
    id UUID PRIMARY KEY, -- UUIDv7
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### B. Task & Project Management
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    kanban_columns JSONB NOT NULL DEFAULT '["Backlog", "Todo", "In Progress", "Done"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    project_id UUID REFERENCES projects(id),
    parent_task_id UUID REFERENCES tasks(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'todo', -- todo, in_progress, done, cancelled
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    due_date TIMESTAMPTZ,
    estimated_minutes INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### C. Calendar & Time-Blocking
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    external_provider VARCHAR(50), -- misal: 'google_calendar'
    external_event_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### D. Notes & Spatial Board
```sql
CREATE TABLE note_boards (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(255) NOT NULL,
    viewport_state JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE note_blocks (
    id UUID PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES note_boards(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
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

### E. Unified Cross-Link Table
Tabel generic untuk menghubungkan dua entitas apa pun (Note ↔ Task ↔ Event) tanpa perlu membuat kolom foreign key manual di setiap tabel.
```sql
CREATE TABLE entity_links (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    from_type VARCHAR(50) NOT NULL, -- 'note_block', 'task', 'event', 'note_board'
    from_id UUID NOT NULL,
    to_type VARCHAR(50) NOT NULL,
    to_id UUID NOT NULL,
    relation_type VARCHAR(50) NOT NULL DEFAULT 'relates_to', -- 'connects_to', 'blocks', 'timeblocks'
    metadata JSONB DEFAULT '{}'::jsonb, -- info titik anchor (misal: port sambungan garis)
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
