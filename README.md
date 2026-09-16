# ORCA

> **Personal Workspace App:** Milanote + Google Calendar + Project Management, jadi satu, self-hostable, dan siap AI layer.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: Planning & Design](https://img.shields.io/badge/Status-Planning%20%26%20Design-orange.svg)](#roadmap)

---

## 📌 Ringkasan Eksekutif

**ORCA** adalah ruang kerja terpadu (*unified personal workspace*) yang menggabungkan tiga pilar produktivitas utama yang biasanya terpisah:
1. **Project & Task Management** (gaya Linear / Todoist: Kanban, list view, prioritas, dependensi).
2. **Calendar & Time-Blocking** (integrasi 2 arah dengan Google Calendar, menghubungkan task langsung ke slot waktu).
3. **Spatial Brainstorming Board & Notes** (gaya Milanote: infinite canvas dengan draggable cards, sticky notes, rich text, dan garis koneksi relasional).

Dirancang khusus dengan prinsip **self-host first-class citizen**, **modular monolith**, dan **ringan konsumsi resource** (<30MB RAM idle pada backend), sehingga dapat dijalankan dengan mudah menggunakan Docker Compose di VPS rumahan maupun Helm Chart di cluster Kubernetes (RKE).

---

## 🏗️ Tech Stack Inti

| Layer | Teknologi | Alasan Utama |
|---|---|---|
| **Frontend App** | **SolidJS + TypeScript + Vite** | Fine-grained reactivity tanpa Virtual DOM; sangat cepat dan hemat memori saat menangani interaksi canvas/board. |
| **Styling & Components** | **Tailwind CSS + Kobalte / Corvu** | Headless primitives yang aksesibel dengan kebebasan desain visual 100% tanpa batas template. |
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
  • Go Modular Monolith API + PostgreSQL (Auth, Workspace, Tasks, Calendar, Notes).
  • SolidJS SPA Shell (Navigation, Responsive Layout).
  • Task & Project Management (Kanban, List, Status, Priority, Due Date).
  • Calendar View (Sinkronisasi 1-arah dari Google Calendar).
  • Spatial Board v1 (Draggable Cards, Sticky Notes, Garis Relasi SVG).
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

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi [MIT](LICENSE).