# Pelaksanaan paket awal roadmap ORCA

Paket ini menjalankan bagian A–D dari paket implementasi pertama pada [roadmap](database-feature-roadmap-2026-10-09.md). Baseline sebelum perubahan: `0e05ee0`. Paket mencakup implementasi, migrasi, dokumentasi, dan acceptance tests yang dijelaskan di bawah.

## Implementasi

- Migrasi 000004 memvalidasi CHECK status, priority, estimate task, interval event, serta scope connector legacy. Nilai legacy yang tidak valid membuat migrasi gagal secara atomik; nilai pengguna tidak dipetakan atau diganti otomatis.
- Editor task, project, space, inbox, dokumen, board dan Calendar mengirim `expected_updated_at`. Endpoint update serta PATCH task status menggunakan pemeriksaan versi dan CAS repository. Precondition tetap opsional untuk compatibility client lama. Konflik menghasilkan 409.
- Kontrak frontend menyediakan kelima status task termasuk cancelled. Kanban tetap memakai empat status kerja.
- Payload block menerima bentuk legacy dan objek schema_version 1, memvalidasi tipe field yang digunakan renderer, serta mempertahankan metadata tambahan.
- Connector disimpan dalam `entity_links` dengan relation connects_to. Endpoint mengambil seluruh connector board dalam satu query. Trigger menolak endpoint lintas board, workspace, self-link, atau block tidak aktif.
- Endpoint operasi board membuat satu transaksi untuk block dan connector, maksimal 200 mutation dan body 2 MiB. Migrasi 000005 menyimpan receipt dan snapshot yang dibuat server. ID operasi UUIDv7 client memungkinkan retry tanpa pengulangan efek.
- Undo/redo menggunakan receipt server, mempertahankan identitas block/link, memulihkan link yang aktif ketika operasi dilakukan, dan menolak versi yang berubah. Transisi history memperbarui referensi versi snapshot yang tepat agar undo berurutan tetap bekerja tanpa mengabaikan konflik eksternal.
- Canvas memakai satu antrean operasi untuk move, resize, content, delete dan connector. Create memakai receipt yang sama. History baru masuk setelah server mengonfirmasi; kegagalan memuat ulang graph dan menampilkan error.
- Viewport disimpan terpisah dari metadata board, dengan debounce dan write berurutan. Range zoom disamakan menjadi 20–200%; pan/zoom tidak mengubah versi rename board.
- Calendar menggunakan tanggal nyata, Day/Week/Month/Timeline, previous/next/today, query range setengah terbuka, posisi menurut menit, durasi, lane overlap, lintas hari dan all-day.
- CRUD event menyediakan tanggal mulai/akhir, waktu, space, dan linked task. Task dapat dijadwalkan melalui tombol dan form; durasi awal memakai estimate atau 60 menit yang dapat diubah. Scheduling tidak mengubah due date/status task. Penghapusan event tidak menghapus task.
- Migrasi 000006 menambah preferensi timezone nullable pada user. Default memakai browser sampai pengguna memilih timezone IANA. Preference endpoint dibatasi user dan workspace; timezone database disimpan melalui API.

## Verifikasi

- Audit lokal sebelum deploy: tidak ditemukan status/priority/estimate task maupun interval event aktif yang tidak valid.
- Go unit/integration tests dan `go vet`.
- Integration tests menggunakan schema sementara: fresh/legacy/repeat migration, invalid legacy tanpa rewrite dan rollback schema, scope user timezone, graph atomik, idempotency, connector identity, undo/redo berurutan, stale undo dan viewport tanpa perubahan versi metadata.
- Frontend tests: gate response, UUIDv7, batch dengan versi, connector identity, pergantian tahun/bulan/leap year, timezone, DST gap, overnight/exclusive boundaries, posisi dan overlap.
- TypeScript strict/Vite build serta browser checks empat ukuran layar: canvas delete–undo–redo, sesi task create/edit/delete, Month/Timeline, navigation, focus, theme dan stale response.
- Service API/web lokal sudah dibangun ulang dan healthy di localhost:8080/3000. Database lokal sudah terpasang sampai migrasi 000006.
- Smoke test dengan API/database nyata: batch create block + connector, retry tanpa duplikasi, UI delete–undo–redo dengan ID asli, edit Calendar → reload → delete dan linked task tetap ada. Fixture yang dibuat test kemudian di-soft-delete melalui API; data pengguna lainnya tidak diedit.

## Bagian roadmap yang belum selesai

Paket awal ini bukan seluruh roadmap. Calendar drag/drop dan resize langsung belum tersedia; scheduling memakai tombol/form. Peringatan overlap, planned-date backlog dan batas/pagination query Calendar masih perlu dilengkapi. Fall-back DST yang ambigu memakai hasil konversi deterministik; UI belum menyediakan pilihan kedua instant untuk wall time yang sama.

Task server filtering/grouping, subtask UI dan daily planning; document draft/revisions/conversion/embed/backlinks; inbox provenance; cursor pagination, benchmark indeks skala besar, attachment registry/cleanup, backup drill; Google Calendar dan collaboration belum dikerjakan di paket ini. Tidak ada tabel spekulatif untuk fitur tersebut.

History UI dibatasi 50 operasi per sesi. Receipt database belum dipurge otomatis; penetapan retention/purge adalah pekerjaan sebelum penggunaan skala besar. Antrean lokal menjaga urutan request, bukan protokol offline. Graph board tetap dikirim lengkap; spatial loading perlu benchmark sebelum diubah. Viewport masih default board personal, belum preferensi per anggota.

Migrasi additive kompatibel dengan reader lama. Jangan menghapus migrasi yang sudah terpasang saat rollback aplikasi; gunakan forward repair jika legacy membutuhkan mapping yang disepakati.
