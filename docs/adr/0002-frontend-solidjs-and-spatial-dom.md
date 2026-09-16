# ADR 0002: Pemilihan Frontend SolidJS & Custom Spatial DOM Canvas

## Status
Diterima (Accepted)

## Tanggal
2026-09-16

## Konteks
Fitur inti ORCA adalah papan brainstorming visual (*spatial canvas*) yang menggabungkan catatan teks, sticky notes, kartu task, gambar, dan konektor relasional. 
Di ekosistem web, terdapat dua pendekatan utama untuk membangun canvas:
1. **React + `tldraw`:** Solusi siap pakai yang sangat populer, tetapi memiliki overhead runtime Virtual DOM dan `tldraw` berorientasi pada whiteboard/drawing vector bebas daripada kartu terstruktur. Menggabungkan form HTML atau rich text di dalam canvas React sering kali memicu re-render yang berat saat kartu di-drag.
2. **WebGL / Canvas Murni (ala Figma):** Menuntut penulisan ulang seluruh logika teks, kursor, dan form input dari awal (sangat tidak realistis untuk solo developer).
3. **SolidJS + Spatial DOM (ala Milanote):** Menggunakan kartu berbasis elemen HTML native yang diposisikan dengan CSS `transform: translate3d(x, y, 0)`, dipadukan dengan layer SVG untuk garis koneksi.

## Keputusan
Kami memutuskan untuk menggunakan **SolidJS + Vite (TypeScript)** untuk frontend web app, dengan pendekatan **Custom Spatial DOM Board + SVG Connectors**:
1. SolidJS tidak menggunakan Virtual DOM, melainkan *fine-grained reactivity*. Fungsi komponen hanya dijalankan satu kali saat inisialisasi; pembaruan koordinat `(x, y)` saat kartu di-drag langsung memutasi properti style DOM spesifik tanpa me-re-render isi kartu.
2. Kartu tetap berupa elemen HTML native (`div`), sehingga mendukung rich text editor, form interaktif, aksesibilitas, dan seleksi teks secara alami.
3. Garis penghubung dirender reaktif di atas layer SVG.

## Konsekuensi
- **Positif:** 
  - Performa drag, pan, dan zoom stabil di 60/120 fps tanpa *re-render cascade*.
  - Beban memori dan ukuran bundle frontend sangat kecil.
  - Kartu dapat diisi komponen web standar dengan bebas.
- **Negatif:**
  - Harus membangun sendiri sistem kontrol viewport (pan, zoom, multi-select marquee) alih-alih memakai framework canvas turnkey seperti `tldraw`.
