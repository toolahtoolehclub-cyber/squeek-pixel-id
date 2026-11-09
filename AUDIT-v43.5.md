# AUDIT v43.5 — Bingkai (Frame) Terlihat DI DALAM Game

Tanggal: 2026-11-09 ~23:15–23:45 WIB. Basis: v43.4 (repo head `8e000632`).
Worker: TETAP v13 (tidak berubah, tidak di-deploy ulang).
Engine: TIDAK berubah (byte-identik v43.4).

## 1. Laporan user

User melaporkan (23:15 WIB, marah): item toko — terutama FRAME (Rainbow
Frame, Bingkai Animasi, Neon Frame, dsb) — "tidak berfungsi di dalam
game". Katanya: semua yang ada di shop harusnya berfungsi di dalam game,
bukan malah di luarnya. User benar.

## 2. Akar masalah (satu permukaan, sudah diverifikasi di kode v43.4)

- Note skin SUDAH bekerja di dalam game: `play()` menyetel
  `G.noteSkin = shopSkin().note` dan `noteColor()` mewarnai ulang not
  hamster saat lagu berjalan. Tidak disentuh v43.5.
- Frame TIDAK bekerja di dalam game: `applyResultFrame()` (script.js)
  hanya menambahkan class frame ke `#resultPanel` (panel hasil yang
  muncul SETELAH lagu selesai). CSS frame di style.css hanya didefinisikan
  untuk `#resultPanel.frame-*`. Area main `<section id="gamePanel">`
  (berisi `<div class="canvas-wrapper"><canvas id="game-canvas">`) tidak
  pernah mendapat class frame — jadi frame yang di-equip tidak terlihat
  sama sekali saat bermain, baru muncul di layar hasil. Itulah celah yang
  dikeluhkan user.

## 3. Perbaikan (v43.5)

### script.js (2 perubahan)
1. `applyResultFrame()` diperluas: dari `shopSkin().frame` yang sama, ia
   kini memberi class frame ke `#resultPanel` DAN `#gamePanel` (loop
   kedua panel, hapus dulu semua `FRAME_SKINS`, tambah yang di-equip bila
   valid). Tidak ada frame di-equip -> kedua panel bersih dari class
   frame. Nama fungsi dipertahankan (pemanggil + tes lama merujuknya).
   Semua jalur pemanggil lama ikut tercakup otomatis: equip/unequip Keju,
   equip/unequip SQK, dan layar hasil.
2. `play()`: `show('gamePanel'); applyResultFrame();` — frame dipasang
   sejak ketukan pertama lagu.

### style.css (1 perubahan)
- 5 aturan frame `#resultPanel.frame-*` menjadi aturan bersama:
  `#resultPanel.frame-X, #gamePanel.frame-X, body[data-theme] #gamePanel.frame-X`
  dengan deklarasi yang SAMA PERSIS (border, glow, gradient, animasi
  `sqkFrameShift`). Varian `body[data-theme]` diperlukan karena selama
  bermain `body[data-theme]` aktif dan aturan glow mode
  (`body[data-theme] #gamePanel`, spesifisitas 1,1,1) akan mengalahkan
  aturan frame biasa (1,1,0) untuk `border-color`/`box-shadow` — tanpa
  varian ini border gradient rainbow/sqk rusak (border-color kembali ke
  warna tema). Varian ini berspesifisitas 1,2,1 dan menang.
- Preview toko (`.shop-preview .pv-frame`) TIDAK diubah — sudah benar.

### Yang TIDAK berubah (sengaja)
- Note skin, scoring, judgement, verifikasi replay, Worker (v13),
  engine.js, gating v43.4 (connected-only profil/toko/peringkat),
  perilaku panel hasil (frame di sana sama seperti dulu).

## 4. Tes — 2415 tes, 0 gagal

- **TEST-v43.5.js (baru): 29/29** — fungsi render ASLI diekstrak
  by-name, dijalankan di sandbox mock DOM:
  - Part A (8 tes): frame-neon / frame-sqk (Bingkai Animasi) di-equip ->
    `#gamePanel` DAN `#resultPanel` membawa class frame; tanpa frame ->
    kedua panel bersih; ganti frame neon -> gold -> hanya gold di kedua
    panel; unequip tanpa reload -> frame hilang dari kedua panel; nilai
    frame tidak valid -> tidak ada class; semua 5 frame membungkus kedua
    panel; `#gamePanel` hilang -> tidak crash, `#resultPanel` tetap
    di-style.
  - Part B (3 tes, regresi): `noteColor` tetap mewarnai not di game
    (SQK rare biru safir, Keju mint, fallback ke tema bila tanpa/tidak
    dikenal skin).
  - Part C (18 tes, statis): satu aturan bersama per frame (deklarasi
    identik dengan v43.4, aturan lama result-only hilang); varian
    `body[data-theme]` ada untuk 5 frame; `play()` memanggil
    `applyResultFrame()` tepat setelah `show('gamePanel')`; 6 call site
    + definisi; versi v43.5 (judul/header/footer/meta/gameVersion/
    README); gating v43.4 utuh; struktur (`#gamePanel` + `#game-canvas` +
    `#resultPanel`) utuh; engine.js + worker.js byte-identik v43.4;
    14 chart golden identik; judgement windows tidak berubah; 3 bukti
    Genesis utuh.
- Full suite: TEST-v43.5 29, TEST-v43.4 66, TEST-v43.4-submit 34,
  TEST-v43.3 38, TEST-v43.3-submit 34, TEST-v34-neo 1813, TEST-v42.5 147,
  TEST-v42.5.4-capsule 30, TEST-v42.5.4-restore-ui 28, TEST-v42.5.3-ghost
  27, TEST-v43 51, TEST-v43.1 36, TEST-v43.2 34, TEST-v13-capsule-fallback
  28, TEST-motif 11, verify-icon-routes 9. **TOTAL 2415 passed, 0 failed.**
- Yang sempat gagal dan diperbaiki (jujur): 1 gagal di TEST-v43.5 C5 —
  hitungan call site saya salah (7 kemunculan = 6 call + 1 definisi,
  bukan 6); kode benar, asersi diperbaiki. 2 gagal di TEST-v34-neo +
  1 di TEST-v43.2 — asersi versi lama (`html says v43.4`, `README title
  is v43.4`, `versi: h2 + footer + meta + README v43.4`) yang belum
  ikut naik ke v43.5; diperbarui seperti pola v43.4. TEST-v13 +
  verify-icon-routes sempat gagal karena bundle `/tmp/v43-build`
  terhapus (tmp ephemeral) — di-rebuild via `./build-worker.sh
  bundle-only` (bundle-only, TANPA deploy Worker).

## 5. Deploy

- Repo `toolahtoolehclub-cyber/squeek-pixel-id`, branch `main`.
- Commit: `6db6073863efd51ae483d419f0e4d67572e8a4db` — "Squeekchain v43.5 —
  equipped frames now wrap the play area in-game (applyResultFrame
  styles #gamePanel too, shared CSS rules; note skins unchanged; 2415
  tests, 0 failed; engine/Worker v13 unchanged, 3 Genesis proofs
  intact)". Head sebelumnya `8e000632` (v43.4).
- 16 file di-push: index.html, script.js, style.css, README.md,
  AUDIT-v43.5.md, TEST-v43.5.js (baru), TEST-v43.4.js,
  TEST-v43.4-submit.js, TEST-v43.3.js, TEST-v43.3-submit.js, TEST-v43.2.js,
  TEST-v43.1.js, TEST-v43.js, TEST-v42.5.js, TEST-v42.5.4-restore-ui.js,
  TEST-v34-neo.js (10 file tes lama hanya asersi versi v43.4 -> v43.5).

## 6. Verifikasi live (2026-11-09 ~23:50 WIB, setelah deploy + jeda 3 menit)

- Situs live https://squeekpixel.web.id/ menunjukkan **v43.5**:
  `<title>SQUEEKCHAIN // v43.5</title>`, header `PIXEL ID // v43.5`,
  footer `• v43.5 •`, `gameVersion: 'v43.5'` di script.js.
- **Live script.js byte-identik** dengan script.js lokal v43.5 (`cmp`
  IDENTICAL).
- **3 bukti Genesis utuh, tidak berubah:**
  1. DNS TXT `_squeekchain` = `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9`
     (dicek via Google DoH).
  2. Meta tag `<meta name="squeekchain-project"
     content="05432539-b4e4-4f90-97b3-c258583905b7">` ada di index.html
     live.
  3. README live: judul `# Squeekchain v43.5`, baris terakhir
     `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`.
- **engine.js dan worker.js live byte-identik dengan v43.4** (dicek
  via raw.githubusercontent.com vs folder v43.4 lokal) — perubahan ini
  murni UI client; Worker tetap v13, tidak di-deploy ulang.

## 7. Yang akan dilihat user

Equip frame apa pun (Neon / Gold / Royal / Rainbow / Bingkai Animasi
SQK) lalu tekan INITIALIZE RHYTHM: area main kini langsung dibungkus
bingkai itu selama lagu berjalan — border + glow (atau gradient
animasi untuk Rainbow/SQK) mengelilingi canvas. Di layar hasil,
bingkai tetap seperti dulu. Lepas equip -> bingkai hilang dari area
main tanpa reload. Note skin tetap mewarnai not seperti biasa.
