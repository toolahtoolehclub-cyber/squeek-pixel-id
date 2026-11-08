# AUDIT v42.4 — Lead-in replay, tombol connect, alasan penolakan, equip skin SQK + audit toko

Client v42.4 + Worker v9. GitHub head: (diisi saat push). Worker v9 LIVE
(`GET /` → `{"service":"squeekchain-leaderboard","version":9}`).
Tes: TEST-v34-neo.js **1677/1677** + TEST-motif.js 11/11.

## 1. BUG 1 — Submit user DITOLAK: `replaySongT()` menjepit waktu negatif

### Laporan user (2026-11-09 ~00:46 WIB)
User (wallet Genesis `0x88538a82143065664232422e2dec4309038fcf9a`) main DAILY
(seed `DAILY-2026-11-08`, synth/easy/3 lane), skor **34675**
(counts 7/74/61/6, maxCombo 79, ACC 51,8%), submit → panel
"WAITING FOR VERIFICATION…" → user tutup halaman. D1 `verify_queue`:
replay_hash `0xcafb6294612c48fe7022720cf0977e7b6da9df178fc2716d818bc75703008e09`,
mode daily, status **`rejected`, reason `simulated score mismatch`**.
TIDAK ADA baris scores/league untuk wallet user. Bukan salah user.

### Root cause (dibuktikan parent, direproduksi ulang subagent — angka sama)
`replaySongT()` (script.js v42.3 baris 865):
`Math.max(0, +songTime().toFixed(3))` — menjepit songTime negatif jadi 0,
sementara `judge()` memakai `songTime()` mentah. LEAD_IN = 2 detik: sebelum
lagu mulai, songTime negatif. User ini tap ~90 ms LEBIH AWAL (bias yang
sudah diketahui sejak v34). Tap pertamanya terjadi saat songTime ≈ −0,10:
- live judge: st = −0,10 − 0,04 (offset 40 ms) = −0,14 → dt 0,14 > 0,135
  → tap kosong, not pertama jadi MISS.
- rekaman: t = 0 → engine: st = −0,04 → dt 0,04 → PERFECT.
- Selisih 300 poin → Worker tolak.

Reproduksi subagent (engine.js pada replay asli `/tmp/user-replay.json`,
fixture tersimpan sebagai `TEST-user-replay-0xcafb.json`):
- CLAIM: 34675 / 7/74/61/6, maxCombo 79, acc 51,8.
- SIM (apa adanya, t=0): **34975** / 8/74/61/5, maxCombo 79 → mismatch.
- SIM dengan input pertama dikoreksi t=−0,10: **34675 / 7/74/61/6,
  maxCombo 79, acc 51,8018** → == claim EXACT (acc dalam toleransi
  Worker 0,01). Ini membuktikan perbaikan: dengan waktu asli terekam,
  simulasi mereproduksi claim persis.

Smoke test tidak pernah menangkap ini: agen penguji main jelek (kombo 2,
tidak pernah tap saat lead-in). Pelajaran v42.2/v42.3 berulang: verifikasi
harus mencakup kasus nyata user, bukan hanya jalur bahagia.

### Perbaikan
- `replaySongT()` sekarang merekam songTime **mentah** (boleh negatif),
  presisi **4 desimal** (±0,05 ms — hardening murah: ada satu perfect
  lain di replay user pada dt 0,0442, hanya 0,8 ms dari batas 0,045;
  pembulatan 3 desimal ±0,5 ms bisa membalik not di tepi jendela).
- `recordReplayGolden()` diperbaiki sama (t mentah, 4 desimal).
- `engine.js`: TIDAK ADA perubahan logika — `simulate()` sudah menangani
  t negatif dengan benar (tanpa clamp). Hanya komentar aturan 2 + 5
  diperbarui (4 desimal, boleh negatif; kuantisasi 0,1 ms).
- **Worker v9 (WAJIB, kalau tidak replay baru tetap ditolak):**
  `validateReplay` menolak `t < 0` untuk inputs/polls/golden (worker.js
  v42.3 baris 832/847/867). v9 menerima `t >= -2,5` (LEAD_IN 2 detik +
  0,5 margin). Tidak ada perubahan lain — verifikasi, enforcement,
  EIP-712, Keju, liga byte-identical. Deploy v9 dilakukan SEBELUM push
  client (kalau tidak, replay v42.4 dengan tap lead-in ditolak validasi
  lama; fail-soft client akan submit tanpa replay = verified=0).
- `makeTapScript` di tes diubah ke rekaman mentah (dulu `Math.max(0, …)`
  — tes ikut memodelkan bug itu, makanya lolos).

### Replay lama TIDAK BISA diselamatkan
Data rekaman `0xcafb…` sudah terlanjur salah — waktu asli tap pertama
hilang (tidak bisa di-unclamp). Jangan coba "memperbaiki" replay itu,
jangan hapus baris rejected dari D1 (audit trail), jangan buat skor
palsu. User harus **main ulang DAILY yang sama** (seed DAILY-2026-11-08
berlaku sampai 19:00 WIB 9 Nov) lalu submit lagi setelah v42.4 live.

### Tes parity (inti perbaikan)
- `replaySongT` unit (dari sumber asli): −0,1 → −0,1 (bukan 0);
  −0,123456 → −0,1235; 5,67891 → 5,6789; 0 → 0.
- `recordReplayInput` unit: tap lead-in terekam `{t:-0.1, lane:1}`.
- Parity driver (judge asli) vs simulate EXACT: (A) offset +40 ms,
  tap −0,10 → tap kosong, not 0 MISS, skor 3360 (kasus user);
  (B) offset 0, tap −0,04 → PERFECT, skor 3690, 12 PERFECT, SS;
  (B2) offset +40 ms, tap −0,06 → GOOD, skor 3490;
  (C) lagu DAILY ASLI (148 not) + tap lead-in + kombo 147 (FEVER aktif)
  → skor 103200, 147 PERFECT + 1 MISS, maxCombo 147, grade S.
- Fixture replay user: asli tetap mismatch 34975 vs 34675
  (didokumentasikan); t=−0,10 → == claim EXACT.
- Worker v9 `validateReplay` (diekstrak dari worker.js asli):
  replay asli lolos validasi bentuk (yang menolaknya simulasi, bukan
  validasi); t=−0,10 lolos; t=−3,0 ditolak; poll t=−0,5 lolos;
  poll t=−3,0 ditolak.

## 2. BUG 1b — Panel hasil tidak menampilkan alasan penolakan

`pollVerify` sudah memanggil `onStatus('rejected')` dengan benar, tapi
`showStatus` membuang `data.reason` — panel hanya menampilkan
"VERIFIKASI DITOLAK — SKOR TIDAK MASUK BOARD." tanpa alasan.
Padahal GET /verify 422 mengembalikan `{reason}`.

Perbaikan: fungsi baru `verifyRejectedText(data)` — bila ada reason,
tampilkan `VERIFIKASI DITOLAK — {reason}. MAIN ULANG DAN KIRIM LAGI.`
(kunci i18n `lbVerifyRejectedReason`, EN + ID); tanpa reason, pesan
umum lama. Interval/mekanisme polling tidak diubah (10 detik × 9).

Catatan jujur: user menutup halaman sebelum polling selesai (~60 detik),
jadi ia tidak sempat melihat penolakan apa pun. Tidak ada yang bisa
dilakukan untuk halaman yang sudah ditutup — yang diperbaiki adalah
kejelasan pesan bagi yang menunggu sampai selesai.

## 3. BUG 2 — Tombol `[ CONNECT WALLET ]` tetap tampil setelah connect

Dikonfirmasi di kode v42.3: satu-satunya referensi `connectBtn` adalah
`bindClick('connectBtn', connectWallet)` — TIDAK ADA kode yang mengubah
tombol setelah connect sukses (path A maupun B), restore, atau
disconnect. User benar; ini bug nyata.

Perbaikan (satu perilaku konsisten):
- `connectedAddr` = alamat provider yang AKTIF (path A injected atau
  path B WC), null bila tidak ada. Sumber kebenaran adalah koneksi
  provider, BUKAN isi field alamat (alamat bisa diketik manual tanpa
  connect).
- `updateConnectBtn()`: bila terhubung → teks `[ TERHUBUNG: 0x8853...cf9a ]`
  + disabled; bila tidak → `[ CONNECT WALLET ]` + enabled.
- `setConnected(addr)` dipanggil di: connect path A sukses,
  connectWalletConnect sukses, restore WC session sukses, WC
  `accountsChanged` (ganti wallet → tombol ikut ganti; akun kosong →
  kembali CONNECT WALLET), WC `disconnect` (+ pesan `walletDisconnected`),
  injected `accountsChanged` (sama).
- Baru: `restoreInjectedSession()` — browser dalam-app wallet tetap
  terhubung saat reload; baca `eth_accounts` TANPA prompt.
- `applyLang()` memanggil `updateConnectBtn()` di akhir — ganti bahasa
  menulis ulang SEMUA label `data-i18n`, termasuk connectBtn.

Tes: harness mock provider (injected + WC) — connect path A/B →
TERHUBUNG + disabled; accountsChanged ganti wallet → tombol ikut ganti;
accountsChanged kosong → CONNECT WALLET; WC disconnect → CONNECT WALLET;
restore WC session (kunci `wc@2:`) → TERHUBUNG tanpa klik; restore
injected (`eth_accounts`) → TERHUBUNG tanpa klik; `setConnected(null)`
→ CONNECT WALLET. (Satu kegagalan tes saat pengembangan ternyata salah
ketik ekspektasi tes sendiri — `3a1Db` vs `a1Db` yang benar — bukan bug
kode; diperbaiki ekspektasinya.)

## 4. BUG 3 — Skin SQK yang dibeli TIDAK BISA dipakai

### Fakta on-chain (verifikasi parent)
User membeli item 1 "Skin Rare" (5 SQK): `balanceOfItem(wallet,1)=1`,
item 2–6 = 0, `prizePool=1.5` SQK, saldo SQK 25 → **23,5** (bayar 5,
kembali 3,5 sebagai owner share 70% — owner kontrak = wallet user
sendiri — net 1,5; pool 1,5). Pembelian BERHASIL.

### Root cause (dicek di kode v42.3)
`renderSqkShop()` — bila `owned > 0`, tombolnya hanya
`<span class="msg">OWNED ×n</span>` (teks polos). **TIDAK ADA tombol
EQUIP untuk item SQK** (grep `sqk-equip|sqkEquip|equipSqk` = 0 hasil).
`equipItem(id)` hanya untuk item Keju (POST Worker `/cheese/equip`,
id katalog Keju) — item SQK tidak ada di katalog Keju. `buySqkItem()`
setelah beli hanya `fetchSqkShop()` — tidak equip, tidak menyentuh
`shopSkin()`. `shopSkin()` (localStorage `sqk41:skin`) hanya pernah
ditulis alur equip Keju. Mesin tampilnya SUDAH ADA dan jalan:
`noteColor()` di render not + `applyResultFrame()` / `FRAME_SKINS` —
hanya tidak pernah terhubung ke item SQK.

### Perbaikan
- `SQK_SHOP_CATALOG` ditambah `slot` + `skin`: 1 Skin Rare → note /
  `note-sqk-rare`; 2 Efek Epic → note / `note-sqk-epic`; 3 Bingkai
  Animasi → frame / `frame-sqk`; 4 Skin Epic → note / `note-sqk-lime`;
  5 Golden Wheel → note / `note-sqk-platinum`; 6 Skin Legendary → note /
  `note-sqk-inferno`. Harga TIDAK berubah.
- `NOTE_SKINS` + 5 palet SQK baru (hue sengaja beda dari semua skin
  Keju: mint 150°, gold 45°, void 270°, rainbow multi): rare = sapphire
  blue `#3b82f6…`; epic = rose crimson `#f43f5e…`; lime = chartreuse
  `#a3e635…`; platinum = putih `#f8fafc…`; inferno = oranye `#ff6b00…`.
- `FRAME_SKINS` + `frame-sqk` (Bingkai Animasi) + CSS
  `#resultPanel.frame-sqk` (border gradien biru–rose–lime yang
  BERANIMASI via `@keyframes sqkFrameShift`).
- `renderSqkShop()`: item owned yang belum dipakai → tombol
  `[ PAKAI ]` / `[ EQUIP ]` (`data-sqk-equip`); yang sedang dipakai →
  `DIPAKAI ✓` (+ di baris meta); yang belum dimiliki → tombol BELI
  seperti semula.
- `equipSqkItem(id)`: verifikasi kepemilikan on-chain via
  `balanceOfItem` eth_call (read-only, TANPA signature/transaksi) →
  bila > 0, tulis ke `shopSkin()` localStorage + `applyResultFrame()` +
  refresh shop; bila 0 → tolak dengan pesan jelas (`sqkNotOwned`).
  Equip HANYA client-side + localStorage (cocok arsitektur yang ada);
  tidak ada endpoint Worker/server baru. Skin not dipakai lagu
  berikutnya (`G.noteSkin` dibaca dari `shopSkin()` di `play()`).

### Tes
- Katalog: slot + skin sesuai pemetaan untuk ke-6 item; harga tetap
  5/10/15/20/50/100.
- NOTE_SKINS: 5 skin baru, masing-masing 4 warna hex; tidak ada palet
  yang sama dengan skin Keju; `frame-sqk` terdaftar; CSS ada.
- `noteColor`: skin rare mewarnai lane 0 biru `#3b82f6`; skin tak
  dikenal → warna tema.
- `equipSqkItem` (harness eth_call mock): item 1 owned → `shopSkin.note
  = note-sqk-rare` + pesan EQUIPPED + `applyResultFrame` +
  `renderSqkShop` dipanggil; item 2 tidak owned → DITOLAK, skin tetap;
  item 3 frame → `shopSkin.frame = frame-sqk`, note tetap; item 4
  mengganti note → `note-sqk-lime`.
- `renderSqkShop` (DOM palsu): item 1 → tombol EQUIP; item 4 (dipakai)
  → `DIPAKAI ✓` tanpa tombol EQUIP; item 2 → tombol BELI; tidak ada
  tombol EQUIP untuk item yang belum dimiliki.

## 5. Audit toko penuh (perintah user 2026-11-09 ~01:05 WIB)

User: "saya mau semua yang kamu buat di shop itu berguna berfungsi dan
sesuai". Parent mengaudit SEMUA jalur toko di kode v42.3 + Worker v8:

**Sudah terbukti jalan:** beli SQK (item 1, terverifikasi on-chain);
earning Keju (+100/lagu terverifikasi, +50 misi harian — terbukti smoke
test v42.1); logika Worker `/cheese/buy` (atomic deduct, tolak
capsuleOnly/sudah-milik/saldo-kurang + refund bila race), `/cheese/pull`
(RNG server, duplikat → kompensasi), `/cheese/equip` (cek milik, satu
per slot), `/capsule-resolve` (cek round settled, 409 bila belum, tanda
tangan EIP-712), `/capsule` (idempotent per txHash) — dibaca di
worker.js dan tampak benar; tampilan pool/musim/pity/saldo render benar.

**Belum pernah terbukti (bukan berarti rusak — belum pernah dites
ujung-ke-ujung):** (a) Keju BELI + EQUIP + PULL kapsul — tidak ada
wallet uji yang pernah punya ≥300 Keju; (b) Kapsul Emas SQK COMMIT +
RESOLVE — tidak pernah dites ujung-ke-ujung (butuh 2 SQK + round settle
~20 menit + wallet berisi SQK; JANGAN pakai wallet asli user — tes ini
butuh GO user dulu, TIDAK masuk smoke test v42.4); (c) bonus Keju +500
grade S/SS — belum pernah ada run grade S di smoke test.

**Smoke test v42.4 (WAJIB, rencana parent):** alur Keju ujung-ke-ujung
dengan wallet uji MATI `0x000000000000000000000000000000000000dEaD`:
1. Main + submit lagu FREE sampai Keju ≥350 (tiap lagu terverifikasi
   +100; lagu pertama hari ini +50 misi harian — 3 lagu: 150+100+100).
   Tiap submit HARUS "TERVERIFIKASI ✓" (sekaligus membuktikan
   perbaikan replay v42.4 di permainan nyata).
2. SHOP tab (Keju): beli `note-mint` (300 Keju) → saldo berkurang tepat
   300, item muncul sebagai dimiliki.
3. EQUIP `note-mint` → verifikasi skin terpasang (localStorage
   `sqk41:skin` + GET /cheese menunjukkan equipped) → main satu lagu
   dan PASTIKAN warna not berubah (bandingkan warna tema default).
4. Main + submit 1 lagu lagi (+100 Keju) → pull Kapsul Keju (100 Keju)
   → verifikasi hasil: item baru ATAU duplikat + kompensasi Keju masuk,
   saldo sesuai hitungan.
5. Bila ada langkah GAGAL → itu BUG, perbaiki di v42.4 juga (rilis yang
   sama), jangan dilaporkan sebagai "nanti".
6. Bersihkan SEMUA baris uji dari D1 (9 tabel, `LOWER(wallet)`, board 0).
7. JANGAN sentuh kapsul SQK di smoke test. JANGAN transaksi dengan
   wallet asli user.

Hasil smoke test Keju E2E dicatat di sini setelah parent menjalankannya:
(BELUM — menunggu smoke test browser parent.)

## 6. Yang TIDAK berubah
Judgement windows, tempo, formula skor (termasuk combo multiplier +
Fever — yang salah hanya PEREKAMAN waktu, bukan rumusnya), verifikasi
replay/EIP-712/enforcement, Keju/liga, harga katalog, split 70/30,
seasonEnd, alamat toko, Project ID, 3 bukti Genesis.

## 7. Sisa (untuk parent / user)
- Smoke test browser v42.4 (parent): (a) modal WalletConnect muncul
  (tanpa pairing); (b) tombol connect → TERHUBUNG setelah pairing uji?
  — TIDAK, pairing hanya oleh user; smoke test cukup cek modal +
  tombol berubah setelah connect via wallet uji? (tidak ada wallet uji
  sungguhan — tombol connect hanya bisa dibuktikan penuh oleh user
  sendiri); (c) lagu FREE dengan kombo ≥30 + satu tap lead-in → submit
  wallet uji MATI → HARUS "TERVERIFIKASI ✓" (bukan rejected);
  (d) SHOP dengan wallet Genesis diketik manual (READ-ONLY) → item 1
  menampilkan tombol EQUIP (balanceOfItem(1)=1 on-chain) → klik EQUIP →
  verifikasi skin terpasang (localStorage `sqk41:skin` + main satu lagu,
  warna not berubah); (e) alur Keju E2E §5 (3 lagu → beli note-mint →
  equip → warna not berubah → 1 lagu → pull kapsul); (f) panel
  menampilkan DITOLAK + alasan bila ada penolakan (cek via polling —
  sulit dipicu sengaja; cukup cek kode + pesan).
  Bersihkan D1 setelahnya (9 tabel, board 0).
- User: main ulang DAILY (seed DAILY-2026-11-08, berlaku s/d 19:00 WIB
  9 Nov) + submit lagi; lalu uji end-to-end: connect Chrome → OKX →
  beli item + 1 pull kapsul SQK dengan 25 SQK (tanda tangan user).
- Catatan UX kecil (Batch 6): tombol toCardBtn "GENERATE CARD" di panel
  hasil duduk di sebelah tombol submit — rawan ketuk nyasar.
