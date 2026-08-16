# PRD — Money Tracker (Household Finance Tracker)

**Versi:** 1.0
**Tanggal:** Agustus 2026
**Stack:** Next.js + Supabase (+ PWA), Google Sheets sebagai mirror/report

---

## 1. Latar Belakang

Kebutuhan mencatat arus keuangan rumah tangga (suami & istri) dalam satu sistem yang:
- Mencatat pendapatan, pengeluaran, dan transfer uang antar pasangan
- Menampilkan saldo total rumah tangga sekaligus saldo cash yang dipegang masing-masing (siapa pegang berapa)
- Sinkron otomatis ke Google Spreadsheet sebagai laporan/backup yang mudah diakses tanpa buka app
- Bisa diakses cepat dari HP tanpa install dari App Store/Play Store (via PWA)

## 2. Masalah yang Diselesaikan

Money tracker konvensional (income vs expense) tidak menangkap kasus **transfer internal** — misalnya suami gajian lalu memberi sebagian ke istri untuk belanja. Jika dicatat sebagai income + expense terpisah, saldo total rumah tangga jadi salah hitung (double counting). Aplikasi ini memisahkan konsep **saldo rumah tangga** (total) dari **kepemilikan cash** (siapa pegang berapa).

## 3. User

- **Suami** — sumber pendapatan utama (gajian, dll), input transaksi
- **Istri** — pengelola pengeluaran rumah tangga, input transaksi
- Tidak ada role admin/viewer terpisah — keduanya setara, akses via shared link (tanpa auth ketat, private link)

## 4. Konsep Inti

| Konsep | Definisi |
|---|---|
| **Saldo total rumah tangga** | `SUM(income) - SUM(expense)` — transfer diabaikan karena net-nya 0 |
| **Cash per holder** | Saldo yang secara fisik/riil dipegang suami atau istri, dipengaruhi income, expense, dan transfer |
| **Transfer** | Perpindahan uang antar holder, tidak dihitung sebagai income/expense rumah tangga |

### Contoh Kasus
1. Suami gajian Rp 6.700.000 → `income, holder=suami`
2. Suami kasih istri Rp 500.000 → `transfer, from_holder=suami, holder=istri`

Hasil: saldo total tetap Rp 6.700.000. Cash suami = Rp 6.200.000, cash istri = Rp 500.000.

## 5. Fitur MVP (Fase 1)

### 5.1 Input Transaksi
- Form dengan pilihan tipe: **Income / Expense / Transfer**
- Field: nominal, kategori (untuk income/expense), payment method, holder, tanggal, deskripsi
- Khusus transfer: field tambahan "dari holder" dan "ke holder"

### 5.2 Dashboard
- Saldo total rumah tangga
- Breakdown cash per holder (suami vs istri), visual sederhana (progress bar/kartu)
- Transaksi terbaru (5–10 terakhir)

### 5.3 Riwayat Transaksi
- List semua transaksi dengan filter: holder, tipe, kategori, rentang tanggal
- Edit & hapus transaksi (soft delete — data tidak hilang permanen, bisa di-recover jika salah hapus)

### 5.4 Kategori & Payment Method
- Master data kategori (income: gaji, bonus, lainnya; expense: makan, transport, tagihan, dll — dapat ditambah manual)
- Master data payment method (cash, transfer bank, e-wallet, QRIS)

### 5.5 Sinkronisasi Google Sheets
- Setiap transaksi baru otomatis ter-append ke Google Sheets (real-time via Supabase Database Webhook → Edge Function)
- Edit dan hapus transaksi juga ter-sync ke Sheets (update row / tandai baris sebagai dihapus)
- Sheets bersifat **read-only mirror**, bukan sumber input
- Fallback: tombol **"Full Resync"** untuk rebuild seluruh sheet dari database jika terjadi desync

### 5.6 PWA
- Bisa "diinstall" ke homescreen dari browser (manifest.json + service worker)
- Mobile-first UI, tombol input transaksi mudah dijangkau (floating action button)

### 5.7 Saldo Awal (Initial Balance)
- Saat pertama kali menggunakan app, user bisa mengatur saldo cash awal masing-masing holder
- Diimplementasikan sebagai transaksi bertipe `income` otomatis dengan kategori khusus **"Saldo Awal"**
- Hanya perlu diatur sekali (saat onboarding pertama kali), setelah itu input melalui form transaksi biasa

## 6. Fitur Fase 2 (Backlog)

- Target tabungan bulanan & alert jika pengeluaran harian melebihi batas
- Grafik pengeluaran per kategori (bulanan/mingguan)
- Input cepat via WhatsApp (Cloud API resmi Meta, berbasis webhook — tidak butuh server persistent)
- Export laporan bulanan (PDF/Excel)
- Reminder tagihan rutin (recurring bills)

## 7. Non-Goals (Di Luar Scope MVP)

- Multi-currency
- Multi-household / multi-tenant (aplikasi ini personal, bukan produk publik)
- Auth kompleks dengan role-based access control
- Integrasi rekening bank otomatis (open banking)

## 8. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js (App Router), Tailwind |
| Backend/DB | Supabase (Postgres, Edge Functions) |
| Sync eksternal | Google Sheets API (service account) |
| Hosting | Vercel (frontend), Supabase Cloud (backend) |
| Distribusi | PWA (manifest + service worker) |

Lihat detail arsitektur di `TECH-STACK.md` dan skema database di `DATABASE-SCHEMA.md`.

## 9. Metrik Keberhasilan (Personal Project)

- Kedua user (suami & istri) rutin mencatat transaksi harian tanpa merasa ribet (waktu input < 15 detik per transaksi)
- Saldo di app selalu match dengan kondisi cash riil (validasi manual mingguan di awal)
- Data di Google Sheets selalu ter-update tanpa delay signifikan (< 5 detik dari input)

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Free tier Supabase/Vercel/Google Sheets API terlampaui | Volume transaksi personal kecil, jauh di bawah limit free tier — monitor berkala |
| Link app bocor ke pihak luar (tanpa auth ketat) | Pasang RLS dasar + gunakan URL yang tidak mudah ditebak, evaluasi tambah PIN sederhana jika perlu |
| Salah input holder/tipe transaksi | UI form yang jelas, konfirmasi visual setelah submit, fitur edit mudah diakses |
