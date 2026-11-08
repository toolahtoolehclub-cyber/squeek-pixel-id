# AUDIT-v42.5.1 — App icon (WalletConnect/OKX) + OG image + 4 bug fix

## Root cause

OKX menampilkan ikon generik untuk "Squeek Pixel ID" di layar DApp Terhubung,
dan preview link (og:image) di X/Discord tanpa gambar.

Penyebab: metadata WalletConnect di `script.js` mengarah ke
`https://squeekpixel.web.id/squeekchain-headline-simple.png`, dan
`og:image`/`twitter:image` di `index.html` mengarah ke URL yang sama —
**tapi file itu 404**. PNG tidak pernah ada di repo maupun di GitHub Pages:
tool push menolak file biner, jadi banner PNG tidak pernah ter-upload.
Satu-satunya yang ada di repo hanyalah referensi URL-nya.

Bukti: `curl https://squeekpixel.web.id/squeekchain-headline-simple.png`
→ 404 (dicek parent, 2026-11-09 ~02:32 WIB). File sumbernya hanya ada
di folder kerja lokal (`squeekchain-headline-simple.png`, 1600×900).

## Solusi (diputuskan, bukan dicoba-coba)

Jangan upload biner via GitHub MCP (`create_or_update_file` menerima string
teks dan akan merusak byte PNG). Gambar disajikan dari **Worker Cloudflare**
(yang sudah jadi server game ini) sebagai base64 yang di-embed di `worker.js`
(teks, jadi bisa di-push normal):

- Ikon baru `squeek-icon-512.png` (512×512): crop persegi dari banner —
  area bingkai neon tengah (x 621–978, y 318–762), hamster di tengah,
  bingkai neon tetap terlihat, latar gelap seperti aslinya, resize
  NEAREST supaya pixel-art tetap tajam. Dilihat langsung: hamster jelas,
  tidak terpotong. File PNG disimpan di folder ini sebagai arsip sumber;
  yang di-deploy adalah base64-nya di `worker.js`.
- Worker v11: route baru `GET /icon.png` (byte PNG ikon, 512×512,
  `Content-Type: image/png`, cache 1 tahun) dan `GET /og.png`
  (byte banner 1600×900 apa adanya). Keduanya konstanta base64 di
  `worker.js` — bundle tetap satu file (esbuild).
- Client v42.5.1: metadata WalletConnect `icons` → Worker `/icon.png`;
  `index.html` favicon + `apple-touch-icon` → Worker `/icon.png`;
  `og:image` + `twitter:image` → Worker `/og.png`.

## Perubahan

- `worker.js`: `ICON_PNG_B64` (25.116 chars) + `OG_PNG_B64` (242.308 chars),
  helper `pngResponse()`, route `/icon.png` + `/og.png`, version 10 → 11.
  Bundle esbuild: **440.080 byte** (< 1 MB).
- `script.js`: `icons` → Worker URL; `gameVersion: 'v42.5.1'`.
- `index.html`: favicon + apple-touch-icon + og/twitter image → Worker;
  title + h2 + description → v42.5.1. Meta Genesis tidak disentuh.
- `build-worker.sh`: menunjuk folder v42.5.1 + Worker v11.
- Tes: 2 asersi versi di TEST-v34-neo.js diperbarui ke v42.5.1 + 8 asersi
  baru di TEST-v42.5.js (ikon/OG wiring); 1 perbaikan tes: pemindai
  BNB/Binance kini mengecualikan konstanta base64 (data opaque — urutan
  "bnb" muncul acak di dalam base64, bukan kata BNB; diverifikasi:
  satu-satunya kemunculan ada di dalam base64).

## Bug 1–4 (dilipat ke rilis yang sama, versi tetap v42.5.1, Worker tetap v11)

### BUG 1 — Equip SQK kembali lepas (P0, dilaporkan user 02:39 WIB)

Root cause (ditemukan parent): `fetchShop()` menyinkronkan item Keju yang
dipakai dari server lalu MENULIS ULANG localStorage `sqk41:skin` secara
tanpa syarat dengan `{note, frame}` Keju — bila tidak ada item Keju yang
dipakai, ia menulis `{note: null, frame: null}` dan MENGHAPUS skin SQK yang
baru dipasang via `equipSqkItem`. `fetchShop()` jalan tiap kali tab SHOP
dibuka (dan setelah beli/equip Keju), jadi equip SQK selalu kembali lepas
(DIPAKAI ✓ 02:35 → [ EQUIP ] 02:36). Smoke test Bagian B tidak menangkap
ini karena equip SQK adalah langkah TERAKHIR (tidak ada fetchShop
sesudahnya).

Perbaikan: dua sumber skin hidup berdampingan.
- Kunci baru `sqk41:skin-keju` (disinkron server, HANYA ditulis
  `fetchShop()`/`equipItem`) dan `sqk41:skin-sqk` (lokal, HANYA ditulis
  `equipSqkItem`), plus penanda terakhir-di-equip per slot
  (`sqk41:skin-last`, `{note: 'keju'|'sqk', frame: ...}`).
- `shopSkin()` mengembalikan gabungan EFEKTIF: per slot, sumber yang
  terakhir di-equip menang; bila sumber pemenang kosong, jatuh ke sumber
  satunya (jadi slot note dan frame independen).
- `fetchShop()` TIDAK PERNAH menyentuh kunci SQK maupun penanda.
- Migrasi sekali: kunci lama `sqk41:skin` (v42.4) disalin ke kedua kunci
  baru lalu dihapus; kunci korup (bukan JSON) → default kosong.
- Ketahanan: `equipSqkItem` bila eth_call gagal TAPI
  `sqkState.owned[itemId] > 0` (sudah diketahui dari pembacaan toko
  sendiri) tetap mengizinkan equip; bila owned = 0/tidak diketahui →
  tetap ditolak (SHOP OFFLINE). Koneksi user lambat (~3 K/s, RPC sering
  gagal) tidak lagi memblokir equip item yang jelas dimiliki.

### BUG 2 — Panel hasil Lullaby masih menampilkan [ SUBMIT SCORE ]

Skor Lullaby memang tidak pernah disubmit (mode practice, +50 XP), tapi
tombol `lbSubmitBtn` tetap tampil di panel hasil — ditekan tidak ada
gunanya. Perbaikan: `resetLbSubmit()` kini menyembunyikan tombol
(`classList.toggle('hidden', ...)`) bila `lastResult` adalah Lullaby atau
Practice; lagu biasa tombol tetap tampil. Catatan "LULLABY SCORES DO NOT
COUNT" (tag di `resultKv`) tetap terlihat. Lapisan kedua sudah ada dan
tidak diubah: `submitLb()` return awal untuk Lullaby dan Practice.

### BUG 3 — Tombol mode LULLABY tidak berwarna

`style.css` mendefinisikan `--mode-accent` untuk free/daily/live/race,
tapi TIDAK ADA entri lullaby — bukan sengaja, memang belum diberi warna.
Perbaikan: `#modeRow [data-mode="lullaby"] { --mode-accent: #b388ff; }`
(lavender/ungu tema malam); state aktif menyorot lewat aturan
`.btn-diff.active` yang sudah generik (membaca `var(--mode-accent)`).

### BUG 4 — Pesan 409 resolve kapsul menyesatkan (pesan saja, 2 baris)

Pesan lama `sqkNotSettled` ("TRY AGAIN IN A FEW MINUTES" / "COBA LAGI
BEBERAPA MENIT LAGI") membingungkan: ronde TIDAK akan settle dalam
beberapa menit saat hamster tidur — settlement hanya terjadi bila ada
kerja roda (hamster aktif siang). Ronde 712 user (pull #1) belum settled
karena hamster tidur sejak ~14:00 WIB kemarin; settlement terakhir hanya
sampai ronde 646. Pesan baru (EN + ID, 4 kemunculan di `script.js`):
"ROUND {round} HAS NOT SETTLED YET — SETTLEMENTS ONLY HAPPEN WHEN THE
HAMSTER RUNS (DAYTIME). TRY AGAIN AFTER THE MORNING RUN." /
"RONDE {round} BELUM SETTLED — SETTLEMENT HANYA TERJADI SAAT HAMSTER
LARI (SIANG HARI). COBA LAGI SETELAH LARI PAGI." Logika resolve TIDAK
diubah; 2 SQK pull #1 aman (pending on-chain, retry besok siang setelah
hamster lari dan settlement melewati 712).

## Hasil tes

- `node --check` semua JS OK.
- TEST-v34-neo.js: **1793/1793** (1788 dasar v42.5.1-ikon + 5 baru: 2
  fallback equip eth_call-gagal, 1 migrasi kunci lama, 2 daftar fungsi
  skin baru).
- TEST-v42.5.js: **90/90** (69 dasar + 21 baru section 11: 7 skenario
  dua-sumber skin, 2 statis BUG 1, 3 harness `fetchShop` ASLI, 5 BUG 2,
  3 BUG 3, 1 BUG 4).
- TEST-motif.js: **11/11**.
- Route lokal (bundle esbuild, skrip `verify-icon-routes.js`, 9/9):
  `GET /` → version 11; `GET /icon.png` → 200, image/png, 18.835 byte,
  PNG 512×512, byte-identik dengan file lokal, cache 1 tahun;
  `GET /og.png` → 200, image/png, 181.729 byte, PNG 1600×900,
  byte-identik dengan banner lokal; `GET /cheese` (tanpa wallet) →
  katalog 8 item (perilaku lama utuh); path tak dikenal → 404.

## Verifikasi live

- Worker `GET /` → `{"service":"squeekchain-leaderboard","version":11}`.
- `GET /icon.png` → 200 + PNG valid 512×512; `GET /og.png` → 200 + PNG
  valid 1600×900 (curl, dicek setelah deploy).
- Pages judul v42.5.1 + `gameVersion: 'v42.5.1'`.
- 3 bukti Genesis utuh (TXT via DNS, meta tag, baris README).
- Board D1 tidak berubah; baris wallet Genesis user tidak disentuh.

## Catatan untuk user

Koneksi WalletConnect yang lama di OKX sudah menyimpan URL ikon yang
rusak (404). Untuk melihat ikon baru, **disconnect lalu reconnect** di OKX
("Putuskan Semua Hubungan" di layar DApp Terhubung, lalu connect ulang
dari game). Koneksi baru mengambil `icons` dari metadata terbaru.

## Sisa yang diketahui (bukan blocker)

- Favicon browser kini memakai Worker `/icon.png` (bukan data-URI SVG
  lama) — bila Worker down, favicon ikut mati (game-nya sendiri juga
  butuh Worker untuk leaderboard, jadi tidak ada regresi nyata).
- `squeekchain-headline-simple.png` tetap tidak ada di repo/Pages
  (sengaja — biner tidak bisa di-push); satu-satunya URL gambar resmi
  sekarang adalah Worker `/icon.png` dan `/og.png`.
