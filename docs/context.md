# Konteks & Filosofi Desain

Dokumen ini menjelaskan latar belakang, permasalahan yang ingin diselesaikan, prinsip arsitektur, dan visi jangka panjang proyek **ORCA**.

---

## 1. Latar Belakang & Masalah

Setiap hari, seorang *knowledge worker*, *maker*, atau engineer berhadapan dengan fragmentasi alat kerja (tools fragmentation):
- **Task & Issue Tracker:** Linear atau Todoist untuk mengelola apa yang harus dikerjakan.
- **Kalender:** Google Calendar untuk mengalokasikan waktu dan menghadiri pertemuan.
- **Brainstorming & Visual Thinking:** Milanote, Miro, atau Apple Freeform untuk menyusun ide, meletakkan referensi visual, dan menghubungkan konsep.
- **Notes & Dokumentasi:** Obsidian atau Notion untuk mencatat dokumen panjang.

### Masalah Nyata
1. **Konteks Terputus (Context Loss):** Ide yang lahir di board brainstorming harus disalin manual menjadi task di Linear, lalu di-block manual lagi di Google Calendar. Informasi sering hilang di tengah jalan.
2. **Ketergantungan SaaS & Privasi Data:** Data ide strategis, jadwal hidup, dan catatan pribadi tersebar di berbagai cloud vendor tertutup yang tidak bisa di-self-host.
3. **Overhead Resource & Latensi:** Aplikasi produktivitas modern berbasis Electron/Next.js sering kali boros memori (RAM > 1GB hanya untuk idle app) dan memiliki latensi interaksi yang mengganggu alur berpikir.

---

## 2. Visi ORCA

> **"Milanote + Google Calendar + Project Management, jadi satu, self-hostable, dan siap AI."**

ORCA hadir sebagai **ruang kerja terpadu (unified personal workspace)** di mana:
1. Sebuah **catatan/kartu ide di canvas** bisa langsung diubah atau dihubungkan menjadi **task**.
2. Sebuah **task** memiliki estimasi durasi dan dapat langsung ditarik (*drag-and-drop*) ke **timeline kalender**.
3. Sistem dapat di-host sendiri (*self-hosted*) dengan konsumsi memori minimal (<50MB RAM untuk backend) di server rumahan atau VPS murah.
4. Arsitektur data siap dihubungkan dengan agen AI eksternal untuk membantu merangkum hari, merekomendasikan prioritas, dan mensintesis ide.

---

## 3. Prinsip Desain Inti

### A. Single-Tenant by Default, Multi-Tenant-Ready by Design
- Saat ini ORCA ditujukan untuk penggunaan personal (*single-user/single-tenant*).
- Namun, skema basis data dan otentikasi didesain sudah memiliki `workspace_id` dan `owner_id` di setiap entitas utama. Hal ini mencegah *architectural debt* dan rewrite besar-besaran jika di masa depan ORCA dibuka untuk tim atau menjadi SaaS komersial.

### B. Self-Host First-Class Citizen
- Tidak ada ketergantungan pada layanan cloud berbayar tertutup (tanpa ketergantungan Clerk, AWS DynamoDB, Firebase, dsb.).
- Seluruh infrastruktur inti berjalan di atas komponen open source standar: **Go binary + PostgreSQL + Redis**.
- Menyediakan template `docker-compose.yml` untuk instalasi 1-perintah bagi pengguna rumahan, serta **Helm Chart** untuk pengguna yang mengelola Kubernetes/RKE.

### C. Modular Monolith Sebelum Microservices
- Untuk developer solo atau tim kecil, microservices hanya mendatangkan overhead operasional yang tidak perlu.
- Seluruh domain bisnis (Tasks, Calendar, Notes/Board, Sync Worker) berada di dalam satu monolit modular (paket domain terpisah di Go). Pemisahan fisik service hanya dilakukan untuk modul yang memerlukan runtime berbeda (seperti AI Worker eksternal).

### D. API-First Architecture
- Semua interaksi frontend (baik Web SolidJS maupun calon Mobile App nantinya) berkomunikasi via API yang sama.
- Tidak ada logika bisnis kritis yang tertanam di frontend.

### E. Desain Data Siap Local-First
- Meskipun MVP v0.1 menggunakan sinkronisasi REST API biasa demi kecepatan rilis, **arsitektur data didesain siap CRDT/Local-First**:
  - Menggunakan **UUIDv7** (bisa di-generate secara deterministik dan terurut waktu di sisi client tanpa bentrok).
  - Kolom `updated_at` dengan zona waktu dan mekanisme *soft deletes* (`deleted_at`) pada setiap entitas untuk memudahkan pembuatan sync cursor di masa depan.

---

## 4. Evolusi Proyek

1. **Fase 1: Dogfooding Personal (MVP v0.1)**  
   Digunakan sendiri setiap hari untuk mengatur task harian, sinkronisasi Google Calendar, dan mencatat ide di canvas spatial.
2. **Fase 2: Tablet & Brainstorming Matang (v0.2)**  
   Dukungan stylus/pen untuk mencoret di tablet saat meeting atau sesi visual thinking santai.
3. **Fase 3: Local-First & AI Integration (v0.3 - v0.4)**  
   Mendukung mode offline penuh dan integrasi AI Assistant untuk daily planning.
4. **Fase 4: Open Source Release (v1.0)**  
   Membuka repositori untuk komunitas self-hoster dunia dengan dokumentasi dan Helm chart yang teruji.
