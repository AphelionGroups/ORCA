# ADR 0005: Penundaan Fitur AI Layer dan Local-First untuk MVP v0.1

## Status
Diterima (Accepted)

## Tanggal
2026-09-16

## Konteks
Ide awal ORCA mencakup fitur-fitur ambisius:
1. **AI Layer (Letta AI / Agent Core):** AI yang membaca seluruh catatan, task, dan jadwal kalender untuk memberikan rekomendasi prioritas harian.
2. **Local-First & CRDT (Yjs / Automerge):** Kemampuan mengedit canvas dan catatan secara offline dengan sinkronisasi real-time instan.

Membangun engine CRDT dan mengintegrasikan agen AI sejak sprint pertama membawa risiko *over-engineering* yang sangat tinggi bagi seorang solo developer. Risiko terbesarnya adalah proyek mangkrak sebelum fungsionalitas dasar (Task, Calendar, dan Notes) selesai dan dapat digunakan sehari-hari (*dogfooding*).

## Keputusan
Kami memutuskan untuk **menunda implementasi AI Layer dan engine Local-First murni keluar dari lingkup MVP v0.1**:
1. **MVP (v0.1)** berfokus penuh pada:
   - CRUD Task & Project (List & Kanban).
   - Kalender internal dengan 1-way sync dari Google Calendar.
   - Milanote-style Spatial Board v1 (kartu HTML dan konektor garis SVG).
   - Sinkronisasi berbasis REST API biasa dengan state lokal optimistik.
2. Fitur AI Layer ditunda dan akan dikembangkan sebagai service/worker eksternal (terintegrasi dari project AI terpisah) pada fase **v0.4**.
3. Fitur Local-First ditunda ke fase **v0.3**, dengan pondasi skema database (UUIDv7, soft-deletes, timestamps) sudah disiapkan sejak awal di MVP.

## Konsekuensi
- **Positif:**
  - Scope MVP menjadi sangat terukur, realistis, dan cepat selesai untuk segera dipakai (*time-to-dogfooding* cepat).
  - Kompleksitas arsitektur awal tetap sederhana dan mudah di-debug.
- **Negatif:**
  - Aplikasi pada fase MVP v0.1 membutuhkan koneksi internet/jaringan ke backend untuk menyimpan perubahan.
