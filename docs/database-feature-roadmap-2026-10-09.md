# Roadmap database dan kelengkapan fitur ORCA

Tanggal: 9 Oktober 2026. Baseline: commit `0e05ee0`, branch `design/orca-app-refresh`.

Dokumen ini adalah rencana implementasi. Status pelaksanaan paket awal A–D dan pekerjaan yang tersisa dicatat di [laporan implementasi](roadmap-implementation-2026-10-09.md). Dasarnya: [audit](project-audit-2026-10-08.md), [perbaikan terakhir](integrity-cleanup-2026-10-09.md), [functional requirements](functional-requirements.md), dan ADR 0004/0005. Estimasi berupa ukuran pekerjaan relatif, bukan komitmen tanggal rilis.

## Hasil yang dituju

ORCA dapat dipakai sehari-hari untuk alur capture → project → dokumen/board → task → jadwal → review, dengan data yang tetap benar setelah reload, kegagalan request, dan perubahan dari tab lain.

Fondasi tetap Go modular monolith, SolidJS, dan PostgreSQL. Gunakan migrasi additive dan tabel domain yang ada. Hindari penambahan infrastructure atau tabel untuk roadmap yang belum dikerjakan. UUID, tenant scoping, tombstone, dan timestamp dipertahankan; fondasi tersebut belum berarti aplikasi mendukung sinkronisasi offline.

## Keputusan awal yang direkomendasikan

| Area | Keputusan untuk implementasi berikutnya | Dampak database |
|---|---|---|
| Workflow task | Status tetap: `todo`, `in_progress`, `in_review`, `done`, `cancelled`. Empat status pertama menjadi kanban; cancelled tersedia lewat filter/list. | Belum perlu `project_columns`. Bereskan kontrak `kanban_columns` lama dengan mapping yang eksplisit. |
| Connector | `entity_links`, relation `connects_to`, endpoint `note_block`; metadata menyimpan sisi attachment dan versi payload. Connector canvas harus berada dalam board yang sama. | Pakai tabel yang ada; tambah constraint/validasi scope ketika endpoint connector dibuat. |
| Viewport | Pakai `note_boards.viewport_state` dengan satu format koordinat dan zoom yang jelas. Sementara dianggap default board personal. | Tidak perlu tabel baru. Preferensi viewport per pengguna ditambahkan saat collaboration dikerjakan. |
| Konflik update | Kirim `expected_updated_at` dari semua editor, melanjutkan pola dokumen. Response 409 tidak menghapus draft/optimistic state tanpa recovery. | Gunakan timestamp yang sudah ada; belum perlu mekanisme revision kedua untuk setiap tabel. |
| Time-blocking | Task adalah pekerjaan; event adalah alokasi waktunya. Satu task boleh punya beberapa sesi. | Gunakan `events.linked_task_id`, start/end yang ada. |
| Waktu | Instant event disimpan TIMESTAMPTZ; rendering memakai timezone IANA pengguna. Planned date adalah tanggal kalender. Due date sementara mempertahankan kontrak tanggal UTC yang digunakan form saat ini. | Tambah preferensi timezone ketika Calendar dibenahi. Jangan mengubah tipe due date diam-diam. |
| Dokumen | Pertahankan markdown dahulu; tambah referensi task/board secara terstruktur sebelum mempertimbangkan editor rich text penuh. | Revisions ditambahkan bersama fitur history; hindari migrasi editor sekaligus migrasi konten. |
| Restore | Restore hanya memulihkan record yang benar-benar dihapus oleh operasi tersebut. Parent harus aktif; link manual yang sudah dihapus sebelumnya tidak ikut dipulihkan. | Operasi board membutuhkan identitas operasi/snapshot untuk restore yang tepat. |

Keputusan di atas adalah default perencanaan. Custom workflow, perilaku restore parent, dan kebijakan retention perlu disepakati saat tahap terkait mulai dikerjakan; keputusan itu tidak menghalangi tahap fondasi dan persistence board.

## Urutan pelaksanaan

| Tahap | Hasil utama | Dependensi | Ukuran |
|---|---|---|---|
| 0 | Kontrak data, audit legacy, standar konflik, baseline pengukuran | Baseline saat ini | S–M |
| 1 | Board tersimpan utuh, batch mutation atomik, undo/redo beserta connector | Tahap 0 | L |
| 2 | Calendar tanggal/jam benar, Day/Week/Month, CRUD dan time-blocking | Tahap 0; atribut estimasi task | L |
| 3 | Task list/filter/grouping, subtasks, workflow konsisten, daily planning | Kalender untuk scheduling; kontrak tahap 0 | M–L |
| 4 | Dokumen aman, text-to-task, task embed, backlinks, provenance inbox | Links tahap 1; task tahap 3 | L |
| 5 | Pagination, query/index terukur, attachment lifecycle dan recovery operasional | Query final dari tahap 1–4 | M–L |
| 6 | Google sync, kemudian team workspace sesuai prioritas produk | Core stabil; attachment/security/authorization sesuai kebutuhan | L per fitur |

S = pekerjaan terbatas pada satu alur; M = beberapa layer/domain; L = lintas API, persistence, UI, migrasi, dan failure testing. Tahap besar harus dipecah menjadi PR kecil; jangan menggabungkan seluruh roadmap menjadi satu perubahan. Baseline pengukuran dimulai pada tahap 0, bukan menunggu tahap 5.

### Tahap 0 — Kontrak dan kesiapan database

Pekerjaan:

1. Audit nilai legacy aktif untuk constraint migration 000003: status/priority, estimated minutes, interval event. Laporkan record yang tidak valid dan tentukan mapping/perbaikan per record; jangan mengganti nilai tanpa aturan.
2. Setelah audit bersih, jalankan migration baru `VALIDATE CONSTRAINT` untuk keempat CHECK. Perhitungkan scan/locking dan ukur pada database yang menyerupai produksi.
3. Tulis kontrak status bersama dan selaraskan functional requirements: `in_review` sudah dipakai kode, tetapi belum tercantum pada daftar status requirement. Semua task harus terlihat di kanban atau list/filter, termasuk cancelled.
4. Standarkan response pagination/conflict, nullable update, dan format waktu. Terapkan precondition client pada block, task, event, board, project, dan space secara bertahap; repository CAS yang sudah ada tetap dipakai.
5. Definisikan discriminated type payload block dan `schema_version` di JSONB. Mulai dari tipe yang sudah dirender: sticky, text/card, shape, image, task embed. Validator backend dan tipe frontend harus sepakat; payload legacy dibaca dengan adapter versi, bukan ditolak mendadak.
6. Ambil baseline query, ukuran data, latency, dan biaya trigger; siapkan seed benchmark terpisah dari data pengguna. Dataset meliputi banyak project, task, block dan event per workspace.

Kriteria selesai: laporan legacy tersedia; CHECK tervalidasi pada database bersih; kontrak API terdokumentasi; edit dari dua tab mengembalikan 409 pada stale request dan pengguna dapat mempertahankan draft; payload block legacy tetap terbaca.

### Tahap 1 — Persistence dan lifecycle board

Pecah implementasi menjadi tiga PR:

1. **Connector + viewport:** client links, query connector per board dalam satu request, create/update/delete connector, load/save viewport dengan debounce. Hindari satu request links untuk setiap block. Pisahkan write viewport dari write metadata board agar pan/zoom tidak menimpa rename atau membuat konflik palsu.
2. **Batch mutation:** satu endpoint board untuk move/resize/delete/restore beberapa block dan connector. Server memvalidasi semua ID, workspace, board, versi dan parent sebelum commit transaksi. Batasi ukuran batch. Jangan mempercayai snapshot restore yang dikirim client sebagai sumber kebenaran.
3. **History atomik:** simpan receipt/snapshot operasi minimal untuk block dan connector yang berubah. Operation ID dari client menjadi kunci idempotency: retry setelah timeout tidak mengulang efek. Undo/redo memeriksa apakah objek berubah setelah operasi; konflik tidak menimpa edit yang lebih baru.

Database:

- `entity_links` dan `viewport_state` digunakan kembali.
- Saat PR history dibuat, tambahkan `board_operations` dengan workspace/board, operation ID, tipe operasi, snapshot server, state applied/undone dan timestamp. Scope tetap khusus board; tidak membangun event-sourcing seluruh aplikasi.
- Jika diperlukan untuk membedakan tombstone manual dan cascade operasi, tambahkan identitas operasi penghapusan pada block/link. Snapshot mencatat link yang aktif sebelum delete; restore hanya menyentuh link milik operasi itu dengan kedua endpoint aktif.
- Putuskan batas history dan purge receipt saat fitur dirilis. Menghapus receipt lama tidak menghapus entitas pengguna.

Kriteria selesai: reload dan reopen mempertahankan connector/viewport; endpoint lintas board/workspace ditolak; satu invalid ID membatalkan seluruh batch; delete → undo → redo memulihkan ID dan connector yang sama; link yang dihapus sebelumnya tetap terhapus; retry request tidak menggandakan operasi; stale history menghasilkan konflik yang dapat dipahami.

### Tahap 2 — Calendar dan time-blocking

PR pertama menyelesaikan Day/Week dan CRUD; PR kedua Month; PR ketiga drag/drop scheduling.

Pekerjaan:

- Anchor tanggal nyata, previous/next/today, awal minggu, dan range request berdasarkan viewport kalender.
- Render event berdasarkan tanggal, start/end, durasi, overlap, lintas tengah malam, dan all-day. Gunakan interval range setengah terbuka agar event di batas hari tidak muncul ganda.
- Tambah edit/delete event; request dan optimistic state memiliki conflict/recovery yang sama dengan editor lain.
- Tambah timezone IANA pengguna, default browser timezone sampai preferensi disimpan. Jangan menghitung perpindahan tanggal hanya dengan kelipatan 24 jam.
- Backlog memakai estimated minutes dan planned date sebenarnya. Drag task membuat event linked; drag/resize event mengubah slot tanpa mengubah deadline task.
- Tentukan fallback durasi task yang belum diestimasi secara eksplisit dan bisa diubah pengguna. Overlap awalnya berupa peringatan; tidak melarang sesi paralel tanpa kebutuhan bisnis.

Database: preferensi timezone pada user/settings; gunakan tabel events dan tasks yang ada. Kalender memakai query overlap/range dengan batas jumlah hasil dan loading bertahap. Indeks event range ditambahkan hanya setelah pengukuran.

Kriteria selesai: perpindahan tanggal benar pada semua hari; Day/Week/Month menampilkan data yang sama; event 00:00, lintas hari dan timezone berbeda lolos tes; drag/drop menghasilkan event linked yang tetap ada setelah reload; menghapus event tidak menghapus task; task boleh memiliki beberapa sesi.

### Tahap 3 — Tasks dan daily planning

Pekerjaan:

- Samakan status API, modal, list, dan kanban. Map field `kanban_columns` lama ke kontrak fixed; jangan menganggap label lama sebagai ID status.
- Filter/sort/grouping status, priority, project, space dan due/planned date di server, dengan urutan stabil.
- UI estimated minutes, planned date, deadline dan cancelled/archive.
- Subtask create/edit/move; aturan parent harus dalam scope project/space yang disepakati. Perketat database hanya setelah audit hubungan yang sudah ada. Parent/child tidak berubah tenant dan tidak membentuk siklus.
- Morning planning memilih prioritas dan menjadwalkan task; evening review menampilkan selesai/tidak selesai dan reschedule. Mulai dari `planned_date`, status dan events; tambah tabel ritual hanya bila perlu menyimpan histori pilihan harian yang tidak dapat diwakili field tersebut.

Database: sebagian besar memakai tasks/events yang ada. Belum membuat custom workflow table. Jika custom workflow menjadi kebutuhan, buat ADR terpisah dan `project_columns` dengan UUID stabil, posisi, label, serta mapping status; backfill `tasks.column_id` bertahap sebelum mengganti UI.

Kriteria selesai: tidak ada task valid yang hilang dari seluruh view; filter/sort konsisten setelah reload; subtask scope/cycle diuji di UI dan SQL; planned date terpisah dari due date; daily review tidak mengubah status secara implisit tanpa tindakan pengguna.

### Tahap 4 — Dokumen, konversi, embed dan backlinks

PR recovery dokumen dapat dimulai lebih awal setelah tahap 0, tanpa menunggu seluruh task UI.

Pekerjaan:

- Draft lokal terscope user/workspace/document, dengan debounce, indikator saved/unsaved, recovery setelah reload dan pembersihan saat logout sesuai kebijakan. Draft recovery bukan dukungan offline penuh.
- Tambah document revisions dan UI restore/copy/compare. Revision dan update dokumen dibuat dalam satu transaksi; konflik menyimpan draft untuk dibandingkan.
- Text selection → task: pilih judul/atribut, buat task dan link `document → task` dalam transaksi. Simpan kutipan dan locator yang tahan perubahan; offset teks bukan identitas permanen.
- Card/sticky → task: buat task + link provenance secara atomik; source tetap ada dan dapat menampilkan task embed.
- Task embed merujuk ID task; status/title dibaca dari task, bukan disalin permanen ke content block. Gunakan batch lookup, bukan request per widget. Render state unavailable saat target terhapus/tidak dapat diakses.
- Backlinks inspector menampilkan sumber/target yang bisa diakses, membuka project/doc/board yang tepat, dan membedakan relation connectors/references/conversion.
- Inbox conversion memiliki provenance historis. Inbox yang converted adalah tombstone, sehingga tidak boleh langsung dipakai sebagai endpoint aktif `entity_links` dengan validator saat ini.

Database:

- `document_revisions`: workspace/document, ID revision, snapshot content/title, actor, timestamp; indeks histori per dokumen. Retention ditetapkan bersama UI history.
- Dokumen dan board memakai `entity_links` untuk relation ke task/board.
- `inbox_conversions`: workspace/source note, salah satu target task atau document, timestamp/actor. Unique per source note, CHECK tepat satu target, serta FK tenant-aware. Histori ini boleh merujuk source yang soft-deleted. Tambahkan composite unique key yang memang diperlukan FK.
- Jangan mengendurkan validator links umum hanya agar tombstone inbox lolos. Jika nanti note bisa dikonversi ulang setelah restore, ubah kebijakan unique melalui migrasi tersendiri yang mendukung beberapa attempt.

Kriteria selesai: browser crash/reload tidak menghilangkan draft tersimpan; restore revision membuat versi baru; conversion task dan provenance rollback bersama saat gagal; retry/concurrent conversion tidak menciptakan task ganda; embed/backlinks mengikuti perubahan task; akses lintas workspace ditolak.

### Tahap 5 — Pertumbuhan data dan operasi

Pekerjaan:

- Cursor pagination untuk tasks/projects/documents/boards/inbox dan links; default/max limit, stable sort dengan tie-breaker ID, serta filter yang sama antara halaman.
- Board canvas tetap membutuhkan graph lengkap atau strategi spatial loading yang jelas. Jangan menambahkan pagination block biasa yang membuat connector tampak kehilangan endpoint. Mulai dengan batas dan benchmark ukuran board, lalu viewport/spatial loading jika dibutuhkan.
- Ukur query aktual dengan EXPLAIN (ANALYZE, BUFFERS) pada database benchmark, bukan database produksi yang sedang menerima write. Kandidat indeks: task per project + sort cursor, board/doc per project, link arah masuk/keluar aktif, event range. Tambahkan hanya indeks yang terbukti membantu.
- Ukur correlated block count dan biaya trigger. Optimasi tidak boleh menghilangkan pemeriksaan tenant/parent aktif atau membuka race delete/create.
- Attachment metadata: workspace, object key unik, mime, ukuran, uploader, timestamp dan lifecycle. Reference ke document/block menggunakan relation yang tervalidasi. Cleanup file orphan memiliki grace period dan hanya berjalan setelah referensi diverifikasi.
- Backup/restore drill, audit hasil migrasi, structured error logs tanpa token/secrets, serta health monitoring. Tentukan retensi tombstone, draft, revision dan operation receipt berdasarkan kebutuhan recovery.

Kriteria selesai: pagination tidak menggandakan/melewatkan ID pada urutan stabil; benchmark before/after menunjukkan dampak indeks; board besar tetap lengkap atau jelas loading-nya; file yang masih direferensikan tidak ikut cleanup; backup berhasil dipulihkan ke database terpisah.

### Tahap 6 — Integrasi dan collaboration

**Google Calendar import satu arah:** tercantum di requirement MVP tetapi belum selesai. Jadwalkan setelah Calendar internal stabil, atau naikkan prioritas jika merupakan kebutuhan penggunaan harian. Tambah connection/account/calendar identity, mapping event remote, encrypted OAuth token, sync cursor, last-sync/error. Uniqueness harus memasukkan workspace + connection/calendar + external event ID, bukan hanya external event ID. Retry/upsert idempotent; revoke/disconnect tidak menghapus agenda pengguna tanpa kebijakan yang jelas.

**Team workspace:** hanya jika multiuser menjadi kebutuhan dekat. Tambah workspace membership/invite/role, migrasikan owner menjadi anggota owner, lalu uji authorization pada setiap route dan upload. `users.workspace_id` tetap dipertahankan sementara untuk compatibility; perpindahan konteks workspace harus diverifikasi membership. Jangan membuka team UI sebelum seluruh endpoint mengikuti model izin baru.

**Stylus, offline penuh, AI:** mengikuti ADR 0005/0006 dan extended roadmap. Stylus perlu payload/version strokes serta object storage bila ukuran membesar. Offline penuh memerlukan protokol konflik, deletion retention, checkpoint/change feed dan schema negotiation; timestamp saja tidak cukup. AI diperkenalkan sebagai worker terpisah dengan akses tenant yang terbatas ketika core sudah stabil. Belum membuat tabel/Redis/CRDT untuk ketiganya pada tahap sekarang.

## Rencana migrasi

Saat ini versi terakhir adalah 000003. Nomor di bawah bersifat contoh urutan; gunakan nomor berikutnya yang tersedia saat PR dibuat.

| Paket perubahan | Migrasi yang diperlukan | Kondisi pelaksanaan |
|---|---|---|
| Validasi legacy | `VALIDATE CONSTRAINT` migration 000003 | Audit legacy bersih; scan/lock sudah diukur |
| Calendar timezone | User/settings timezone IANA | Fitur Calendar timezone siap diuji |
| Board history | Operation receipt dan identitas delete terkait jika dibutuhkan | Endpoint batch dan undo/redo atomik dikirim bersama |
| Document recovery | Document revisions dan indeks scoped | UI history/retention sudah ditetapkan |
| Inbox provenance | Conversion history + tenant-aware FK/unique/check | API conversion menulis target + provenance dalam transaksi |
| Query performance | Partial/composite indexes yang lolos benchmark | Query/filter/cursor sudah final |
| Attachment registry | Attachment metadata/reference | Upload/reference/delete/cleanup siap bersama |
| Google sync / membership | Tabel connection/mapping atau membership/invite | Tahap fitur masing-masing dimulai |

Setiap PR migrasi harus memiliki: fresh install test, upgrade dari 000003, fixture legacy, tenant isolation, failure rollback, repeat startup, dan rencana deploy. Backfill besar dipisah menjadi proses resumable; constraint ditambahkan/diterapkan bertahap. Indeks CONCURRENTLY, bila diperlukan pada tabel besar, harus memakai jalur nontransactional khusus karena migrator sekarang membungkus migrasi dalam transaksi. Jangan memasukkannya ke file migration biasa tanpa mengubah runner dengan tepat.

Perubahan breaking memakai expand → backfill → switch reader/writer → contract pada rilis terpisah. Jangan mengubah file migration yang sudah terpasang. Rollback aplikasi harus tetap dapat membaca schema additive; pemulihan data yang salah memakai forward repair atau backup, bukan DROP kolom pengguna.

## Refactor yang mengikuti pekerjaan fitur

- Tahap board: pisahkan board data, connections/history, gesture/geometry dan presentasi dari controller project.
- Tahap dokumen: pisahkan draft/save/revision controller.
- Tahap tasks: pisahkan query/filter dan mutation controller.
- Terapkan API error bertipe (status/code/details), state loading/error/conflict yang konsisten, serta komponen dialog/form dengan label eksplisit.
- Rapikan ownership token/component CSS sambil komponen tersebut diubah; hapus inline hover/legacy overrides setelah visual check. Hindari rewrite seluruh UI sekaligus.

## Paket implementasi pertama yang disarankan

1. **PR A:** kontrak status/payload/waktu, laporan legacy, dan constraint validation yang aman.
2. **PR B:** connector + viewport persistence dengan query links per board dan guard konflik.
3. **PR C:** batch mutation + operation receipt + undo/redo block/connector atomik.
4. **PR D:** Calendar Day/Week + CRUD + timezone; lanjut Month dan time-blocking dalam PR berikutnya.

Setiap PR memiliki acceptance tests untuk reload, request gagal, stale response/conflict, tenant isolation, dan data legacy. Implementasi dianggap selesai ketika seluruh alur UI → API → database → reload terverifikasi, bukan saat komponen tampil atau tabel sudah tersedia.
