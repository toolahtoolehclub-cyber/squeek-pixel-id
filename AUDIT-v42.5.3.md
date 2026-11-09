# AUDIT v42.5.3 — GHOST race replay rejection (raw-expiry guard)

Client v42.5.3, Worker v12 (TIDAK berubah — engine.js dan worker.js tidak disentuh). GitHub head: (diisi setelah push).
Tes: TEST-v34-neo.js 1813/1813 + TEST-v42.5.js 144/144 + TEST-motif.js 11/11 + TEST-v42.5.3-ghost.js 27/27 (baru) + verify-icon-routes.js 9/9 = 2004 tes lolos.

## Latar — skor GHOST race user DITOLAK server (bukan salah user)

Replay GHOST race user `0xb8337604…` (mode race, seedKey `RACE-2026-11-08-100`,
seed 2400307847, genre cyber, diff hard, lanes 3, offsetMs 40, ghost true,
ghostPaceMs 0.5, 138 input, 12 poll, golden []) diklaim skor **34720**
(perfect 54 / great 57 / good 12 / miss 8, maxCombo 38, acc 73.28) tapi
server menolak dengan `simulated score mismatch`. Baris `verify_queue`
tersebut TETAP ADA di D1 sebagai audit trail — jangan dihapus; skor lokal
di HP user aman (localStorage), hanya tidak masuk board terverifikasi.

## Diagnosis (reproduksi persis oleh parent, bukan tebakan)

- Engine `simulate()` atas replay yang sama: **32205** (54/57/11/9,
  maxCombo 35, acc 73.028). Selisih skor 2515.
- Brute-force flip satu note: bila note index 56 (t=28.095238095238095,
  lane 0) dihitung GOOD, sim menjadi **PERSIS 34720 / 54/57/12/8 /
  maxCombo 38**. Jadi tepat SATU note yang berbeda.
- Note itu dipukul tap LAMBAT t=28.2347 lane 0 (raw dt +0.1395 s setelah
  note). `judge()` lama memakai st = songTime() − offsetMs (0.04) =
  28.1947, bd = 0.0995 ≤ 0.135 → GOOD. Tapi `loop()` menandai note MISS
  saat raw songTime − n.t > 0.135, dan itu hanya terjadi pada frame rAF
  berikutnya (~16.7 ms) — tap ini tiba 4.5 ms setelah batas teoretis,
  SEBELUM frame loop sempat menandai miss, jadi `judge()` masih bisa
  memukulnya. Engine deterministik: `expireNotes(ev.t)` menandai miss
  dulu (0.1395 > 0.135) sebelum `applyInput`, jadi menolak.
- Zona ambigu: tap lambat dengan raw dt (0.135, 0.175] — hasilnya di
  client lama bergantung timing frame (tidak deterministik dari replay),
  di engine selalu ditolak.

## Perbaikan (client saja, `script.js` `judge()`)

1. **SATU sampel `songTime()` per tap** (`const raw = songTime();` di awal
   `judge()`), dipakai untuk rekaman input (`recordReplayInput(lane, raw)`)
   DAN perhitungan st (`const st = raw - offsetMs / 1000`). Dulu
   `recordReplayInput()` memanggil `songTime()` sendiri lalu st
   memanggilnya lagi; audio clock terus jalan di antara kedua panggilan,
   sehingga replay tidak mereproduksi `judge()` persis.
   `recordReplayInput(lane, t)` kini menerima `t` opsional (bila diberi,
   pakai `+t.toFixed(4)`, bila tidak, panggil `replaySongT()` seperti dulu).
2. **Raw-expiry guard** — setelah target ditemukan dan sebelum hit
   diterima: `if (raw - target.t > CONFIG.W.good) return;`. Note yang
   sudah lewat batas kedaluwarsa mentahnya tidak boleh dipukul, walau st
   ber-offset masih di dalam jendela. Ini membuat judgement client
   menjadi fungsi murni dari (chart, input, offset) — persis yang
   dimodelkan engine — dan menutup zona ambigu.
3. TIDAK berubah: engine.js, worker.js (tetap v12), judgement windows
   (PERFECT ±0.045 / GREAT ±0.09 / GOOD ±0.135), formula skor, FEVER,
   ZOOMIES, logika replay lain. Tap AWAL (early) tidak pernah ditolak
   guard (raw − target.t negatif). Tap lambat dalam jendela mentah
   (raw dt ≤ 0.135) tetap bisa GOOD seperti dulu — yang hilang hanya
   "keberuntungan frame" untuk tap yang secara mentah sudah lewat 0.135.

## Tes baru — TEST-v42.5.3-ghost.js (27/27)

Harness cerminan `judge()` + miss-marking `loop()` dijalankan atas
replay GHOST asli (`ghost-replay-0xb8337604.json`, disalin ke folder
versi supaya tes bisa jalan dari checkout repo):

- (a) Engine sim = 32205 / 54/57/11/9 / maxCombo 35 / acc 73.028 (vonis
  server) — 5 tes.
- (b) Harness judge() v42.5.3 (dengan guard) == sim engine PERSIS
  (skor, counts, acc, maxCombo) — 4 tes. Client dan server kini sepakat.
- (c) Harness dengan note idx 56 dipaksa GOOD == klaim lama PERSIS
  (34720 / 54/57/12/8 / maxCombo 38 / acc 73.28) — 5 tes. Reproduksi
  brute-force diagnosis parent; membuktikan satu-satunya perbedaan
  adalah note 56. Catatan: harness deterministik atas replay TIDAK BISA
  mereproduksi klaim lama hanya dengan mematikan guard — klaim lama
  lahir dari frame race yang timing-nya tidak terekam di replay; yang
  bisa dibuktikan adalah flip note 56-lah yang menghasilkan klaim itu.
  Tes tambahan: tanpa flip, logika tanpa guard == sim engine (jadi
  guard-lah yang mengubah hasil).
- (d) Unit tap kritis note idx 56: bd ber-offset 0.0995 = GOOD menurut
  jendela lama, raw dt 0.1395 > W.good → guard menolak, raw dt masih
  dalam zona ambigu (0.135, 0.175] — 3 tes.
- (e) Unit batas guard: raw dt tepat 0.135 lolos (`>` bukan `>=`),
  0.1351 ditolak, tap awal tidak pernah ditolak, tap tepat di note
  lolos — 4 tes.
- (f) Statis: `const raw = songTime();` + `recordReplayInput(lane, raw)`
  + `const st = raw - offsetMs / 1000;` + guard ada di script.js;
  `recordReplayInput(lane, t)` memakai `t` bila diberi — 5 tes.

## File yang berubah (vs v42.5.2)

- `script.js` — fix `judge()` + `recordReplayInput(lane, t)` +
  `gameVersion: 'v42.5.3'`.
- `index.html` — judul/meta/h2/footer v42.5.3.
- `TEST-v34-neo.js`, `TEST-v42.5.js` — asersi versi → v42.5.3.
- `build-worker.sh`, `verify-icon-routes.js` — path build → v42.5.3
  (Worker TIDAK di-deploy ulang; `build-worker.sh bundle-only` hanya
  untuk tes icon-routes lokal).
- Baru: `TEST-v42.5.3-ghost.js`, `ghost-replay-0xb8337604.json`
  (fixture replay asli user; wallet address di dalamnya adalah wallet
  Genesis publik yang sudah ada di repo, bukan rahasia).
- `AUDIT-v42.5.2.md` ikut di-push dalam commit ini (versi lokal sudah
  lengkap berisi head hash `a647e19d…`; repo sebelumnya masih berisi
  placeholder "(diisi setelah push)" karena follow-up push v42.5.2
  gagal — kartu persetujuan kedaluwarsa 03:39 WIB saat user tidur).

## Verifikasi live (status 2026-11-09 ~04:40 WIB — PUSH TERTUNDA)

- **PUSH GAGAL — kartu persetujuan GitHub kedaluwarsa** (`approval_expired`,
  approval `connector-attempt-a0c7ab24…`, user tidur). Push TIDAK dilakukan
  (tidak ada file yang berubah di repo). Yang tertunda — 10 file, perlu
  1 ketukan user pagi hari lalu ulangi push yang sama SEKALI (jangan
  berulang-ulang): `index.html`, `script.js`, `TEST-v34-neo.js`,
  `TEST-v42.5.js`, `TEST-v42.5.3-ghost.js`, `ghost-replay-0xb8337604.json`,
  `build-worker.sh`, `verify-icon-routes.js`, `AUDIT-v42.5.2.md`
  (melengkapi head hash `a647e19d…`), `AUDIT-v42.5.3.md` (file ini;
  baris head hash di atas masih placeholder — diisi setelah push berhasil).
- GitHub head saat ini: `a647e19d` (v42.5.2) — TIDAK berubah.
- Pages saat ini: masih **v42.5.2** (judul live `SQUEEKCHAIN // v42.5.2`,
  dicek 04:40 WIB) — v42.5.3 BELUM live di situs.
- Worker: tetap **v12** (`GET /` →
  `{"service":"squeekchain-leaderboard","version":12}`) — sesuai rencana
  (tidak ada perubahan worker/engine).
- 3 bukti Genesis utuh (dicek 04:40 WIB): meta
  `05432539-b4e4-4f90-97b3-c258583905b7` + README baris terakhir sama +
  DNS TXT `_squeekchain` = `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9`
  (via Cloudflare DoH).
- Board D1 tidak berubah: Genesis scores tetap 1 baris (race 28280
  verified=1); baris `verify_queue` `0xb8337604…` (rejected GHOST)
  tetap ada sebagai audit trail.

## Yang belum beres / perlu perhatian

1. Skor GHOST race user 34720 TIDAK bisa diselamatkan — replay lama
   merekam judgement yang tidak deterministik; client yang diperbaiki
   akan menilai lagu yang sama 32205. User main ulang RACE untuk skor
   terverifikasi (tap yang sangat lambat kini konsisten MISS di client
   dan server).
2. Sisa efek orde-kedua (bukan blocker, sudah dicatat): reset combo di
   client terjadi pada frame rAF setelah note expire, sedangkan engine
   meresetnya pada input berikutnya — bila sebuah hit mendarat dalam
   <1 frame (~16.7 ms) setelah expiry sebuah note, combo bisa berbeda
   1 antara client dan engine. Tidak terpicu oleh replay GHOST ini
   (harness == sim persis); butuh replay yang mengandung pola itu
   untuk membuktikan/memperbaikinya.

## Worker v13 — /capsule-resolve fallback ke /v1/events (2026-11-09 ~08:45 WIB)

Masalah: kapsul pull #1 user (pullId 1, targetRound 712) sudah settled, tapi
settlement kini 752 dan jendela 10 settlement API hanya 741–752, jadi
/capsule-resolve menolak 409 "older than the API's recent-settlements window".

Perbaikan (worker.js saja; client tidak berubah; Worker v12 → v13):
- Bila targetRound tidak ditemukan di `recentSettlements` DAN terbukti sudah
  settled (`targetRound <= settledThroughRound` dari jendela), fallback ke
  `GET /v1/events?category=protocol` (paginasi `nextCursor`, limit 100,
  maks 10 halaman) dan cari `system.settlement_completed` dengan
  `previousSettledThroughRound < targetRound <= settledThroughRound`
  (range di `payload`, tx hash di `source.transactionHash`).
- Record event dibentuk agar `dataHashForSettlement` bisa dipakai tanpa
  perubahan (dataHash tetap transactionHash settlement). Berhenti dini
  begitu sebuah event settlement punya `settledThroughRound < targetRound`
  (event lebih lama hanya men-settle ronde yang lebih rendah).
- Ronde di dalam jendela tetap pakai /v1/settlements dulu; ronde yang masih
  terbuka tetap 409 tanpa panggilan API tambahan; rate limit resolve_log
  tidak berubah; signing (struct + deadline + SIGNING_KEY) tidak berubah.

Tes: TEST-v13-capsule-fallback.js — 28/28 lolos (menjalankan bundle Worker
asli dengan fetch + D1 mock + kunci tes): (a) ronde 712 → dataHash persis
tx event + signature pulih ke kunci tes; (b) ronde di dalam jendela tidak
pernah memanggil /v1/events; (c) ronde yang tidak ditemukan di mana pun
tetap 409 lama; (d) paginasi/early-stop/10-page-cap. Suite lama hijau:
TEST-v34-neo 1813/1813, TEST-v42.5 144/144, TEST-v42.5.3-ghost 27/27,
TEST-motif 11/11, verify-icon-routes 9/9 (total 2032). Asersi versi 12 di
tes lama diperbarui ke 13.

Verifikasi live: GET / → version 13. POST /capsule-resolve
{wallet user, pullId 1, targetRound 712} → dataHash
`0xe5e50fa1c93d4d248816f8127d04dac9e84fe6ad505adf051c4b08ffcebf5880`
(persis tx settlement 712) + signature pulih ke dataSigner
`0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3` (verifikasi independen
EIP-712 dari nol). Deadline 600 dtk.

Yang harus dilakukan user: buka game → RESOLVE KAPSUL → setujui di OKX.
Kapsul terbuka (item 101–104). Pelajaran: jendela resolve hanya ~10
settlement (~1,5–2 jam saat hamster aktif) — lain kali resolve segera
setelah settlement melewati target.
