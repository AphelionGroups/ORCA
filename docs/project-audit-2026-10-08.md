> Audit ini mencatat kondisi sebelum perbaikan. Status implementasi terbaru: [Perbaikan integritas dan cleanup](integrity-cleanup-2026-10-09.md).

# Audit ORCA — 8 Oktober 2026

Baseline: design/orca-app-refresh, commit 7141977. Audit source frontend/backend, migration SQL, query repository, requirement dan pemeriksaan statistik database lokal. go test ./... dan go vet ./... lulus; sebagian test database memerlukan environment integrasi dan tidak dianggap telah dijalankan ulang di audit ini. Temuan perilaku di bawah ditelusuri dari kode; skenario rusak belum seluruhnya direproduksi di browser. Tidak ada perubahan implementasi atau data aplikasi.

## Ringkasan
Struktur modular monolith Go + SolidJS + PostgreSQL masih tepat. Risiko terbesar adalah alur yang belum selesai dari UI sampai persistence dan lifecycle data; bukan kebutuhan microservices atau database universal. Pemisahan ProjectsView menjadi panel sebelumnya membantu, tetapi controller bersama masih 3.001 baris dan CSS masih memiliki aturan legacy ditambah override redesign.

## Fitur yang belum matang
1. Calendar: tombol tanggal tidak punya handler, Month/Day/Timeline hanya mengubah pilihan. Event ditempatkan pada kolom tengah dengan topOffset berdasarkan urutan, bukan start/end dan tanggalnya. Backlog memakai cursor grab tanpa draggable/drop handler; estimasi 45m statis. Form offset mengasumsikan hari ini Rabu, menambah kelipatan 24 jam dan fallback jam 0 memakai operator ||. UI belum menyediakan edit/delete event meskipun backend punya endpoint. Sumber: web/src/views/CalendarView.tsx.
2. Board: connections hanya state frontend, tidak ada integrasi /links di api.ts. Saat load, dua block pertama yang memenuhi syarat dibuatkan connector otomatis. Pan/zoom selalu mulai default; viewport_state ada di schema/API tetapi tidak dibaca/disimpan dari view. Undo delete memanggil createNoteBlock memakai ID lama, sedangkan DeleteBlock hanya mengisi deleted_at dan CreateBlock melakukan INSERT biasa: konflik primary key, UI bisa terlihat pulih padahal server tidak pulih. Sumber: useProjectController.tsx:514,572,1899; internal/board/repository.go:220,255.
3. Docs: editor markdown + preview dan save manual/on-blur tersedia. Text-selection-to-task dan embedded live task/checklist/board widgets yang disebut FR-DOC belum diimplementasikan pada dokumen. Kegagalan save hanya console.error; belum ada recovery draft/revision/concurrency protection. Sumber: DocumentsPanel.tsx dan useProjectController.tsx:2806.
4. Tasks: CRUD dan status drag tersedia. Subtask belum ada UI walau parent_task_id ada. Kolom UI hardcoded empat status; projects.kanban_columns berbeda default dan tidak dipakai oleh TasksPanel. Sort/filter/grouping dan atribut seperti planned_date/estimated_minutes belum menjadi alur UI lengkap. Sumber: TasksPanel.tsx:40, ProjectModal.tsx:81, migration awal.
5. Links: endpoint/table tersedia, tetapi belum ada client/UI backlinks inspector dan connector integration. Ini fitur backend yang belum dikonsumsi, bukan otomatis dead code yang aman dihapus.
6. Inbox conversion: backend mengembalikan task_id/document_id di top level; client mengharapkan res.data. View sekarang mengabaikan return value sehingga konversi masih bisa terlihat berhasil, tetapi kontrak salah. Transaksi konversi sudah ada, tetapi SELECT note tanpa FOR UPDATE/claim conditional membuka risiko konversi ganda oleh request bersamaan; tidak menyimpan provenance relasi conversion. Sumber: internal/inbox/handler.go dan repository.go:130,184; api.ts:477.
7. Collaboration: Role selalu Owner di ToProfile; user terkait satu workspace, tidak ada membership/invite/RBAC. Sesuai personal MVP, belum dapat dianggap team workspace lengkap. Offline, stylus, AI, Google sync dan daily rituals yang tercantum roadmap/requirement belum merupakan alur produk lengkap. Jangan menyamakan roadmap dengan regresi.

## Integritas dan konsistensi kode
- Space/project/board/task soft delete tidak cascade. FK ON DELETE bekerja untuk DELETE fisik, bukan UPDATE deleted_at. Child list hanya memeriksa deleted_at sendiri; child dapat tetap muncul, sementara trigger menolak edit karena parent sudah tidak aktif. Tetapkan cascade/archive/detach/restore secara eksplisit dalam transaksi.
- Tidak ada allowlist status/priority di handler task dan CHECK pada schema untuk status, interval event atau estimasi nonnegatif. Status asing dapat tersimpan lalu menghilang dari kanban hardcoded. Task parent hanya dicegah menunjuk dirinya sendiri, belum siklus beberapa task.
- Update DTO belum membedakan omitted vs explicit null secara konsisten; beberapa field nullable tidak mudah dikosongkan, yang lain direset ketika tidak dikirim. Standarkan PUT replacement atau PATCH tri-state.
- Repository list tidak mengecek rows.Err() setelah loop. Query list belum punya pagination. JSON decoder inbox berbeda dari ParseJSON strict pada modul lain. Error/save behavior modal berbeda dari editor/canvas.
- Request gate ada di project, tetapi calendar load dari onMount dan createEffect berpotensi dobel dan tidak memproteksi filter dari respons lama. Tidak semua view memakai pola lifecycle yang sama.
- Frontend controller mencampur state docs/tasks/canvas, history, HTTP, geometry, event listeners dan render JSX toolbar/connectors. Pisahkan sesuai domain/use-case, bukan sekadar menambah komponen presentasi.
- index.css berisi legacy + override dan JSX masih banyak inline style/imperative mouse hover. focusScope mengasosiasikan label lewat struktur DOM: lebih baik deklarasikan for/id dan judul dialog langsung pada komponen bersama. tsconfig belum mengaktifkan strict; content:any dan response:any melemahkan kontrak.

## Overengineering dan dead-code candidates
- Redis dijalankan compose.override dan menjadi dependency API, tetapi tidak ada consumer Redis pada cmd/internal. Hapus dari kebutuhan default sampai benar-benar ada use-case.
- @solidjs/router ada di dependencies tetapi tidak diimport; App routing memakai signal. Pilih routing URL dengan deep-link/back navigation jika diperlukan, atau hapus dependency yang tidak dipakai.
- .chamfered-node, .docs-viewport, .floating-canvas-toolbar dan .header-search-input hanya ditemukan di CSS, bukan src TSX. Kandidat legacy CSS; verifikasi dynamic class/demo sebelum hapus.
- Polymorphic entity_links masih beralasan untuk hubungan lintas domain, tetapi memperkenalkan validasi trigger manual dan tidak punya lifecycle saat entitas soft-deleted. Jangan membuat entity supertable atau EAV untuk semua fitur.
- FK tenant, transaksi, migration versioning, request gate dan storage adapter bukan overengineering; semuanya menangani kebutuhan nyata. Tidak perlu menambah repository generic, event bus, CQRS atau CRDT sekarang.

## Rancangan database untuk pertumbuhan
Tujuannya migrasi kecil dan kompatibel, bukan schema tidak berubah selamanya.

Prioritas sebelum fitur baru:
1. Lifecycle: transaksi delete/restore parent dan child, aturan link aktif vs riwayat, serta provenance inbox conversion. Tombstone perlu dipulihkan lewat operasi restore yang aman, bukan INSERT ID lama.
2. Konkurensi: claim/lock inbox conversion, idempotency untuk create/convert, dan optimistic revision/version pada dokumen serta board blocks. updated_at saat ini tidak digunakan sebagai precondition; concurrent full updates last-write-wins.
3. Validasi: CHECK end_at > start_at, estimasi nonnegatif, allowlist status/priority, kontrak/version content JSONB per block type. FK tenant dipertahankan; cycle/subtask scope diperiksa pada service/transaksi.
4. Kanban: pilih fixed status atau customizable workflow. Jika fixed, UI dan kanban_columns harus satu kontrak. Jika custom memang requirement, gunakan project_columns dengan ID stabil, posisi, label dan mapping status; task merujuk column ID. Label kolom jangan menjadi identitas status.
5. Pagination sebelum indeks tambahan: contoh kandidat partial composite index tasks(workspace_id,project_id,created_at DESC,id) atau note_boards(workspace_id,project_id,updated_at DESC,id), dengan deleted_at IS NULL, mengikuti query nyata dan cursor. Tidak semua kandidat wajib dipasang. Bandingkan EXPLAIN (ANALYZE, BUFFERS) pada data representatif; statistik lokal kecil belum membuktikan bottleneck. COUNT block per board masih satu statement SQL, bukan network N+1, tetapi biaya correlated count perlu diuji.
6. Periksa biaya trigger: update posisi/content block juga mengecek parent dengan lookup tambahan. Batasi validasi immutable/scope pada perubahan relevan sambil mempertahankan aturan parent aktif; jangan melemahkan isolasi tenant hanya untuk mengurangi lookup. Audit FK/indeks redundant setelah pengukuran.
7. Membership hanya saat multiuser menjadi kebutuhan dekat: workspace_members(workspace_id,user_id,role), unik per pasangan; pindahkan konteks akses dari users.workspace_id secara bertahap. Jangan membuat semua tabel roadmap sekarang.
8. Attachment lifecycle bila upload tumbuh: catat object key, mime, ukuran, pemilik dan referensi, bukan hanya URL dalam JSON. Kalender memerlukan timezone IANA/user preference untuk tampilan/recurrence; TIMESTAMPTZ tetap dipakai untuk instant. Document revisions bila recovery/history diutamakan. Tambahkan lewat migrasi additive saat fiturnya dijalankan.

Pertahankan tabel relational untuk field yang difilter/diurutkan/divalidasi. JSONB cocok untuk payload block dan metadata opsional, dengan discriminated types dan content schema_version; tidak menggantikan FK/status/tanggal. entity_links dapat diperluas dengan relation dan metadata tanpa tabel baru untuk setiap ide, tetapi tipe yang diizinkan dan lifecycle endpoint tetap harus eksplisit. Jangan mengubah migration yang sudah terpasang; gunakan migration berikutnya dengan audit/backfill/constraint validation, dan expand-contract untuk perubahan breaking.

## Urutan pengerjaan yang disarankan
P0: undo/restore board, lifecycle delete, save error/recovery/concurrency, transaksi conversion dan kontrak API.
P1: calendar tanggal/jam/views/time-blocking yang benar; connector/viewport persistence; kontrak status/kanban.
P2: controller domain, primitives/style cleanup, strict typing, response contract, pagination/index berdasarkan benchmark, integration tests untuk failure/restore/concurrent conversion.
P3: subtasks, document-to-task, backlinks, membership atau integrasi sesuai prioritas produk; AI/offline/stylus setelah core stabil.

Test yang ada lulus tidak menutup gap ini: sebagian handler tests hanya validasi request dengan repo nil; inbox belum punya package tests; browser fixture baru tidak meniru unique constraint dan soft-delete restore. Tambahkan tes PostgreSQL isolated untuk invariant dan failure modes, bukan tes yang sekadar memeriksa markup/style.
