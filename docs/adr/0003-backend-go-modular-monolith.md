# ADR 0003: Pemilihan Backend Go dengan Pola Modular Monolith

## Status
Diterima (Accepted)

## Tanggal
2026-09-16

## Konteks
Backend ORCA harus mampu melayani operasi CRUD cepat, mengelola koneksi database relasional, dan menjalankan background worker untuk sinkronisasi kalender pihak ketiga (Google Calendar).
Dua opsi utama yang dipertimbangkan adalah:
1. **Node.js (NestJS / Hono):** Keuntungan utama adalah kesamaan bahasa (TypeScript) antara frontend dan backend (*shared types*). Namun, NestJS cenderung berat, dan runtime Node.js memiliki konsumsi memori idle yang relatif besar (150–300 MB) serta ekosistem dependency `node_modules` yang rentan terhadap *bitrot*.
2. **Go (Golang):** Dikenal dengan performa tinggi, efisiensi memori luar biasa (<30 MB RAM idle), single binary static build, dan model konkurensi native (goroutine) yang sangat andal untuk background worker.

Setelah dianalisis, keunggulan *end-to-end type safety* di TypeScript tidak cukup signifikan untuk menutupi keunggulan efisiensi resource dan stabilitas jangka panjang dari Go, terutama untuk aplikasi yang didesain agar mudah di-self-host.

## Keputusan
Kami memilih **Go** sebagai bahasa utama backend dengan arsitektur **Modular Monolith**:
1. Seluruh modul (Auth, Task, Calendar, Board, Link, Sync Worker) dikemas dalam satu codebase Go dengan pemisahan domain internal yang rapi.
2. Dideploy sebagai single binary image (Docker Alpine/Distroless < 25 MB).
3. Menggunakan router HTTP ringan (seperti Chi atau Echo) dan query builder/generator `sqlc` yang type-safe terhadap PostgreSQL.

## Konsekuensi
- **Positif:**
  - Resource footprint sangat ramah untuk homelab, VPS murah ($4/bulan), dan cluster Kubernetes / RKE.
  - Kompilasi instan dan minim maintenance dependency jangka panjang.
  - Penjadwalan sinkronisasi Google Calendar dapat berjalan secara native menggunakan goroutine tanpa perlu worker framework terpisah.
- **Negatif:**
  - Tipe data DTO di frontend (TypeScript) harus didefinisikan secara manual atau di-generate via tool tambahan seperti OpenAPI/oapi-codegen.
