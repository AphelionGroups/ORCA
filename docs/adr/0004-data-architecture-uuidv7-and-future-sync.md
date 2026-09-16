# ADR 0004: Arsitektur Data: Penggunaan UUIDv7 & Kesiapan Local-First

## Status
Diterima (Accepted)

## Tanggal
2026-09-16

## Konteks
Sistem ORCA dimulai sebagai aplikasi web dengan sinkronisasi REST API biasa untuk MVP. Namun, roadmap masa depan menargetkan dukungan **Local-First & Offline Sync** (mirip Obsidian atau Milanote).
Jika basis data awal menggunakan integer auto-increment (`SERIAL` / `BIGSERIAL`), migrasi ke local-first di kemudian hari akan sangat menyakitkan karena ID baru yang dibuat di sisi client saat offline akan mengalami konflik saat di-sinkronisasi ke server.
Di sisi lain, UUIDv4 standar bersifat acak total dan menyebabkan fragmentasi indeks B-Tree yang parah pada tabel PostgreSQL berukuran besar.

## Keputusan
Kami menetapkan standar data sebagai berikut:
1. **Primary Key Menggunakan UUIDv7:** UUIDv7 menggabungkan timestamp UNIX (terurut waktu) dengan bit acak. Ini memungkinkan client maupun server membuat ID secara mandiri tanpa bentrok, sekaligus menjaga performa indeks B-Tree di PostgreSQL tetap cepat.
2. **Kolom Wajib Kesiapan Sinkronisasi:** Setiap entitas utama wajib memiliki:
   - `workspace_id`: Menjamin batas isolasi data (*multi-tenant ready*).
   - `created_at` dan `updated_at` bertipe `TIMESTAMPTZ`: Digunakan sebagai *sync cursor* untuk mendeteksi perubahan data.
   - `deleted_at` bertipe `TIMESTAMPTZ` (*Soft Deletes*): Agar client offline mengetahui entitas mana yang telah dihapus tanpa kehilangan riwayat sinkronisasi.
3. **Penyimpanan Konten Dinamis Menggunakan JSONB:** Blok konten pada board disimpan dalam kolom `JSONB` agar fleksibel menampung variasi tipe kartu tanpa perlu alter tabel setiap kali ada jenis block baru.

## Konsekuensi
- **Positif:**
  - Migrasi ke arsitektur Local-First / CRDT di masa depan dapat dilakukan tanpa perlu mengubah skema database dasar atau memigrasikan ID.
  - Generasi ID dapat dilakukan langsung di frontend secara deterministik (optimistic UI instan).
- **Negatif:**
  - UUID memakan ruang penyimpanan sedikit lebih besar dibanding integer 32-bit (16 byte vs 4 byte), namun dampak ini dapat diabaikan untuk skala beban kerja personal/tim kecil.
