# AUDIT v43.3 — WalletConnect Restore (Akar Masalah) + Submit Tahan-Koneksi-Lambat

Tanggal: 2026-11-09 ~11:25–12:00 WIB. Basis: v43.2 (repo head `22344d9c`).
Worker: TETAP v13 (tidak berubah, tidak di-deploy ulang).

## 1. Pengakuan jujur — mengapa restore tidak pernah beres

v42.5.2, v43, v43.1, dan v43.2 semuanya mengklaim memperbaiki restore
WalletConnect. **Semuanya tidak pernah menyentuh akar masalahnya.**

Akar masalah (diverifikasi dari header live GitHub Pages, 2026-11-09 ~11:25 WIB):

- Bundle WalletConnect `wc-provider.bundle.js` (2,1 MB) disajikan GitHub Pages
  dengan `Cache-Control: max-age=600` — cache hanya 10 menit.
- Di koneksi user (3–16 K/s), bundle HARUS diunduh ulang hampir tiap
  kunjungan: 2–12 menit.
- Jendela restore v42.5.2 hanya 60 detik. Restore SELALU timeout
  (`bundle-timeout`) sebelum kodenya selesai terunduh.
- User mengetuk CONNECT lagi → pairing BARU di OKX → kini ada TIGA sesi
  "Squeek Pixel ID" ganda.
- **Restore-nya tidak rusak logikanya; ia tidak pernah sempat jalan karena
  kodenya belum terunduh.** Perbaikan sebelumnya hanya memperpanjang
  watchdog (15 → 60 dtk) dan memperbaiki UI status — keduanya tidak
  menyentuh header cache.

Perilaku yang sama menjelaskan kegagalan kedua yang muncul saat v43.3
dibangun (tambahan scope, ~11:33 WIB): user main FREE, skor **125515**
(NEW HIGH SCORE lokal, +4284 XP), submit TIDAK PERNAH sampai ke server
(`verify_queue` kosong, board FREE tetap 36115; layar user:
"LEADERBOARD OFFLINE — CHECK YOUR CONNECTION", koneksi 5 K/s). POST
`/scores` timeout 30 dtk + SATU retry tidak cukup, dan replay hilang dari
layar begitu user main lagu lain / menutup halaman. Skor lokal AMAN
(local best) tapi user mengira hilang.

## 2. Yang diubah di v43.3

### A. Cache bundle persisten — IndexedDB (akar masalah #1)
- Begitu bundle WC berhasil diunduh (pertama kali), kodenya disimpan di
  IndexedDB (`sqk-wc` / `bundles`, kunci `bundle-v1` per versi bundle).
- Kunjungan berikutnya: bila bundle ada di IndexedDB, diinjeksi via Blob URL
  — INSTAN, tanpa unduh jaringan. Jaringan hanya dipakai bila IndexedDB
  kosong atau versi bundle berubah (`WC_BUNDLE_VERSION` — naikkan HANYA
  bila `wc-provider.bundle.js` di-rebuild).
- Urutan load baru: IndexedDB → fetch jaringan (hasilnya di-cache) →
  `<script src>` (fallback v42.3, tidak berubah).
- Setiap kegagalan IndexedDB jatuh anggun ke jalur jaringan.
- Gagal total TIDAK lagi mengunci `wcBundlePromise` selamanya dalam satu
  sesi (v42.3) — percobaan berikut bisa mencoba lagi.
- Fungsi baru: `wcIdbOpen`, `wcIdbGet`, `wcIdbPut`, `wcIdbCacheBundle`,
  `wcInjectCode`, `wcFetchBundleText`, `wcLoadBundleNetwork`;
  `wcLoadBundle` ditulis ulang di atasnya (tanda tangan sama).

### B. Injected provider didahulukan (akar masalah #2)
- `getEth()` kini mendahulukan provider yang BENAR-BENAR terhubung
  (`connectedVia`: `'injected'` | `'wc'`). Bila belum ada koneksi,
  `window.ethereum` (browser dalam aplikasi OKX) didahulukan — tanpa
  bundle, tanpa WalletConnect, instan. WC hanya bila tidak ada injected.
- v42.4–v43.2 mendahulukan WC walau injected tersedia.
- `connectedVia` diset di semua jalur: connect path A (injected), connect
  path B (WC), restore WC, restore injected, `accountsChanged` (kedua
  provider), `disconnect`, dan `disconnectWallet`.

### C. Alamat TIDAK PERNAH tampil bila belum connect (permintaan eksplisit user)
- `updateConnectBtn()`: `shown = connected ? connectedAddr : null`.
  Alamat yang diingat/manual tetap tersimpan di field di balik [ ALAMAT ]
  (ia menggerakkan main manual) tapi tidak ditampilkan.
- Kontrak lama yang DIUBAH (sengaja, atas perintah user 11:24 WIB):
  TEST-v42.5.js (disconnect) dan TEST-v43.js (skenario 2) yang dulu
  menegaskan alamat manual tampil di kartu — kini menegaskan TAMU/GUEST.

### D. Restore sabar + anti-duplikat (akar masalah #3)
- Restore menunggu hingga **5 menit** di latar (`wcGetProvider(300000, true)`,
  preload `wcLoadBundle(300000)`), bukan 60 dtk. Status
  "MENGHUBUNGKAN KEMBALI…" tetap tampil; CONNECT tetap nonaktif selama
  restore (sudah ada sejak v43 — dipertahankan).
- `connectWalletConnect()`: bila ada sesi tersimpan (`wc@2:` key atau
  `p.session`), SELALU pakai ulang via `enable()` dulu — JANGAN pernah
  membuat pairing baru. Hanya bila `enable()` gagal (sesi rusak) jatuh ke
  `p.connect()` (pairing baru).
- `restoreInjectedSession()`: coba lagi 5x × 1 dtk (provider injected bisa
  disuntik setelah page load), bukan sekali tembak.

### E. Antrean submit tahan-koneksi-lambat (tambahan scope)
- Replay disimpan di localStorage (`sqk43:pending`) SEBELUM percobaan kirim
  pertama — skor tidak pernah hilang karena submit gagal.
- `postOneSubmit`: SATU percobaan POST `/scores`, timeout **60 dtk**
  (dari 30). Hasil: `{sent}` / `{rateLimited, retryTime}` (429 — jangan
  spam) / `{terminal}` (400/422 — retry tidak membantu) / `{network}`.
- `submitWithRetries`: hingga 4 percobaan (1 + 3 retry), jeda 10/30/60 dtk.
- `flushPendingSubmits` + `scheduleSubmitFlush`: antrean di-flush otomatis
  di latar — berkala tiap 30 dtk selama ada yang tertunda, saat halaman
  dibuka (5 dtk setelah load), saat tab LEAGUE dibuka, dan saat koneksi
  kembali online (`online` event). Satu percobaan per entri per flush.
- Server dedupe via `replay_hash` — kirim ulang replay yang sama AMAN.
- Status jelas di panel hasil: `MENGIRIM SKOR…` → `MENCOBA LAGI…` →
  `GAGAL MENGIRIM — TAP [ COBA LAGI ]…` (tombol jadi `[ COBA LAGI ]`,
  aktif) / `TERKIRIM ✓` (alur sukses lama, tidak berubah). 429 tetap
  menampilkan jam retry persis; 422 menampilkan VERIFIKASI DITOLAK.
- Bila user sudah main lagu lain selagi kirim berjalan, panel lagu baru
  tidak ditimpa (guard `replayHash` — cukup refresh board).
- Board gagal muat: pesan `LEADERBOARD OFFLINE` + tombol muat ulang
  inline (`lbReloadBtn`); sama untuk liga mingguan
  (`leagueWeeklyReloadBtn`). Tombol REFRESH di header tab tetap ada.
- `resetLbSubmit` mengembalikan label tombol ke `[ KIRIM SKOR ]`.
- Format replay / engine / judgement / Worker TIDAK berubah — body POST
  yang disimpan adalah body yang sama persis.

### F. Versi
- Judul, h2, footer, meta description, README, dan `gameVersion` di body
  submit: v43.2 → **v43.3**.

## 3. Yang TIDAK berubah (batas keras — diverifikasi)
- `engine.js`, `worker.js`, `style.css`, `wc-provider.bundle.js`:
  **byte-identik v43.2** (Worker tetap v13).
- 14 chart golden identik (fixture v40); judgement windows
  0.045/0.09/0.135, BREAK 0.185; formula skor tidak berubah.
- 3 bukti Genesis utuh (meta tag + baris README dicek di folder;
  TXT `_squeekchain` adalah record DNS di IDwebhost — tidak tersentuh
  push kode; diverifikasi live oleh parent setelah deploy).
- Tanpa dependensi/CDN baru (tidak ada `<script src>` eksternal; kata
  "unpkg" hanya muncul di komentar sejarah).
- Semua fungsi v43.2 dipertahankan (kartu wallet, restore UX, kapsul +
  self-healing, toko, liga, Dream Seeds/Lullaby, duel, OBS, latar v43.2).
  Pesan kapsul tetap rarity sekali.

## 4. Tes — 2186 lolos, 0 gagal
- Baru: `TEST-v43.3.js` 38/38 (cache IDB: simpan→muat→injeksi, load
  hangat tanpa fetch, fallback `<script src>`, gagal total→retry bisa
  lagi, injeksi tanpa global→false, tanpa IDB→null; injected pertama;
  `getEth` mendahulukan provider terhubung; alamat tersembunyi bila
  belum connect; anti-duplikat `enable()` tanpa `connect()`; restore
  memakai ulang sesi; + statis).
- Baru: `TEST-v43.3-submit.js` 34/34 (antrean round-trip + dedupe +
  bertahan melewati reload; sukses setelah 2x gagal; gagal semua →
  4x POST + GAGAL MENGIRIM + [ COBA LAGI ] + antrean tetap; 429 →
  1x POST + tetap antre; 422 → ditolak + antrean dihapus; flush
  sukses/gagal; board gagal → tombol muat ulang bekerja; jalur
  pending 202 → poll → TER VERIFIKASI; reset label; + statis).
- Lama, semua hijau: TEST-v34-neo 1813/1813, TEST-v42.5 147/147,
  TEST-v42.5.3-ghost 27/27, TEST-v42.5.4-capsule 30/30,
  TEST-v42.5.4-restore-ui 28/28, TEST-v43 51/51, TEST-v43.1 36/36,
  TEST-v43.2 34/34, TEST-motif 11/11, TEST-v13-capsule-fallback 28/28,
  verify-icon-routes 9/9.
- `node --check` bersih (script.js, worker.js, engine.js, kedua file tes baru).
- Catatan: TEST-v13-capsule-fallback + verify-icon-routes butuh bundle
  Worker (`./build-worker.sh bundle-only`); path bundle di file tes
  v13 masih hardcode `/tmp/v42.5.3-build/` (stale sejak v42.5.3) —
  dijalankan dengan menyalin bundle + symlink node_modules ke path itu.
  Worker TIDAK berubah di v43.3, jadi ini hanya soal harness, bukan kode.

## 5. Perubahan pada tes lama (disengaja, didokumentasi)
- TEST-v42.5.js: harness `mkSubmit` kini mengekstrak fungsi antrean +
  `I18N`/`lang` + `loadJSON`/`saveJSON` (jeda retry dipercepat 5/10/15 ms);
  asersi (b) "selalu timeout" diperbarui ke perilaku v43.3 (4 percobaan,
  GAGAL MENGIRIM, [ COBA LAGI ], antrean tetap); asersi (c)/(d)
  ditambah (429 tetap antre; 422 antrean dihapus); harness `mkReset`
  diberi `I18N`/`lang` + asersi reset label; watchdog 60 dtk → 300 dtk;
  preload 60000 → 300000; POST timeout 30 → 60 dtk; gameVersion v43.3;
  asersi disconnect → kontrak v43.3 (GUEST setelah disconnect).
- TEST-v34-neo.js: watchdog/preload 60000 → 300000; asersi setTab LEAGUE
  kini mencakup `scheduleSubmitFlush(1000)`; asersi 429 kini memeriksa
  `msgf('lbRateLimited', { time: res.retryTime })`; versi v43.3.
- TEST-v42.5.4-restore-ui.js: daftar ekstraksi + `connectedVia` di
  prelude; gameVersion v43.3.
- TEST-v43.js / TEST-v43.1.js / TEST-v43.2.js: asersi versi v43.3;
  TEST-v43.js skenario (2) → kontrak v43.3 (alamat manual TIDAK tampil).

## 6. Yang masih butuh user (bukan kode)
1. **Kunjungan PERTAMA setelah update ini masih mengunduh bundle 2,1 MB
   sekali** (2–12 menit di koneksi lambat) — cache IndexedDB baru terisi
   setelah unduhan pertama selesai. Kunjungan BERIKUTNYA instan. Bila
   restore pertama masih tampak lama, itu unduhan pertama, bukan bug —
   biarkan halaman terbuka; status "MENGHUBUNGKAN KEMBALI…" akan
   hilang sendiri saat selesai (maks 5 menit).
2. **Putuskan 2 dari 3 sesi ganda di OKX** (atau putuskan ketiganya lalu
   connect fresh sekali dari situs untuk satu sesi bersih). v43.3 tidak
   bisa menghapus pairing yang sudah ada di OKX — ia hanya mencegah
   pairing BARU.
3. **Tes di HP**: connect sekali → tutup halaman sepenuhnya → buka lagi →
   harus tampil TERHUBUNG sendiri (dot hijau) tanpa mengetuk CONNECT.
4. **Skor 125515**: sudah tersimpan sebagai local best di HP. Setelah
   v43.3 live, main satu lagu lalu kirim — atau, bila panel hasil 125515
   masih terbuka, tap [ KIRIM SKOR ]: replay-nya kini masuk antrean dan
   akan terkirim otomatis walau koneksi lambat. (Replay lagu yang sudah
   berlalu dan panelnya sudah ditutup tidak bisa dikirim ulang — main
   ulang lagunya bila mau skor itu di board.)
5. Rental #4136: klaim SQK sebelum 15:18 WIB 9 Nov 2026 (tidak berubah).

## 8. Verifikasi live (diisi setelah deploy, 2026-11-09 ~12:00 WIB)
- Repo head setelah push: **`67c38707`** (push-files, 76 file teks, 0 biner).
- Judul live `squeekpixel.web.id`: **SQUEEKCHAIN // v43.3** ✓ (GitHub Pages
  sudah ter-deploy).
- Raw GitHub `index.html`: judul v43.3 ✓; meta proof ✓.
- Raw GitHub `script.js`: `gameVersion: 'v43.3'` ✓; 7 kemunculan identifier
  baru v43.3 (`wcIdbOpen`, `sqk43:pending`, `SUBMIT_TIMEOUT_MS = 60000`) ✓.
- Worker: `GET /` → `{"service":"squeekchain-leaderboard","version":13}` ✓.
- 3 bukti Genesis utuh: meta tag ✓, baris README ✓, DNS TXT via Google
  DoH = `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9` ✓.
- Board D1: FREE **36115** (yui, verified=1) + race **50605** (yui,
  verified=1 — skor race BARU dari user, dimainkan setelah 11:10 WIB;
  bukan efek deploy). FREE 125515 tetap tidak ada di board — sesuai
  harapan: ia tidak pernah sampai ke server dan antrean v43.3 hanya
  melindungi submit BERIKUTNYA. `verify_queue` = 6 baris (dari 4; +2 dari
  permainan baru user — audit trail, jangan dihapus).

## 7. Risiko / kejujuran
- IndexedDB bisa dimatikan/diblokir di sebagian browser privat — fallback
  ke unduh jaringan tetap jalan (perilaku v42.3), restore kembali lambat
  tapi tidak rusak.
- Bila user membersihkan data situs (clear site data), cache IndexedDB +
  antrean submit ikut terhapus — skor lokal (local best) tetap aman
  karena disimpan di kunci terpisah.
- Antrean dibatasi 5 replay tertunda (localStorage ~5 MB); entri tertua
  dibuang bila penuh — local best tetap aman.
- Restore 5 menit berarti status "MENGHUBUNGKAN KEMBALI…" bisa tampil
  lama di kunjungan pertama — itu disengaja (sabar), bukan hang.
