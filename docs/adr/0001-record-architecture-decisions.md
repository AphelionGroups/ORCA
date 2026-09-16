# ADR 0001: Pencatatan Keputusan Arsitektur Menggunakan ADR

## Status
Diterima (Accepted)

## Tanggal
2026-09-16

## Konteks
Proyek ORCA dirancang sebagai aplikasi personal workspace modular yang nantinya akan dirilis sebagai open-source dan berpotensi menjadi SaaS. Dalam pengembangannya, banyak keputusan teknis penting yang diambil (pilihan framework, pola database, trade-off arsitektur). Tanpa pencatatan sistematis, konteks mengapa suatu keputusan diambil akan hilang di masa depan, terutama saat proyek berkembang atau melibatkan kontributor baru.

## Keputusan
Kami mengadopsi format **Architecture Decision Records (ADR)** berbasis file Markdown di dalam folder `docs/adr/`. Setiap ADR memuat:
1. **Status:** Diusulkan, Diterima, Ditolak, atau Digantikan.
2. **Konteks:** Masalah dan alasan mengapa keputusan ini harus diambil.
3. **Keputusan:** Solusi dan pendekatan teknis yang dipilih.
4. **Konsekuensi:** Manfaat positif maupun trade-off negatif dari keputusan tersebut.

## Konsekuensi
- **Positif:** Semua keputusan teknis memiliki riwayat yang transparan dan dapat dilacak. Mencegah debat berulang atas topik yang sudah pernah diputuskan.
- **Negatif:** Menambah sedikit beban penulisan dokumentasi saat melakukan perubahan arsitektur besar.
