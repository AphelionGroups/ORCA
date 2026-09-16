# ADR 0006: Arsitektur Input Stylus/Pen untuk Brainstorming Tablet

## Status
Diterima (Accepted)

## Tanggal
2026-09-16

## Konteks
Brainstorming visual dan pencatatan ide di atas tablet (iPad dengan Apple Pencil atau Android dengan S-Pen) menuntut kemampuan mencoret atau menulis bebas (*handwriting/freehand drawing*).
Elemen HTML DOM (`div`) tidak dapat merender goresan kuas atau pulpen yang mulus secara alami. Diperlukan strategi teknis untuk mendukung input stylus tanpa harus membuang keunggulan Spatial DOM yang sudah dipilih di ADR 0002.

## Keputusan
Kami merancang arsitektur input pen/stylus sebagai berikut (dijadwalkan untuk rilis **v0.2**):
1. **Layered Architecture:**
   - Menambahkan layer canvas/SVG transparan di atas/di antara kartu Spatial DOM.
   - Menggunakan API browser native `PointerEvent` (`e.pointerType === 'pen'` dan `e.pressure`) untuk mendeteksi stylus.
2. **Library Vektor: `perfect-freehand`:**
   - Menggunakan library agnostik `perfect-freehand` (tanpa ketergantungan React).
   - Mengonversi titik koordinat mentah `[x, y, pressure]` menjadi kurva Bézier halus dan merendernya sebagai path SVG (`<path d="..." />`).
3. **Pemisahan Gesture & Palm Rejection:**
   - Menerapkan CSS `touch-action: none` pada area kanvas.
   - Input stylus otomatis mengaktifkan mode gambar (*ink*).
   - Sentuhan 2 jari digunakan untuk navigasi kanvas (*pan & pinch-to-zoom*). Sentuhan telapak tangan yang lebar diabaikan.
4. **Penyimpanan Berbasis Vektor (JSONB):**
   - Hasil coretan disimpan sebagai array koordinat vektor di database PostgreSQL, bukan gambar bitmap (PNG/JPEG), agar ukuran data tetap kecil dan tidak pecah saat di-zoom.

## Konsekuensi
- **Positif:**
  - Tetap mempertahankan SolidJS tanpa perlu mengimpor runtime React hanya demi fitur drawing.
  - Performa rendering goresan tinta dapat mencapai 120Hz (ProMotion) di perangkat tablet.
  - Goresan tersimpan dalam format vektor yang dapat diproses oleh AI/OCR di masa depan.
- **Negatif:**
  - Fitur ini memerlukan penanganan gesture yang cermat pada berbagai browser seluler/tablet untuk menghindari konflik antara scrolling bawaan dan menggambar.
