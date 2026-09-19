# ORCA

> **Personal & Business Operating System:** Milanote + Notion Docs + Google Calendar + Linear Task Management, jadi satu, self-hostable, dan siap AI layer.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: Planning & Design](https://img.shields.io/badge/Status-Planning%20%26%20Design-orange.svg)](#roadmap)

---

## 📌 Ringkasan Eksekutif

**ORCA** adalah ruang kerja terpadu (*unified workspace & operating system*) yang dirancang untuk mengelola seluruh domain kehidupan dan pekerjaan (Kantor, Kehidupan Pribadi, Bisnis A, Bisnis B, dll.) tanpa kehilangan fokus dan tanpa fragmentasi aplikasi:
1. **Multi-Domain Spaces:** Memisahkan konteks antara pekerjaan kantor, bisnis, dan ranah pribadi dengan context switcher instan dan *All-Spaces view*.
2. **Project Hub (Docs + Board + Tasks):** Menggabungkan 3 lapisan alur kerja: dokumen strategi/brand panjang (gaya Notion), kanvas visual brainstorming bebas (gaya Milanote), dan eksekusi Kanban/List (gaya Linear).
3. **Calendar & Time-Blocking:** Mengintegrasikan Google Calendar dan memungkinkan *drag-and-drop task* ke slot jam nyata dengan ritual *Daily Planning*.
4. **Global Quick Capture (`Ctrl+K`):** Menangkap ide dan tugas kilat dalam hitungan detik ke dalam Inbox tanpa memecah konsentrasi.

Dirancang khusus dengan prinsip **self-host first-class citizen**, **modular monolith**, dan **ringan konsumsi resource** (<30MB RAM idle pada backend), sehingga dapat dijalankan dengan mudah menggunakan Docker Compose di VPS rumahan maupun Helm Chart di cluster Kubernetes (RKE).

---

## 🏗️ Tech Stack Inti

| Layer | Teknologi | Alasan Utama |
|---|---|---|
| **Frontend App** | **SolidJS + TypeScript + Vite** | Fine-grained reactivity tanpa Virtual DOM; sangat cepat dan hemat memori saat menangani interaksi canvas/board. |
| **Styling & Components** | **Vanilla CSS (Design Tokens & CSS Variables) + Kobalte / Corvu** | Fleksibilitas penuh tanpa abstraksi utility class, performa rendering kanvas maksimal, dan kontrol 100% atas efek visual custom. |
| **Canvas / Board Engine** | **Custom Spatial DOM + SVG Connectors** | Meniru arsitektur Milanote: kartu menggunakan elemen HTML native (mudah untuk rich text & form), garis penghubung dirender via SVG. |
| **Backend API** | **Go (Golang)** | Single static binary, footprint RAM sangat kecil (~15–30 MB), konkurensi native (goroutine) untuk sync worker, minim maintenance jangka panjang. |
| **Database** | **PostgreSQL** | Relasi antar entitas yang kuat, didukung kolom `JSONB` untuk payload block canvas yang fleksibel, dan UUIDv7 sebagai ID standar. |
| **Deployment** | **Docker Compose & Helm (Kubernetes RKE)** | Distribusi portabel dan ramah homelab/self-hoster. |

---

## 🗺️ Roadmap Proyek

```
┌───────────────────────────────────────────────────────────┐
│                    ROADMAP PROYEK ORCA                    │
└───────────────────────────────────────────────────────────┘
                           │
                           ▼
  [ v0.1 — MVP Inti (Fokus Saat Ini) ]
  • Go Modular Monolith API + PostgreSQL (Auth, Spaces, Projects, Docs, Tasks, Calendar, Boards).
  • SolidJS SPA Shell (Sidebar Context Switcher, Global Quick Capture Ctrl+K).
  • Spaces Management (Kantor, Pribadi, Bisnis A, Bisnis B, All-Spaces View).
  • Project Hub:
    - Tab Docs & Plans (Long-form Markdown, Brand Doc, PRD, Activity Plan, Text-to-Task).
    - Tab Spatial Board (Milanote Canvas, Draggable Cards, Sticky Notes, Garis Relasi SVG, Card-to-Task).
    - Tab Tasks (Kanban, List View, Status, Priority, Due Date, Subtasks).
  • Calendar View & Time-Blocking (Google Calendar 1-Way Sync + Daily Planning ritual).
  • Single Docker Compose deployment.
                           │
                           ▼
  [ v0.2 — Brainstorming & Tablet Expansion ]
  • Freehand Pen / Stylus layer ditenagai `perfect-freehand` di atas canvas SVG.
  • Optimasi gesture tablet (Palm rejection, pinch-to-zoom, Apple Pencil/S-Pen).
  • Unified Cross-linking (Task ↔ Note Card ↔ Calendar Event).
                           │
                           ▼
  [ v0.3 — Local-First & Synchronization ]
  • Local-first engine (IndexedDB cache di client).
  • Background synchronization / CRDT untuk editing bebas latensi & offline mode.
                           │
                           ▼
  [ v0.4 — AI Layer (External Agent) ]
  • Integrasi Letta AI / Agent Core dari service eksternal.
  • Daily planner summary & context ingestion dari catatan + jadwal + task.
                           │
                           ▼
  [ v1.0 — Open Source Release & RKE Helm Chart ]
  • Helm Chart produksi untuk Kubernetes / RKE.
  • Dokumentasi komprehensif self-host & backup automation.
```

---

## 📚 Indeks Dokumentasi

Semua spesifikasi detail proyek dikelola secara terstruktur di dalam folder [`docs/`](docs/):

- **[Konteks & Filosofi Desain](docs/context.md):** Latar belakang masalah, prinsip desain, dan arah evolusi proyek.
- **[Spesifikasi Sistem & Arsitektur](docs/spec.md):** Arsitektur detail frontend, backend, skema database, dan strategi deployment.
- **[Kebutuhan Fungsional (FR)](docs/functional-requirements.md):** Rincian kebutuhan fungsional modul per modul (Tasks, Calendar, Board, Hub).
- **[Panduan Pengembangan & Kontribusi](docs/development-guide.md):** Aturan penulisan kode, struktur direktori, workflow git, dan panduan kontribusi.
- **[Architecture Decision Records (ADR)](docs/adr/):** Catatan riwayat keputusan teknis krusial proyek:
  - [ADR 0001: Pencatatan Keputusan Arsitektur](docs/adr/0001-record-architecture-decisions.md)
  - [ADR 0002: Frontend SolidJS dan Custom Spatial DOM Canvas](docs/adr/0002-frontend-solidjs-and-spatial-dom.md)
  - [ADR 0003: Backend Go Modular Monolith](docs/adr/0003-backend-go-modular-monolith.md)
  - [ADR 0004: Standar Data UUIDv7 dan Kesiapan Local-First](docs/adr/0004-data-architecture-uuidv7-and-future-sync.md)
  - [ADR 0005: Penundaan AI Layer dan Local-First untuk MVP](docs/adr/0005-defer-ai-and-local-first-for-mvp.md)
  - [ADR 0006: Desain Arsitektur Stylus/Pen untuk Tablet](docs/adr/0006-future-tablet-stylus-architecture.md)

---

## 🚀 Quickstart & Self-Hosting

ORCA dirancang sebagai *first-class citizen* untuk self-hosting. Seluruh subsistem (PostgreSQL 16, Redis 7, Go Modular Monolith API, dan SolidJS Frontend Nginx) dapat dijalankan dalam 1 perintah:

### 1. Menjalankan dengan Docker Compose

```bash
# Clone repositori
git clone https://github.com/AphelionGroups/ORCA.git
cd ORCA

# Jalankan seluruh stack (Database, Redis, Go API, Frontend)
docker compose up -d --build
```

### 2. Titik Akses Layanan

| Komponen | URL / Port | Keterangan |
|---|---|---|
| **Web Frontend (Operating System)** | [`http://localhost:3000`](http://localhost:3000) | Antarmuka SolidJS SPA (Nginx) dengan dark obsidian theme & reverse proxy `/api/`. |
| **Backend REST API** | [`http://localhost:8080/api/v1`](http://localhost:8080/api/v1) | Go Modular Monolith API. Healthcheck di `/healthz`. |
| **PostgreSQL Database** | `localhost:5432` | User: `orca`, Pass: `orca_secret`, DB: `orca_db`. Otomatis terisi schema & seed. |
| **Redis Cache** | `localhost:6379` | In-memory cache & pub/sub broker. |

> **Header Multi-Tenancy:**  
> Setiap request API menggunakan header:  
> `X-Workspace-ID: 018f0000-0000-7000-8000-000000000001`

---

### 3. Pengujian Otomatis (Smoke Test & Health Verification)

Validasi seluruh endpoint API dan aset frontend secara otomatis:

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File ./scripts/verify_e2e.ps1

# Linux / macOS (Bash)
chmod +x ./scripts/verify_e2e.sh
./scripts/verify_e2e.sh
```

---

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi [MIT](LICENSE).