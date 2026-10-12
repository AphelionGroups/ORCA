# ORCA App Redesign — brief dan prompt untuk agent

Revisi: **10 Oktober 2026**. Acuan landing: branch `design/memorable-interactions`, commit `51d6f82` beserta implementasi sebelumnya. Dokumen ini menggantikan brief awal dengan style dan behavior web yang terakhir disetujui.

Dokumen ini dapat diberikan langsung kepada agent di repository **ORCA**. Mandatnya adalah mengimplementasikan redesign aplikasi agar satu identitas dengan ORCA-Land, termasuk hover dan motion, sambil mempertahankan fungsi produk. Ukuran layout aplikasi merupakan titik awal untuk diuji; token dan rincian behavior landing yang disebut sebagai acuan berasal dari source aktual.

## Prompt utama

Kamu bekerja pada aplikasi ORCA. Redesign antarmukanya mengikuti karakter landing ORCA-Land: terang, matte, profesional, tegas, tenang, dengan interaksi yang terasa hidup dan punya ciri khas. Pengguna utama adalah pengguna produktivitas umum; komunitas self-hosted adalah pasar sekunder. Kebutuhan bekerja, membaca, dan mengelola proyek menjadi prioritas.

Pelajari repository, AGENTS.md yang berlaku, branch aktif, stack, routing, komponen, tema, editor, state management, penyimpanan, dan pengujian. Pastikan target checkout: implementasi hosted dan demo dapat berbeda. Buat inventaris layar dan rencana singkat, lalu jalankan redesign per bagian hingga alur nyata bekerja. Deliverable adalah kode aplikasi yang berfungsi, bukan mockup statis.

Identitas harus serupa dengan landing, dengan kepadatan UI yang sesuai aplikasi. Jangan menyalin hero 100vh, heading pemasaran besar, atau spacing section 104px ke workspace. Jangan mengganti stack atau engine editor demi efek visual. Pertahankan API, autentikasi, permission, data, dan fitur yang tersedia.

## Acuan yang harus dibaca

Jika checkout landing tersedia, resolve path dari lokasi repository sebenarnya. Contoh berikut diasumsikan aplikasi berada di `D:/AphelionLabs/ORCA`:

| Source di `../ORCA-Land/main/`                                         | Isi yang menjadi acuan                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/styles/global.css`                                                | Warna, font, radius, tombol dasar, focus ring                                    |
| `src/styles/landing.css`                                               | Panel, card, pemisah, navigasi, hierarki permukaan                               |
| `src/styles/motion.css`                                                | Hover wash, badge panah, underline, active feedback, transisi dan reduced motion |
| `src/scripts/motion.ts`                                                | Pointer tracking, cleanup, reveal dan respons perubahan preferensi motion        |
| `src/components/SpacesExplorer.astro`                                  | Tab interaktif, selected state, keyboard dan pergantian konteks                  |
| `src/components/HeroBackground.astro`                                  | Motif air kutub, es berbidang, double exposure dan ombak balik                   |
| `src/components/InteractiveDemo.astro`                                 | Integrasi aplikasi asli; acuan batas antara demo dan konten landing              |
| `docs/04-design-brief.md`, `docs/14-memorable-interactions-handoff.md` | Keputusan visual terkini dan cakupan verifikasi                                  |

Lihat preview `http://127.0.0.1:4321/` jika tersedia. Bandingkan default, hover, fokus keyboard, tab, mobile dan reduced motion. URL publik landing adalah `https://orca.ocaty.com`; jika tampilannya tertinggal dari source, gunakan revisi source di atas.

Spaces Explorer pada landing adalah ilustrasi alur produk, bukan kontrak fitur atau screenshot aplikasi. Iframe demo berisi aplikasi asli di `https://orca-demo.ocaty.com/`. Audit aplikasi yang sedang dikerjakan untuk menentukan fungsi nyata; jangan menjadikan ilustrasi atau branch demo sebagai alasan mengubah autentikasi/persistence hosted. Jika source landing tidak tersedia, gunakan spesifikasi mandiri berikut.

## Identitas visual

Gunakan Snow sebagai latar, Polar sebagai teks dan aksi utama, serta Vapor Mint sebagai aksen terarah. Permukaan solid, garis tipis, tipografi rapi dan ruang yang cukup membentuk hierarki. Hindari glossy, glassmorphism, glow, kesan luxury, orange startup, atau ungu/biru elektrik sebagai identitas baru. Jangan menambah metrik atau dashboard dekoratif yang tidak membantu pekerjaan.

Gradient hanya boleh dipakai sebagai bagian ilustrasi air yang terbatas, bukan pada tombol, semua card, atau latar editor. Overlay antarmuka harus memperjelas lapisan; double exposure adalah motif ilustrasi, bukan teks yang digandakan atau panel transparan yang mengganggu keterbacaan.

### Token warna

| Token semantik         | Nilai     | Pemakaian                                  |
| ---------------------- | --------- | ------------------------------------------ |
| `background` / Snow    | `#F7FAF8` | Latar aplikasi dan sidebar                 |
| `surface`              | `#FFFFFF` | Editor, card, input, dialog                |
| `surface-muted` / Mist | `#E8EEEB` | Permukaan sekunder dan item terpilih       |
| `text-primary` / Polar | `#0D1B1E` | Judul, isi, ikon penting, tombol utama     |
| `text-secondary`       | `#526560` | Deskripsi dan metadata                     |
| `border-subtle`        | `#D6E2DA` | Pemisah dan batas panel dekoratif          |
| `accent` / Vapor Mint  | `#B2FFA9` | Detail identitas, wash, indikator aktif    |
| `focus-light`          | `#22643B` | Fokus yang terlihat pada permukaan terang  |
| `focus-dark`           | `#B2FFA9` | Fokus pada permukaan gelap                 |
| `action-primary-hover` | `#213638` | Dasar hover tombol Polar, dengan teks Snow |
| `border-hover`         | `#9DB9A7` | Penegasan batas card saat hover            |

Nilai tersebut berasal dari landing. Token aplikasi tambahan berikut adalah **usulan**, bukan warna yang sudah diwajibkan landing: `border-control: #6E8177`, `status-success: #287052`, `status-error: #A83246`. Uji pasangan aktual, termasuk dark theme; adjust warna pendukung jika diperlukan untuk kontras. Border dekoratif tidak cukup sebagai satu-satunya batas kontrol yang perlu dikenali.

Tombol utama memakai Polar dengan teks Snow. Secondary memakai permukaan terang/transparent dan teks Polar. Mint tidak dipakai sebagai body text di putih atau latar semua tombol utama. Status dan pilihan aktif memiliki teks/ikon/bobot/struktur yang jelas selain warna. Pusatkan nilai dalam token semantik tema yang sudah digunakan aplikasi, bukan hardcode di setiap layar.

### Bentuk, tipografi, kepadatan

- Font acuan: `'Segoe UI', 'Helvetica Neue', Arial, sans-serif`; satu keluarga utama.
- Body/kontrol 14–16px, metadata 12–13px, dokumen 16–18px dengan line-height 1.6–1.75. Judul halaman 24–32px semibold; judul panel 16–20px. Ukuran ini perlu diuji pada data nyata.
- Skala spacing 4/8/12/16/24/32px. Padding panel lazimnya 16–24px; row boleh lebih rapat bila tetap mudah dipilih.
- Radius card/dialog 8px, tombol/kontrol 4px. Pill hanya bila fungsi membutuhkan, bukan bentuk semua komponen.
- Card biasa tanpa shadow. Popover/dialog boleh memakai shadow ringan yang menjelaskan kedalaman, dengan permukaan solid.
- Target sentuh sekitar 44px; ikon visual boleh lebih kecil. Pada tabel padat, sediakan area klik dan alternatif akses yang memadai.
- Satu keluarga ikon, stroke konsisten; label tetap jelas dan ikon bukan dekorasi berlebihan.

## Kontrak interaksi: bagian terpenting redesign

Tujuannya adalah respons yang halus dan khas seperti landing, tetapi tetap efisien untuk penggunaan berulang. Hit area, teks, layout row dan posisi kontrol harus stabil. Hover tidak boleh menggeser seluruh tombol mengikuti pointer, membuat pengguna mengejar target, atau menggantikan selected state.

### Tombol: matte mint wash

Terjemahkan behavior tombol landing ke primitive bersama aplikasi:

1. Pada kontrol berlabel yang sesuai, tampilkan wash Mint berbentuk organik di balik isi tombol, terpotong batas tombol. Acuan bentuk: lebar 90% tombol, aspect ratio 1, radius `48% 52% 58% 42%`, scale dari 0.15 ke 1.
2. Posisi wash mengikuti pointer mouse di dalam tombol melalui `--hover-x` dan `--hover-y`; posisi awal landing 75%/75%. Fokus keyboard menggunakan posisi tetap yang konsisten.
3. Opacity wash acuan: primary 0.10, secondary 0.36. Latar primary saat hover `#213638`, teks label tetap Snow; secondary terang dengan teks Polar. Uji warna hasil compositing, bukan hanya warna token dasarnya.
4. Jika tombol memiliki ikon arah/navigasi, gunakan badge Mint kecil sekitar 24px, radius 3px, dengan ikon Polar. Badge muncul pada hover/focus. Hanya ikon arah yang bergerak kecil; label dan hit area tetap di tempat.
5. Acuan gerak panah landing: `translate(2px, -2px)` untuk tautan keluar, `translateY(3px)` untuk tautan ke demo. Pada aplikasi, arah mengikuti makna tindakan. Tombol save/delete/checkbox tidak perlu memperoleh panah hanya untuk meniru CTA web.
6. Active feedback acuan: `translateY(1px) scale(0.985)`, singkat, tanpa layout shift. Disabled/loading tidak menjalankan efek pointer atau menerima submit ganda.
7. IconButton padat, toolbar editor, row tugas dan handle board cukup mendapat tint/border/feedback sederhana. Terapkan wash terarah terutama pada CTA dan aksi penting, bukan setiap sel grid.

Jaga label dan ikon terpisah dalam markup. Selector hover navigasi tidak boleh mengubah warna label tombol Polar menjadi Polar juga; masalah ini sudah diperbaiki di landing dan tidak boleh muncul kembali di aplikasi. Semua varian harus diperiksa pada default, hover, fokus, active dan disabled.

### Link, navigasi, tab, card dan disclosure

| Komponen                      | Behavior yang dituju                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text link                     | Underline Mint tumbuh dari kiri pada hover/focus, dengan teks tetap terbaca. Ikon arah boleh bergerak kecil sesuai tujuan.                                                                                                |
| Sidebar/nav                   | Hover memakai tint ringan; aktif memakai Mist, teks Polar semibold dan indikator Mint. Aktif berasal dari route/state aktual dan tetap lebih kuat daripada hover. Focus ring terpisah.                                    |
| Tabs                          | Aktif jelas, `aria-selected` tepat; tab kontekstual dapat memakai Polar/Snow dengan badge Mint seperti Spaces Explorer. Keyboard kiri/kanan, Home/End dan roving tabindex bila memang pola tabs, bukan link router biasa. |
| Card proyek yang dapat dibuka | Batas menguat ke `#9DB9A7`, aksen Mint kecil; target navigasi jelas. Menu aksi terpisah dari aksi buka, tanpa nested button/link yang invalid.                                                                            |
| Card informasi                | Boleh mendapat penegasan batas ringan, tetapi tidak punya cursor pointer, focus stop atau efek menonjol yang menyiratkan aksi palsu.                                                                                      |
| Accordion/disclosure          | Ikon plus/chevron berubah mengikuti keadaan terbuka; highlight Mint kecil pada hover/focus. Konten tetap bisa diakses keyboard dan state tidak bergantung pada animasi.                                                   |
| Dialog/drawer/menu            | Masuk singkat dan tenang, focus management benar, Escape sesuai pola, fokus kembali ke pemicu setelah ditutup. Tidak menunda input sampai animasi selesai.                                                                |
| Editor, board, calendar       | Selection, caret, drag, drop target, handles, event dan focus memakai state nyata. Efek dekoratif tidak boleh mengintervensi koordinat pointer, selection teks, pan/zoom atau drag.                                       |

### Motion dan transisi konteks

| Parameter              | Acuan landing                    | Penerapan aplikasi                                 |
| ---------------------- | -------------------------------- | -------------------------------------------------- |
| Perubahan warna/border | 160ms                            | Kontrol bersama, hover/active yang ringan          |
| Mint wash              | Transform 480ms; opacity 240ms   | CTA yang menggunakan wash                          |
| Badge ikon             | Opacity 160ms                    | Tombol navigasi yang sesuai                        |
| Panah/underline        | 360ms                            | Microinteraction terbatas                          |
| Context transition     | Token 420ms; panel Spaces 240ms  | Gunakan 240–420ms untuk panel/route sesuai konteks |
| Easing utama           | `cubic-bezier(0.22, 1, 0.36, 1)` | Cepat merespons, lalu settle lembut                |

Landing memakai reveal sekali, opacity 0.65 ke 1 dan translateY 12px ke 0 selama 360ms. Aplikasi cukup memakai entrance yang lebih kecil, misalnya panel 4px, bila membantu perpindahan konteks. Jangan replay reveal pada setiap perubahan data, ketikan, row baru, atau scroll tabel. Workspace tidak membutuhkan animasi scroll section pemasaran.

Pertahankan router aplikasi. View Transitions boleh menjadi enhancement jika cocok dengan stack dan browser; tidak perlu mengganti router atau menambah library animasi besar. Navigasi tetap berjalan ketika enhancement gagal. Back/forward, deep link, query, scroll dan fokus harus benar. Jangan menambah loading buatan, layar transisi yang menahan pengguna, atau scroll hijacking.

### Mouse, keyboard, touch dan reduced motion

- Pointer tracking hanya untuk mouse dengan `(hover: hover) and (pointer: fine)` serta tanpa reduced motion. Maksimal satu update per `requestAnimationFrame`; hentikan frame dan reset CSS variables saat pointer keluar, preferensi berubah atau komponen unmount.
- Gunakan CSS untuk feedback sederhana. Jangan mengikat loop pointer ke seluruh document, memasang animasi permanen di setiap row, atau menambah `will-change` massal.
- Keyboard memperoleh feedback setara melalui `:focus-visible`, tanpa harus menggerakkan pointer. Focus ring acuan landing 3px Green pada terang atau Mint pada gelap; offset sekitar 3–5px dapat disesuaikan agar tidak terpotong container.
- Touch tidak bergantung hover dan tidak menyimpan wash yang tersangkut setelah tap. Aksi, menu dan informasi tetap ditemukan melalui klik/tap, fokus atau label.
- `prefers-reduced-motion: reduce` meniadakan tracking, gerakan dekoratif dan transisi transform, termasuk bila preferensi berubah saat aplikasi berjalan. Feedback warna, pilihan aktif dan fokus tetap terlihat.
- Efek latar opsional berhenti ketika tersembunyi/offscreen. Cleanup observer, listener, timer dan animation frame harus mengikuti lifecycle aplikasi.

## Motif polar: penggunaan yang sesuai aplikasi

Landing terbaru memiliki daratan Snow bertepi es yang berbidang, beberapa bongkahan es besar/kecil, air yang bergerak lembut, overlay/double exposure yang terlihat, serta ombak balik. Daratan dan bongkahan berbentuk tidak beraturan dengan sisi/bayangan ringan; jangan mengembalikan seluruh es menjadi blob bulat mulus.

Beat adalah **satu ketukan metronom setiap sekitar 8 detik**, bukan double pulse detak jantung. Foam bergerak dari batas es kembali ke air yang lebih gelap; aliran air tetap independen dan daratan tidak ikut berdenyut. Wave membelok dan meninggalkan wake di sekitar bongkahan, lalu mereda. Double exposure berupa lapisan air/foam yang sedikit bergeser, bukan chromatic glitch atau warna neon.

Motif ini **opsional** untuk welcome/auth atau ilustrasi empty state yang luas jika tidak mengganggu form dan pekerjaan. Jangan menjadikan editor, tasks, board atau calendar berlatar ombak terus-menerus. Ciri utama aplikasi tetap token, permukaan, detail Mint dan microinteraction kontrol. Tidak perlu menyalin kompleksitas simulasi ombak jika hanya akan menjadi dekorasi kecil. Jika motif digunakan, implementasikan dengan efek ringan sesuai stack, hormati reduced motion, dan ukur respons interaksi.

## Pemetaan ke aplikasi

Buat atau perbarui primitive bersama sesuai komponen yang sudah ada: Button, IconButton, Input/Textarea, Select, Checkbox, Tabs, Menu/Popover, Dialog/Drawer, Toast, EmptyState, LoadingState, ErrorState, ListRow/Card, Breadcrumb dan toolbar.

Sidebar desktop sekitar 220–260px adalah titik awal, dengan pemilih Space, navigasi utama, proyek dan akses akun/settings sesuai informasi aktual. Area utama memiliki header ringkas, konteks proyek, aksi utama yang jelas dan panel kerja luas. Pada mobile, sidebar menjadi drawer yang dapat digunakan keyboard. Hindari card bersarang dan nested scroll yang berlebihan.

Terapkan hanya pada layar/fitur yang benar-benar tersedia:

| Area                | Hasil visual yang diharapkan                                                      | Fungsi yang harus dipertahankan                                                 |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Login/registrasi    | Form terang, input jelas, CTA Polar; motif polar hanya jika mendukung keterbacaan | Validasi, auth, redirect, loading, error                                        |
| Spaces/Projects     | Daftar/card sederhana, judul dominan, metadata ringkas, hover dan aksi jelas      | Pemilihan Space, CRUD, permission, navigasi                                     |
| Project Hub         | Konteks proyek dan tabs/panel konsisten, pergantian halus                         | Routing, tab state dan data proyek                                              |
| Dokumen             | Editor putih luas, toolbar efisien, fokus baca                                    | Editing, selection, shortcut, undo/redo, paste, autosave/recovery bila tersedia |
| Board               | Canvas netral, node solid, selection dan handles terbaca                          | Pan/zoom, drag, resize, relasi dan persistence yang tersedia                    |
| Tasks               | Row/card rapat dengan hierarki judul, status, prioritas dan tanggal               | Create/update/complete, filter, drag bila ada, penyimpanan                      |
| Calendar            | Grid, today, tanggal terpilih dan event terbedakan                                | Navigasi waktu, create/edit, timezone; drag/resize hanya jika tersedia          |
| Inbox/Quick Capture | Capture cepat dan tujuan penyimpanan mudah dipahami                               | Capture, destination, konversi/recovery yang tersedia                           |
| Settings            | Kelompok jelas, kontrol dan state konsisten                                       | Preferensi, akun, tema dan konfigurasi yang tersedia                            |

Status saving/saved/error, jumlah, progress dan tanggal berasal dari state nyata. Jangan menambah indikator dummy. Fixture untuk QA/screenshot harus terpisah dari data pengguna. Empty state menjelaskan langkah berikutnya; error menyediakan recovery/retry yang benar bila tersedia; loading menjaga konteks dan mencegah aksi ganda.

Pertahankan sistem lokalisasi dan tema yang ada. Inggris dan Indonesia harus tetap terbaca bila tersedia, termasuk label panjang. Jika dark theme sudah ada, pertahankan pilihan/persistensinya dan buat pasangan token Polar/Mint yang terbaca; jangan menghapus tema atau memaksakan terang. Jika belum ada, dark theme bukan fitur baru dalam scope redesign.

## Batas implementasi

- Pertahankan API, model data, auth, permission, routing penting, persistence dan kemampuan produk. Jangan merapikan UI dengan menghapus fungsi yang dipakai.
- Pisahkan perbaikan regresi desain dari perubahan perilaku produk/model data yang lebih besar. Dokumentasikan bug lama yang ditemukan dan cakupan yang tidak dapat diuji.
- Jangan menambah fitur AI, offline, stylus, kolaborasi atau self-hosting berdasarkan aspirasi/marketing. Periksa fitur runtime yang benar-benar tersedia.
- Jangan mengubah landing atau menyalin Astro ke aplikasi. Port pola CSS/interaction ke stack ORCA.
- Demo browser-local dan hosted/API harus tetap memiliki batas auth serta storage yang benar. Jangan membawa bypass login demo atau sample data menjadi perilaku produksi.
- Jangan menggunakan data produksi untuk QA atau publish/deploy aplikasi sebagai bagian mandat redesign ini.

## Urutan implementasi dan commit

1. **Audit dan baseline.** Identifikasi branch/target, inventaris layar, komponen, tema dan alur utama. Rekam screenshot dengan data aman dan masalah yang sudah ada.
2. **Rencana dan tokens.** Tulis implementation plan ringkas, mapping tokens dan komponen, serta risiko regresi. Terapkan tema dan primitive shared.
3. **Interaction foundation.** Implementasikan variant tombol, wash, focus, active, link, tabs dan reduced motion pada komponen bersama. Uji sebelum meluaskan ke layar.
4. **Shell dan satu alur lengkap.** Redesign navigasi dan Project Hub dengan fungsi nyata dari memilih proyek sampai membuka/mengubah konten. Jadikan hasilnya acuan kepadatan visual.
5. **Modul.** Terapkan konsistensi ke auth, dokumen, board, tasks, calendar, inbox dan settings yang tersedia. Periksa fungsi setelah setiap bagian, termasuk overlay/editor toolbar.
6. **QA dan handoff.** Selesaikan regresi, audit visual/state/keyboard/mobile/performa, lalu simpan panduan tokens dan interaction, screenshot sesudah, bukti tes dan batasan tersisa.

Ikuti branch/commit convention repository. Jika belum diatur, gunakan branch `design/orca-app-refresh` dan conventional commits per bagian, misalnya `feat(theme): align app palette with ORCA Land`, `feat(interactions): add matte mint hover feedback`, `feat(shell): refresh workspace navigation`, `feat(tasks): align task workspace` dan `docs(design): document app interaction system`. Commit setelah bagian diperiksa. Jangan menimpa perubahan pengguna atau mengganti branch tujuan tanpa memeriksa checkout.

## Acceptance criteria

- Aplikasi terasa satu keluarga dengan landing: warna utama tepat, permukaan solid/matte, aksen Mint terukur, radius dan hierarki konsisten. Semua layar terinventarisasi, termasuk dialog/menu/toolbar/error, memakai sistem yang sama.
- Hover berfungsi pada mouse, fokus keyboard setara, touch tidak mendapat sticky hover, selected state tetap jelas dan disabled/loading tidak menerima aksi ganda. Teks/hit area tidak bergerak mengikuti pointer.
- Kontras label normal minimal 4.5:1, teks besar minimal 3:1, dan indikator kontrol/fokus yang diperlukan minimal 3:1 terhadap warna bersebelahan. Ukur base dan warna hasil hover compositing, serta tema yang tersedia; warna Mint bukan satu-satunya indikator.
- Perubahan reduced motion saat runtime menghentikan efek terkait, menghapus posisi wash sebelumnya dan menjaga fokus/selection. Mount/unmount berulang tidak meninggalkan listener/frame/observer.
- Alur yang tersedia tetap bekerja: auth, memilih Space/proyek, mengedit dan menyimpan, tasks, board, calendar dan settings. Status berasal dari state nyata; permission dan data aman; shortcut penting tetap berfungsi.
- Uji viewport 360/768/1024/1440px dan zoom 200%, label panjang, data kosong/padat, bahasa dan tema yang tersedia. Tidak ada overflow layout; area canvas/tabel yang membutuhkan scroll punya affordance yang jelas.
- Uji keyboard tabs, menu/dialog/drawer dan pengembalian fokus; route/deep link/back/forward, pointer leave, drag/pan/selection dan submit saat loading. Periksa efek tidak menghalangi popover atau intercept pointer.
- Jalankan build/lint/typecheck/test sesuai repository. Tambahkan regresi untuk perilaku penting yang berubah, bukan tes yang hanya menyalin nilai CSS. Gunakan fixture aman; catat browser, route dan cakupan nyata.
- Respons editor dan aksi sering dipakai tetap cepat pada data realistis. Jangan mengklaim performa/Core Web Vitals lulus tanpa pengukuran; dokumentasikan pengukuran dan dependency tambahan jika ada.

**Deliverable:** kode yang bekerja, commit per bagian, inventaris dan implementation plan, panduan tokens/komponen/interaction, screenshot before/after desktop/mobile dengan data aman, hasil pengujian dan batasan tersisa. Laporkan layar yang sudah berubah, cara mencoba, fungsi yang diuji, risiko terbuka dan commit terkait. Jika environment menghalangi verifikasi, nyatakan bagian yang belum terbukti; jangan menganggap mockup sebagai aplikasi selesai.
