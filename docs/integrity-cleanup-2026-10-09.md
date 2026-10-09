# Perbaikan integritas dan cleanup ORCA

Perbaikan berdasarkan audit 8 Oktober 2026. Cakupan: integritas data, konsistensi update/request, pengurangan kode dan dependensi yang tidak dipakai.

## Perubahan

- Migration `000003_lifecycle_validation.up.sql` menetapkan cascade soft delete space → project/document/board/task/event, project → document/board/task, board → block, task → subtask. Event independen tetap hidup saat task dihapus; referensi task-nya dilepas. Link dengan endpoint terhapus menjadi tombstone.
- Active descendant dari parent yang sudah terhapus diperbaiki dalam migrasi yang sama. Record fisik dipertahankan. Migrasi lama tidak diubah.
- Pemeriksaan referensi mengambil row lock parent sampai transaksi selesai, sehingga child baru tidak dapat lolos bersamaan dengan penghapusan parent.
- Status/priority task, estimasi nonnegatif, interval event dan siklus task divalidasi. CHECK baru menggunakan `NOT VALID`: berlaku untuk penulisan berikutnya, tanpa memaksa penggantian nilai legacy aktif. Tombstone tetap dapat dibuat meski nilai lama tidak sesuai.
- Restore block memakai UPDATE record asli, memeriksa workspace dan parent aktif. Restore/delete block dapat diulang untuk recovery operasi history yang sebagian selesai. Undo/redo diserialisasi dan menunggu API sebelum memindahkan stack; kegagalan menampilkan error dan mencoba memuat keadaan server.
- Update nullable membedakan field omitted, `null`, dan nilai baru. Dokumen mempertahankan content/pinned bila tidak dikirim; project mempertahankan description/target date; space mempertahankan sort order. Form task/project mengirim `null` saat pengguna mengosongkan field. Tanggal task dikirim sebagai RFC3339, bukan string date-only yang ditolak Go.
- Update repository yang membaca lalu menulis memakai precondition `updated_at`; konflik dikembalikan sebagai HTTP 409. Editor dokumen juga mengirim `expected_updated_at` untuk mendeteksi perubahan sejak dokumen dibuka. Edit lanjutan selama save tidak ditimpa efek sinkronisasi editor. Error save terlihat dan teks tetap ada di editor untuk disalin/dicoba ulang.
- Konversi inbox mengunci note dalam transaksi dan menormalisasi response `{data: {task_id/document_id}}`. Kegagalan konversi mempertahankan note. Pemotongan judul menggunakan Unicode rune.
- List repository mengecek `rows.Err()`. Decoder inbox memakai ParseJSON strict yang sama dengan modul lain. Upsert link mengembalikan ID record yang sebenarnya dan memulihkan tombstone dengan ID yang sama.
- Calendar/Inbox memakai request gate seperti Project; hasil create/duplicate/paste/upload block ditolak oleh UI bila pengguna sudah berpindah board; respons lama ditolak dan load Calendar tidak lagi dipicu dua kali saat mount. Calendar mempertahankan jam 00:00 dan menolak rentang waktu terbalik. Error operasi terlihat pada ketiga view.
- Persistence history dipisah ke `canvasHistory.ts`; toolbar contextual dipisah ke `CanvasContextToolbar.tsx`. Controller berkurang sekitar 300 baris. Connector otomatis yang tidak berasal dari data pengguna dihapus.
- TypeScript strict diaktifkan. Response inbox menggunakan tipe eksplisit. Dependensi `@solidjs/router`, CSS yang tidak memiliki pemakai, dan Redis dari compose/env/deployment guide dihapus. Container Redis lokal yang tidak digunakan dihapus; volume tetap tersedia.
- Patch dependency menaikkan SolidJS ke 1.9.17 dan memperbarui seroval/source-map-js. Audit npm sesudah patch melaporkan 0 vulnerabilities.

## Verifikasi

- `go test ./... -count=1` dan `go vet ./...`.
- Integration PostgreSQL melalui `ORCA_TEST_DATABASE_URL`; setiap tes membuat schema unik lalu menghapus hanya schema miliknya. Cakupan: fresh/legacy migration, tenant isolation, cascade, restore/idempotence, conversion bersamaan/rollback, link identity/lifecycle, validasi task/event/cycle, stale document conflict, update omitted/null, dan child creation saat parent sedang dihapus.
- `npm run build` dengan TypeScript strict; `npm test` meliputi stale request dan restore/history failure.
- Browser fixture smoke serta UI check empat viewport, tema, modal/focus, docs/task/capture, tanggal task, toolbar canvas, dan delete → undo → redo → undo block. Screenshot verifikasi disimpan pada direktori ignored `bin/lifecycle-ui-check`.
- API/web lokal direbuild; migration 000003 terpasang. Live smoke mencakup login demo dan navigasi project/docs/tasks/board/canvas/calendar.

## Batas yang masih perlu pekerjaan fitur

- Connector dan viewport board masih belum dipersistensikan oleh UI. Pengembangan integrasinya tetap diperlukan; endpoint links dipertahankan karena merupakan fondasi fitur tersebut.
- Date navigation/day-week-month/time-blocking Calendar, customizable kanban, subtasks UI dan backlinks bukan bagian implementasi cleanup ini.
- Controller masih besar; pemisahan domain canvas/docs/tasks berikutnya perlu dilakukan bertahap dengan tes interaksi. Legacy CSS override, inline style dan `content:any` belum seluruhnya diganti.
- Multi-block history memakai beberapa request, bukan transaksi batch tunggal. Partial failure dapat dipulihkan melalui retry/undo; operasi itu belum atomik lintas semua block. Restore block tidak otomatis menghidupkan kembali entity link yang menjadi tombstone.
- Optimistic update repository melindungi request yang bertabrakan setelah read. Precondition dari versi yang dibuka client baru diterapkan pada editor dokumen; belum semua editor memiliki perlindungan stale client yang sama.
- Belum ada durable draft/revision history, offline recovery, pagination, atau benchmark dataset besar. Dua indeks tambahan hanya mendukung traversal subtask dan detach event; tidak menambah indeks spekulatif untuk seluruh roadmap.

Perubahan ini merupakan batch perbaikan integritas dan cleanup pada branch `design/orca-app-refresh`.
