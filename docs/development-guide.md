# Panduan Pengembangan & Kontribusi

Dokumen ini berisi standar kode, struktur direktori proyek, alur kerja git, dan petunjuk pengaturan lingkungan pengembangan untuk **ORCA**.

---

## 1. Prasyarat Lingkungan (Prerequisites)

Untuk menjalankan dan mengembangkan ORCA secara lokal, pastikan perangkat Anda terpasang:
- **Go:** Versi 1.22 atau lebih baru.
- **Node.js:** Versi 20 LTS atau lebih baru.
- **Package Manager:** `pnpm` (direkomendasikan) atau `npm`.
- **Docker & Docker Compose:** Untuk menjalankan PostgreSQL dan Redis lokal secara terisolasi.
- **Git:** Untuk version control.

---

## 2. Rencana Struktur Direktori Proyek

Proyek ini menggunakan struktur monorepo terpadu yang memisahkan backend Go dan frontend SolidJS secara tegas:

```
ORCA/
├── cmd/
│   └── server/             # Entrypoint utama binary Go
├── internal/               # Kode Go internal (modular monolith)
│   ├── auth/               # Logika autentikasi dan session
│   ├── board/              # Logika spatial board & note blocks
│   ├── calendar/           # Logika kalender & Google Sync worker
│   ├── link/               # Relasi relasional antar entitas
│   ├── platform/           # Konfigurasi, DB pool, logging, middleware
│   ├── task/               # Logika project & task management
│   └── workspace/          # Logika workspace & scoping tenant
├── migrations/             # SQL migration files untuk PostgreSQL
├── web/                    # Frontend SPA (SolidJS + TypeScript + Vite)
│   ├── src/
│   │   ├── assets/         # Asset statis
│   │   ├── components/     # UI components (Kobalte primitives)
│   │   │   ├── board/      # Canvas spatial & SVG lines
│   │   │   ├── calendar/   # Kalender views
│   │   │   ├── tasks/      # Kanban & list components
│   │   │   └── ui/         # Tombol, dialog, input
│   │   ├── lib/            # Utility & API client fetcher
│   │   ├── pages/          # Halaman aplikasi
│   │   └── stores/         # Global reactive state (Solid signals/stores)
│   ├── package.json
│   └── vite.config.ts
├── docs/                   # Dokumentasi proyek & ADR
│   └── adr/
├── docker-compose.yml      # Orkestrasi lokal (Postgres, Redis, dsb.)
├── Makefile                # Shortcut perintah otomasi pengembangan
└── README.md
```

---

## 3. Aturan & Standar Penulisan Kode

### A. Aturan Backend (Go)
1. **Pemisahan Domain (Package Isolation):** Jangan melakukan *circular dependency*. Paket domain seperti `task` dan `calendar` berkomunikasi melalui interface atau data transfer object (DTO), bukan import silang tanpa batas.
2. **Kueri Database Bersih:** Selalu sertakan klausa `workspace_id` dan `deleted_at IS NULL` pada setiap kueri `SELECT`, `UPDATE`, atau `DELETE` untuk menjamin isolasi data multi-tenant dan soft-delete.
3. **Penanganan Error Eksplisit:** Selalu periksa dan bungkus (*wrap*) error (`fmt.Errorf("task.Create: %w", err)`). Jangan abaikan error menggunakan blank identifier (`_`).
4. **Konteks (`context.Context`):** Teruskan `ctx` dari HTTP handler hingga ke kueri database untuk memastikan pembatalan request (*cancellation*) berjalan semestinya.

### B. Aturan Frontend (SolidJS)
1. **Hindari Destrukturisasi Props:**
   - Di SolidJS, melakukan `const { title, status } = props;` akan **merusak reaktivitas** (*loss of reactivity*).
   - Selalu akses via `props.title` atau gunakan helper `splitProps(props, [...])`.
2. **Fine-Grained Signals:**
   - Buat sinyal sekecil dan sedekat mungkin dengan elemen yang membutuhkan.
   - Hindari membuat sinyal global tunggal yang menyimpan seluruh state canvas; simpan koordinat `(x, y)` per kartu agar pembaruan drag hanya memengaruhi kartu yang bersangkutan.
3. **No Virtual DOM Assumptions:**
   - Ingat bahwa fungsi komponen SolidJS hanya dijalankan satu kali saat inisialisasi. Jangan meletakkan side-effect tanpa `createEffect` atau `onMount`.

---

## 4. Alur Kerja Git & Kontribusi

### A. Konvensi Pesan Commit (Conventional Commits)
Gunakan format standar berikut:
```
<type>(<scope>): <pesan ringkas dalam bahasa indonesia atau inggris>
```
Contoh:
- `feat(task): tambah filter prioritas pada list view`
- `fix(board): perbaiki snapping koordinat saat zoom < 50%`
- `docs(adr): tambah adr 0006 arsitektur pen tablet`
- `refactor(auth): pisahkan middleware verifikasi workspace`

### B. Branching Strategy
- `main`: Branch stabil yang selalu siap dideploy atau di-build.
- `feat/<nama-fitur>`: Branch untuk pengembangan fitur baru.
- `fix/<nama-bug>`: Branch untuk perbaikan bug.

### C. Panduan Pull Request (PR)
1. Pastikan kode lulus formatting (`gofmt` untuk Go dan `prettier` / `eslint` untuk web).
2. Pastikan tidak ada kredensial, API key, atau rahasia sensitif yang terunggah (*git leak check*).
3. Buat deskripsi PR yang menjelaskan apa yang diubah dan bagaimana cara memverifikasinya.
