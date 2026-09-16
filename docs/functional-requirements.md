# Spesifikasi Kebutuhan Fungsional (Functional Requirements)

Dokumen ini memetakan seluruh kebutuhan fungsional sistem **ORCA**, baik untuk target rilis **MVP (v0.1)** maupun **Roadmap Lanjutan (v0.2+)**.

---

## 1. Kebutuhan Fungsional MVP (v0.1)

### Modul 1: Workspace & Autentikasi (FR-AUTH)
- **FR-AUTH-01 (Autentikasi Mandiri):** Pengguna dapat mendaftar (*sign up*) dan masuk (*sign in*) menggunakan email dan kata sandi.
- **FR-AUTH-02 (Session / Token):** Sistem menerbitkan session cookie berbasis HTTP-only yang aman atau JWT token.
- **FR-AUTH-03 (Workspace Scoping):** Setiap operasi data (query dan mutasi) wajib dibatasi oleh `workspace_id`. Pengguna secara default memiliki 1 personal workspace.

### Modul 2: Task & Project Management (FR-TASK)
- **FR-TASK-01 (Manajemen Project):** Pengguna dapat membuat, mengubah nama, dan mengarsipkan project/proyek kerja.
- **FR-TASK-02 (Pembuatan Task):** Pengguna dapat membuat task dengan atribut:
  - Judul (wajib)
  - Deskripsi (Markdown format)
  - Status (`todo`, `in_progress`, `done`, `cancelled`)
  - Prioritas (`low`, `medium`, `high`, `urgent`)
  - Tanggal tenggat (*due date*)
  - Estimasi durasi (dalam menit, untuk time-blocking)
- **FR-TASK-03 (List View):** Pengguna dapat melihat daftar task terkelompokkan berdasarkan status, prioritas, atau project, dengan fitur sorting & filtering.
- **FR-TASK-04 (Kanban Board View):** Pengguna dapat memindahkan status task antar kolom Kanban secara drag-and-drop.
- **FR-TASK-05 (Subtasks):** Pengguna dapat membuat subtask di dalam sebuah task induk.

### Modul 3: Kalender & Time-Blocking (FR-CAL)
- **FR-CAL-01 (Tampilan Kalender):** Pengguna dapat melihat kalender dalam mode tampilan: Bulanan (*Month*), Mingguan (*Week*), dan Harian (*Day*).
- **FR-CAL-02 (Event Mandiri):** Pengguna dapat membuat, mengedit, dan menghapus event langsung di kalender internal.
- **FR-CAL-03 (Google Calendar 1-Way Sync):**
  - Pengguna dapat menghubungkan akun Google melalui OAuth2.
  - Sistem secara otomatis menarik (*pull*) jadwal Google Calendar ke kalender ORCA secara berkala.
- **FR-CAL-04 (Time-Blocking Task):** Pengguna dapat menarik (*drag-and-drop*) sebuah task dari daftar todo ke slot waktu tertentu di kalender untuk membentuk sebuah alokasi waktu (*time-block*).

### Modul 4: Spatial Brainstorming Board & Notes (FR-BOARD)
- **FR-BOARD-01 (Infinite Spatial Canvas):** Pengguna dapat menavigasi canvas dua dimensi dengan fitur *pan* (geser ruang) dan *zoom in / zoom out* (skala 20% hingga 200%).
- **FR-BOARD-02 (Draggable Note Cards):** Pengguna dapat meletakkan kartu di koordinat `(x, y)` mana pun pada canvas, serta memindahkannya secara bebas (*drag-and-drop*).
- **FR-BOARD-03 (Jenis Blok Konten):**
  - **Sticky Notes:** Kartu catatan pendek dengan pilihan warna latar (kuning, hijau, biru, merah muda, abu-abu).
  - **Text / Rich Note:** Kartu catatan dengan dukungan formatting teks (bold, italic, heading, bullet list).
  - **Task Embed:** Kartu representasi langsung dari task yang ada di Modul Task.
  - **Media / Image Card:** Kartu yang menampilkan gambar via URL atau upload file lokal.
- **FR-BOARD-04 (Connector Lines):** Pengguna dapat menarik garis panah relasional (SVG) dari satu kartu ke kartu lain untuk memetakan alur ide.

### Modul 5: Cross-Linking & Integrasi Data (FR-LINK)
- **FR-LINK-01 (Unified Entity Link):** Pengguna dapat menghubungkan note card dengan task atau event kalender.
- **FR-LINK-02 (Backlink Panel):** Membuka detail task menampilkan semua kartu note atau event yang mereferensikan task tersebut.

---

## 2. Kebutuhan Fungsional Roadmap Lanjutan (Post-MVP)

### Modul 6: Tablet & Freehand Stylus Input (v0.2)
- **FR-PEN-01 (Stylus Recognition):** Sistem mendeteksi stylus pen secara native (`pointerType === 'pen'`) dan membedakannya dari sentuhan jari.
- **FR-PEN-02 (Dynamic Pressure Inking):** Menghasilkan goresan tinta digital halus berbasis tekanan stylus menggunakan algoritma Bézier via `perfect-freehand`.
- **FR-PEN-03 (Natural Palm Rejection):** Telapak tangan yang menempel pada layar tablet saat menulis tidak menggerakkan canvas atau menghasilkan coretan yang tidak diinginkan.
- **FR-PEN-04 (Two-Finger Gestures):** Navigasi canvas di tablet menggunakan 2 jari (pan & pinch-to-zoom), sementara stylus digunakan untuk menulis/menggambar.

### Modul 7: Local-First & Sinkronisasi Offline (v0.3)
- **FR-SYNC-01 (IndexedDB Local Store):** Semua perubahan note dan task disimpan instan ke basis data browser lokal pengguna.
- **FR-SYNC-02 (Offline Capability):** Pengguna dapat membuka, membuat note, dan mengelola task tanpa koneksi internet sama sekali.
- **FR-SYNC-03 (CRDT / Delta Sync Engine):** Saat perangkat terhubung kembali ke jaringan, perubahan lokal disinkronkan ke server pusat secara otomatis tanpa menimpa data yang valid (*conflict resolution*).

### Modul 8: AI Intelligence Layer (v0.4)
- **FR-AI-01 (Daily Briefing):** AI menganalisis jadwal kalender dan task prioritas hari ini untuk menghasilkan rekomendasi fokus harian.
- **FR-AI-02 (Note Synthesis & Brainstorming Sparring):** AI dapat membaca kartu-kartu di suatu board dan menghasilkan ringkasan atau rekomendasi langkah tindakan (*action items*).
- **FR-AI-03 (Natural Language Task Creation):** Pengguna dapat mengetik instruksi seperti *"Jadwalkan review arsitektur besok jam 2 siang selama 1 jam"* dan AI langsung membuat task serta event di kalender.
