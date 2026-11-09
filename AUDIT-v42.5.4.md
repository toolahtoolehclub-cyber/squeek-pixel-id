# AUDIT-v42.5.4 — Restore WalletConnect: status terlihat + tombol nonaktif selama restore

## Masalah (laporan user, 08:32 WIB 9 Nov 2026, 2 screenshot)
User membuka https://squeekpixel.web.id/ (v42.5.3) dan langsung melihat
tombol `[ CONNECT WALLET ]` + alamatnya sudah terisi, padahal OKX
(DApp Terhubung) menunjukkan "Squeek Pixel ID" **MASIH connect** — dan
ikon hamster kini tampil benar di OKX (perbaikan ikon v42.5.1 berhasil).
User bingung: kenapa situs bilang belum connect, kenapa harus connect lagi,
dan kenapa alamatnya sudah ada di kolom (padahal ia tidak pernah paste).

Penjelasan (sudah disampaikan parent): alamat di kolom itu dari
localStorage `sqk38:wallet` — diingat, bukan koneksi (by design, ada label
MANUAL). OKX menyimpan sesi di pihaknya, tapi situs di Chrome harus
menghidupkan lagi sesi itu tiap kali halaman dibuka: unduh bundle WC
2,1 MB dulu (di koneksi user ~3–12 K/s bisa 1–3 menit), baru `enable()`.
Selama restore berjalan, tombol masih menunjukkan CONNECT WALLET, jadi
user mengira restore gagal padahal mungkin masih jalan. Alasan gagal
restore (bundle-timeout / no-accounts / enable-rejected) sudah ditampilkan
v42.5.2 sebagai teks kecil — user tidak menyadarinya.

## Perbaikan (client saja; Worker tetap v13, engine.js TIDAK berubah)
Logika restore v42.5.2 **TIDAK diubah**: `enable()` bila `p.session` ada,
tunggu bundle 60 dtk, preload bila kunci `wc@2:` ada, `showQrModal:false`.
Yang berubah hanya UI di sekitarnya:

1. **Status restore TERLIHAT.** Begitu `restoreWalletConnectSession()`
   mulai (kunci `wc@2:` ada), `setWcRestoreNote('restoring')` menampilkan
   satu baris status di area kartu wallet: `MENGHUBUNGKAN KEMBALI KE
   WALLET…` / `RECONNECTING TO YOUR WALLET…` (i18n EN+ID, kunci baru
   `wcRestoring`), gaya `.restoring` (cyan, 13px bold, berbordir — sama
   bobotnya dengan `.wallet-status`), dan tombol CONNECT WALLET
   **dinonaktifkan** selama restore berjalan (supaya user tidak mengetuk
   connect di tengah restore dan membuat sesi ganda). Berhasil → TERHUBUNG
   (sudah ada, via `setConnected`). Gagal → alasan tampil jelas (poin 2).
2. **Alasan gagal DITAMPILKAN JELAS.** `#wcRestoreNote` kini 13px bold
   berbordir dengan kelas `.failed` (kuning), bukan lagi teks 11px
   opacity .75. Teks template TIDAK berubah
   (`WC RESTORE GAGAL: {reason} — KETUK [ CONNECT WALLET ] UNTUK
   MENGHUBUNGKAN LAGI.` / EN) — hanya tampilannya. Kode alasan tetap
   (bundle-timeout / no-accounts / enable-rejected); `no-session-key`
   dicatat tapi tidak ditampilkan (itu keadaan normal belum-pernah-connect).
3. **Status tidak pernah menempel.** `restoreWalletConnectSession()`
   membungkus isi restore dalam `try/finally`: bila body berakhir tanpa
   alasan akhir (throw tak terduga), finally membersihkan `'restoring'`
   (lalu outer catch melaporkan `bundle-timeout`). `setTab()` tidak
   menyentuh elemen/alasan restore — `say('')` hanya membersihkan
   `#message`, jadi pindah tab tidak bisa membuat status menempel maupun
   menghidupkannya kembali; status mencerminkan keadaan restore yang
   sebenarnya, bukan tab.

## Detail implementasi
- `setWcRestoreNote(reason)`: keadaan baru `'restoring'` (tampilkan +
  kelas `restoring` + teks `msg('wcRestoring')`); kegagalan (kelas
  `failed`); `null`/`no-session-key` (sembunyikan). Juga menonaktifkan
  tombol connect saat `'restoring'` dan mengaktifkannya kembali saat
  alasan gagal — lewat `$('connectBtn')` langsung dengan null-check,
  supaya harness tes lama (yang `$`-nya hanya mengenal `wcRestoreNote`)
  tetap jalan.
- `updateConnectBtn()`: cabang baru — bila `wcRestoreReason ===
  'restoring'`, tombol nonaktif (teks tetap label connect). Guard
  `typeof wcRestoreReason !== 'undefined'` supaya harness yang mengekstrak
  fungsi ini tanpa mendeklarasikan variabel itu tetap jalan.
- `style.css`: `#wcRestoreNote` 13px bold berbordir; `.restoring` cyan,
  `.failed` kuning. HTML tidak berubah (elemen sudah ada sejak v42.5.2).
- `build-worker.sh` menunjuk folder v42.5.4 + Worker v13 (tidak ada deploy
  Worker di rilis ini; worker.js tidak berubah).

## Tes
- Baru `TEST-v42.5.4-restore-ui.js`: **28/28** — status reconnecting
  terlihat + tombol nonaktif selama restore (bundle lambat) lalu TERHUBUNG;
  sukses via passive read; gagal tiap alasan (enable-rejected,
  bundle-timeout, no-accounts) → alasan jelas + tombol aktif lagi +
  status tidak menempel; tanpa kunci sesi → note tersembunyi + tombol
  biasa; `init()` melempar → finally membersihkan, bundle-timeout tampil;
  i18n EN+ID; statis (status + finally + CSS + HTML + setTab tidak
  menyentuh note + gameVersion v42.5.4).
- Suite lama hijau: TEST-v34-neo.js **1815/1815** (termasuk perbaikan
  1 asersi usang yang sudah gagal di v42.5.3: `build-worker.sh` kini
  benar-benar menunjuk Worker v13), TEST-v42.5.js **144/144**,
  TEST-v42.5.3-ghost.js **27/27**, TEST-motif.js **11/11**,
  verify-icon-routes.js **9/9**. Total **2034**.
- `node --check` bersih untuk script.js / engine.js / worker.js.
- Asersi versi lama yang diperbarui ke v42.5.4: judul + gameVersion di
  TEST-v34-neo.js (5) dan TEST-v42.5.js (2, termasuk label salah
  'gameVersion v42.5.2' yang nilainya sudah v42.5.3).

## Verifikasi live
- (diisi setelah push) Judul v42.5.4, gameVersion v42.5.4, Worker GET /
  → version 13 (tidak berubah), /icon.png + /og.png 200, 3 bukti Genesis
  utuh, board D1 tidak berubah (Genesis scores 1 baris race 28280
  verified).

## Cara user menguji
Buka https://squeekpixel.web.id/ (refresh bila sudah terbuka): kartu
wallet harus menampilkan **"MENGHUBUNGKAN KEMBALI KE WALLET…"** dengan
tombol CONNECT WALLET yang tidak bisa diketuk selama beberapa detik,
lalu berubah menjadi **TERHUBUNG** (bila sesi OKX masih valid) atau satu
baris alasan gagal yang jelas (bila restore gagal — laporkan alasan
persisnya: bundle-timeout / no-accounts / enable-rejected).
