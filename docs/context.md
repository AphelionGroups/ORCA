# Konteks & Filosofi Desain

Dokumen ini menjelaskan latar belakang, permasalahan yang ingin diselesaikan, prinsip arsitektur, dan visi jangka panjang proyek **ORCA**.

---

## 1. Latar Belakang & Masalah

Setiap hari, seorang *founder*, *maker*, engineer, atau profesional berhadapan dengan dua tantangan besar:

### A. Fragmentasi Alat Kerja (Tools Fragmentation)
Pekerjaan dan pemikiran terpecah di berbagai aplikasi yang tidak saling terhubung:
- **Task & Issue Tracker:** Linear atau Todoist untuk mengelola apa yang harus dikerjakan.
- **Kalender:** Google Calendar untuk mengalokasikan waktu dan menghadiri pertemuan.
- **Brainstorming & Visual Thinking:** Milanote, Miro, atau Apple Freeform untuk menyusun ide, meletakkan referensi visual, dan menghubungkan konsep.
- **Notes & Dokumentasi:** Notion atau Obsidian untuk mencatat dokumen panjang, strategi bisnis, dan SOP.

### B. Beban Mengelola Banyak Peran Sekaligus (Multi-Domain Life)
Seseorang sering kali harus menjalankan banyak domain kehidupan sekaligus:
- **🏢 Pekerjaan Kantor (Day Job)**
- **👤 Kehidupan Pribadi (Kesehatan, Finansial, Hobi, Keluarga)**
- **🚀 Bisnis A (Produk Digital / Agensi)**
- **📈 Bisnis B (F&B / E-Commerce / Kreator)**

Kondisi ini menimbulkan dilema:
1. **Butuh Pemisahan Fokus (Context Isolation):** Saat jam kantor, pikiran tidak boleh terganggu operasional bisnis sampingan. Saat akhir pekan, tidak ingin melihat tumpukan isu kantor.
2. **Waktu Hidup Hanya Satu (Unified Time):** Meskipun urusannya berbeda-beda, alokasi waktu fisik hanya ada satu (24 jam). Jadwal meeting kantor di Google Calendar secara fisik mengunci slot waktu yang tidak bisa dipakai untuk urusan bisnis lain.
3. **Konteks Terputus (Context Loss):** Ide strategi atau brand guideline yang lahir di kanvas brainstorming harus disalin manual menjadi dokumen rencana (activity plan), lalu disalin lagi menjadi task di to-do list, lalu dijadwalkan manual di kalender. Banyak ide menguap di tengah jalan.
4. **Ketergantungan SaaS & Privasi Data:** Data strategis bisnis dan catatan hidup tersebar di berbagai cloud vendor tertutup yang mahal dan tidak bisa di-self-host.

---

## 2. Visi ORCA: Personal & Business Operating System

> **"Ruang kerja terpadu (All-in-One Workspace) yang menyatukan Brainstorming Visual, Dokumentasi Bisnis, Manajemen Proyek, dan Penjadwalan Waktu — terisolasi per domain, terpadu dalam waktu, self-hostable, dan siap AI."**

ORCA menjembatani **3 Lapisan Alur Kerja Manusia**:
```
┌─────────────────────────────────────────────────────────────┐
│ 1. THINKING LAYER  (Brainstorming & Visual Thinking)        │
│    Spatial Board (Milanote): Ide liar, moodboard, mindmap   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (ide matang)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. PLANNING LAYER  (Documentation & Strategy)               │
│    Docs & Wikis: Brand doc, Feature spec, Activity plan     │
└──────────────────────────────┬──────────────────────────────┘
                               │ (dipecah jadi eksekusi)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. DOING LAYER     (Execution & Time Management)            │
│    Tasks + Calendar: Kanban, Todo, Time-blocking jam nyata  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Prinsip Desain Inti

### A. Model "Spaces" (Multi-Domain Isolation dengan Single Timeline)
- Pengguna dapat membagi aktivitas ke dalam **Spaces** (`Kantor`, `Pribadi`, `Bisnis A`, `Bisnis B`).
- Setiap Space memiliki dokumen, board, project, dan task yang terisolasi agar fokus tetap terjaga.
- Namun, seluruh jadwal dan alokasi waktu diintegrasikan ke dalam satu **Unified Timeline Kalender**, sehingga tidak ada bentrok waktu antar domain.

### B. Konsep "Project Hub" (Bukan Sekadar Todo List)
Sebuah proyek di ORCA adalah wadah kerja lengkap (*Work Hub*) yang memiliki 3 pilar:
1. **Docs & Plans:** Dokumen terstruktur (Brand guidelines, Product Requirement Document, Activity plan).
2. **Spatial Board:** Kanvas visual bebas (Moodboard, brainstorming, arsitektur ide).
3. **Tasks & Roadmap:** Kanban dan checklist tugas yang terhubung langsung dengan teks dokumen dan kartu board.

### C. Alur Cepat: Quick Capture & Daily Rituals
- **Quick Capture (`Ctrl+K`):** Menangkap ide atau tugas mendadak dalam hitungan detik ke dalam Inbox tanpa merusak alur konsentrasi.
- **Daily Planning Ritual:** Ritual 5 menit di pagi hari untuk memilih prioritas lintas-domain dan langsung menarik (*drag-and-drop*) task ke slot kosong kalender.

### D. Single-Tenant by Default, Multi-Tenant-Ready by Design
- Saat ini ORCA ditujukan untuk penggunaan personal (*single-user/single-tenant*).
- Namun, skema data dan otentikasi didesain sudah memiliki `workspace_id` dan `owner_id` di setiap entitas utama. Hal ini mencegah *architectural debt* jika di masa depan ORCA dibuka untuk kolaborasi tim atau SaaS komersial.

### E. Self-Host First-Class Citizen
- Tidak ada ketergantungan pada vendor cloud berbayar tertutup.
- Seluruh infrastruktur berjalan di atas komponen open source standar: **Go binary + PostgreSQL + Redis**.
- Tersedia template `docker-compose.yml` untuk instalasi 1-perintah bagi pengguna homelab/VPS murah, serta **Helm Chart** untuk Kubernetes (RKE).

### F. Modular Monolith & API-First
- Seluruh domain bisnis berada dalam satu monolit modular di Go.
- Semua antarmuka (Web SolidJS, Tablet, calon Mobile App) berkomunikasi melalui REST API yang konsisten.

---

## 4. Evolusi Proyek

1. **Fase 1: Dogfooding Personal & Bisnis (MVP v0.1)**  
   Digunakan setiap hari untuk mengelola kantor, pribadi, dan bisnis: Spaces, Project Hub (Docs + Board + Tasks), Google Calendar Sync, dan Quick Capture.
2. **Fase 2: Tablet & Freehand Inking (v0.2)**  
   Dukungan stylus/pen ditenagai `perfect-freehand` untuk mencoret di tablet saat brainstorming atau meeting.
3. **Fase 3: Local-First & Synchronization (v0.3)**  
   Mendukung mode offline penuh (IndexedDB) dan sinkronisasi otomatis multi-perangkat.
4. **Fase 4: AI Intelligence Layer (v0.4)**  
   Integrasi AI Assistant (Letta / Agent Core) untuk daily briefing, perangkum dokumen bisnis, dan pengingat proaktif.
5. **Fase 5: Open Source Release & Helm Chart (v1.0)**  
   Membuka repositori ke komunitas global dengan panduan self-host lengkap dan Helm chart teruji.
