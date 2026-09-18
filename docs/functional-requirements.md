# Spesifikasi Kebutuhan Fungsional (Functional Requirements)

Dokumen ini memetakan seluruh kebutuhan fungsional sistem **ORCA**, baik untuk target rilis **MVP (v0.1)** maupun **Roadmap Lanjutan (v0.2+)**.

---

## 1. Kebutuhan Fungsional MVP (v0.1)

### Modul 1: Workspace & Autentikasi (FR-AUTH)
- **FR-AUTH-01 (Autentikasi Mandiri):** Pengguna dapat mendaftar (*sign up*) dan masuk (*sign in*) menggunakan email dan kata sandi.
- **FR-AUTH-02 (Session / Token):** Sistem menerbitkan session cookie berbasis HTTP-only yang aman atau JWT token.
- **FR-AUTH-03 (Tenant Scoping):** Setiap operasi data (query dan mutasi) wajib dibatasi oleh `workspace_id`. Pengguna secara default memiliki 1 personal workspace.

### Modul 2: Spaces & Multi-Domain Contexts (FR-SPACE)
- **FR-SPACE-01 (Manajemen Space):** Pengguna dapat membuat dan mengelola beberapa Space terpisah untuk membagi peran hidup (contoh default: `🏢 Kantor`, `👤 Pribadi`, `🚀 Bisnis A`, `📈 Bisnis B`).
- **FR-SPACE-02 (Context Switcher):** Pengguna dapat berpindah fokus antar Space dengan 1 klik via sidebar atau shortcut keyboard.
- **FR-SPACE-03 (All-Spaces Unified View):** Mode tampilan agregat yang menampilkan gambaran besar seluruh proyek, tugas, dan agenda dari semua Space sekaligus.

### Modul 3: Quick Capture & Global Inbox (FR-INBOX)
- **FR-INBOX-01 (Global Quick Capture Modal):** Modal popup cepat yang dapat dipanggil dari mana saja menggunakan tombol pintas (`Ctrl + K` / `Cmd + K`).
- **FR-INBOX-02 (Rapid Thought Ingestion):** Pengguna dapat mengetik ide, catatan kilat, atau tugas baru dalam hitungan detik tanpa harus langsung memilih kategori/project.
- **FR-INBOX-03 (Inbox Triage):** Menyediakan antarmuka "Inbox" untuk memproses dan memindahkan ide/tugas yang terkumpul ke Space atau Project yang relevan di kemudian waktu.

### Modul 4: Project Hub (FR-HUB)
- **FR-HUB-01 (Wadah Terpadu Inisiatif):** Setiap Project berfungsi sebagai wadah kerja terpadu (*hub*) yang memiliki 3 tampilan/tab utama:
  1. Tab **Docs & Plans** (Dokumentasi & Strategi)
  2. Tab **Board** (Brainstorming Visual Kanvas)
  3. Tab **Tasks** (Eksekusi Kanban / List)
- **FR-HUB-02 (Status & Metadata Project):** Pengguna dapat mengatur status proyek (`active`, `planning`, `on_hold`, `completed`, `archived`) dan menautkan target deadline proyek.

### Modul 5: Documents & Business Knowledge (FR-DOC)
- **FR-DOC-01 (Long-form Rich Docs):** Pengguna dapat membuat dan mengedit dokumen panjang berbasis Markdown / Rich Text untuk:
  - *Brand Guidelines* (identitas visual, brand voice, target persona).
  - *Product / Feature Planning* (PRD, spesifikasi fitur, requirements).
  - *Activity Plan* (rencana kampanye peluncuran, jadwal rilis, SOP operasional bisnis).
- **FR-DOC-02 (Text-to-Task Conversion):** Pengguna dapat memblok/menyorot sebaris teks dalam dokumen dan mengubahnya secara langsung menjadi Task aktif di proyek tersebut.
- **FR-DOC-03 (Embedded Components):** Dokumen dapat menyematkan (*embed*) kartu task, tautan ke board, atau checklist interaktif.

### Modul 6: Task & Project Management (FR-TASK)
- **FR-TASK-01 (Pembuatan Task & Atribut):** Pengguna dapat membuat task dengan atribut:
  - Judul (wajib)
  - Deskripsi (Markdown format)
  - Status (`todo`, `in_progress`, `done`, `cancelled`)
  - Prioritas (`low`, `medium`, `high`, `urgent`)
  - Tanggal tenggat (*due date*)
  - Estimasi durasi (dalam menit, wajib untuk kebutuhan time-blocking)
- **FR-TASK-02 (List View):** Pengguna dapat melihat daftar task terkelompokkan berdasarkan status, prioritas, project, atau space, dengan fitur sorting & filtering.
- **FR-TASK-03 (Kanban Board View):** Pengguna dapat memindahkan status task antar kolom Kanban secara drag-and-drop.
- **FR-TASK-04 (Subtasks):** Pengguna dapat membuat subtask bertingkat di dalam sebuah task induk.

### Modul 7: Kalender, Time-Blocking & Daily Rituals (FR-CAL)
- **FR-CAL-01 (Tampilan Kalender Unified):** Pengguna dapat melihat seluruh jadwal dalam mode Bulanan (*Month*), Mingguan (*Week*), dan Harian (*Day*) yang menggabungkan seluruh event dari semua Space.
- **FR-CAL-02 (Google Calendar 1-Way Sync):** Pengguna dapat menghubungkan akun Google via OAuth2 untuk menarik jadwal kalender secara otomatis ke kalender ORCA.
- **FR-CAL-03 (Drag-and-Drop Time-Blocking):** Pengguna dapat menarik task dari daftar tugas ke slot jam kosong di kalender untuk membentuk alokasi waktu (*time-block*).
- **FR-CAL-04 (Daily Planning Ritual):**
  - **Morning Planning:** Antarmuka khusus di pagi hari untuk memilih 3–5 tugas prioritas dari berbagai Space dan mengalokasikan jam kerjanya di kalender.
  - **Evening Shutdown:** Antarmuka penutup hari untuk mereview tugas yang selesai dan menjadwalkan ulang (*reschedule*) tugas yang belum selesai ke esok hari.

### Modul 8: Spatial Brainstorming Board & Notes (FR-BOARD)
- **FR-BOARD-01 (Infinite Spatial Canvas):** Pengguna dapat menavigasi canvas dua dimensi dengan fitur *pan* (geser ruang) dan *zoom in / zoom out* (skala 20% hingga 200%).
- **FR-BOARD-02 (Draggable Note Cards):** Pengguna dapat meletakkan kartu di koordinat `(x, y)` mana pun pada canvas, serta memindahkannya secara bebas (*drag-and-drop*).
- **FR-BOARD-03 (Jenis Blok Konten):**
  - **Sticky Notes:** Kartu catatan pendek dengan pilihan warna latar.
  - **Text / Rich Note:** Kartu catatan teks kaya.
  - **Task Embed:** Kartu representasi langsung dari task.
  - **Media / Image Card:** Kartu gambar referensi/moodboard via URL atau upload file lokal.
- **FR-BOARD-04 (Card-to-Task Conversion):** Kartu ide atau sticky note di canvas dapat dikonversi menjadi task resmi hanya dengan satu klik.
- **FR-BOARD-05 (Connector Lines):** Pengguna dapat menarik garis panah relasional (SVG) antar kartu untuk memetakan diagram alur, mindmap, atau struktur ide bisnis.

### Modul 9: Cross-Linking & Integrasi Data (FR-LINK)
- **FR-LINK-01 (Unified Entity Link):** Menghubungkan note card, dokumen, task, atau event kalender secara polimorfik.
- **FR-LINK-02 (Backlink & References Panel):** Melihat keterkaitan suatu task terhadap dokumen atau kartu board yang memicunya.

---

## 2. Kebutuhan Fungsional Roadmap Lanjutan (Post-MVP)

### Modul 10: Tablet & Freehand Stylus Input (v0.2)
- **FR-PEN-01 (Stylus Recognition):** Sistem mendeteksi stylus pen secara native (`pointerType === 'pen'`) dan membedakannya dari sentuhan jari.
- **FR-PEN-02 (Dynamic Pressure Inking):** Menghasilkan goresan tinta digital halus berbasis tekanan stylus menggunakan algoritma Bézier via `perfect-freehand`.
- **FR-PEN-03 (Natural Palm Rejection):** Telapak tangan yang menempel pada layar tablet saat menulis tidak menggerakkan canvas atau menghasilkan coretan yang tidak diinginkan.
- **FR-PEN-04 (Two-Finger Gestures):** Navigasi canvas di tablet menggunakan 2 jari (pan & pinch-to-zoom), sementara stylus digunakan untuk menulis/menggambar.

### Modul 11: Local-First & Sinkronisasi Offline (v0.3)
- **FR-SYNC-01 (IndexedDB Local Store):** Semua perubahan note, dokumen, dan task disimpan instan ke basis data browser lokal pengguna.
- **FR-SYNC-02 (Offline Capability):** Pengguna dapat membuka, membuat note, dan mengelola task tanpa koneksi internet sama sekali.
- **FR-SYNC-03 (CRDT / Delta Sync Engine):** Sinkronisasi otomatis saat perangkat kembali online dengan penanganan konflik deterministik.

### Modul 12: AI Intelligence Layer (v0.4)
- **FR-AI-01 (Daily Briefing):** AI menganalisis kalender dan task hari ini untuk menghasilkan rekomendasi fokus harian lintas Space.
- **FR-AI-02 (Business Document Synthesis & Ideation):** AI dapat membaca dokumen strategi/brand dan kartu di board untuk menyusun action items atau ringkasan eksekutif.
- **FR-AI-03 (Natural Language Task Creation):** Pengguna dapat mengetik instruksi bahasa alami (*"Jadwalkan review roadmap Bisnis A besok jam 3 sore selama 1 jam"*), dan AI otomatis membuat task serta time-block di kalender.
