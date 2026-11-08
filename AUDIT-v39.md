# AUDIT-v39 — Batch 2: EIP-712 attestations + replay recorder + 3 smoke-test bug fixes

Squeek Pixel ID v38 → v39. Batch 2 (Fase 1: EIP-712 + perekam replay, tanpa
enforcement). Pekerjaan: Pekerja A (Worker v3, sudah live), Pekerja B/B2
(script.js: perekam replay + 3 perbaikan bug + prefetch sesi preview),
Pekerja C (tes + deploy + verifikasi — dokumen ini).

Tidak ada perubahan judgement window, tempo, atau formula skor. Tidak ada
perubahan storage key. Semua data pemain (XP, streak, rekor lokal) dipertahankan.

---

## 1. Worker v3 — EIP-712 attestations (Pekerja A, sudah live)

### 1.1 Ringkasan teknis

- `GET /` → `{ service: "squeekchain-leaderboard", version: 3 }`.
- Signer (alamat publik; private key HANYA sebagai Worker secret
  `SIGNING_KEY`, tidak ada di file/repo mana pun dan tidak boleh diminta):
  **`0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3`**
- Domain EIP-712: `{ name: "Squeek Pixel ID", version: "1", chainId: 11155111
  (Sepolia), verifyingContract: <signer address> }`.
- Struct `Attestation(address player, uint256 score, uint256 accuracy,
  string songId, string gameVersion, uint256 seed, bytes32 replayHash,
  uint256 nonce, uint256 deadline)`.
  - `accuracy` = `Math.round(acc * 100)` (skor 90,00% → 9000).
  - `songId` FROZEN: `mode + "|" + genre + "|" + diff + "|" + seedKey`,
    dihitung dari header replay (klien memakai rumus yang sama).
  - `replayHash` = SHA-256 (hex) atas canonical JSON replay — BUKAN keccak;
    struct EIP-712 hanya membawa 32 byte SHA-256 itu.
  - `nonce` per-wallet monotonik (tabel D1 `nonces`, +1 per attestation yang
    ditandatangani server).
  - `deadline` = epoch detik, now + 600 (10 menit).
- Implementasi signing tanpa ethers: `@noble/curves` + `@noble/hashes`
  (secp256k1, keccak_256, sha256), domain separator + struct hash dirakit
  manual (minimal ABI encoding), recovery bit dicari dengan trial 0/1
  terhadap public key dari private key yang sama; signature akhir 65 byte
  `0x + r||s||v` (v = 27 + recovery).

### 1.2 Skema D1 baru (database `squeekchain-leaderboard`, `cd6920f3-…`)

- `scores` — kolom baru `signature TEXT`, `replay_hash TEXT` (selain
  `verified` dari v2). Skor lama tidak dihapus/reset.
- `replays (replay_hash TEXT PRIMARY KEY, wallet, mode, replay TEXT,
  signature, created_at)` — satu replay_hash tidak pernah disimpan dua kali:
  wallet sama → signature tersimpan dikembalikan + `duplicate: true`;
  wallet berbeda → ditolak 400 (`"replay already submitted by another
  wallet"`), jadi satu run tidak bisa di-replay atas nama wallet lain.
- `nonces (wallet TEXT PRIMARY KEY, nonce INTEGER)`.

### 1.3 Alur POST /scores dengan replay (tanpa enforcement)

1. Validasi replay (bentuk v1 + hash) dilakukan SEBELUM session dikonsumsi —
   replay buruk tidak pernah membakar session.
2. `validateReplay`: `v === 1`; header lengkap (`mode` cocok, `genre`/`diff`/
   `seedKey` non-empty, `seed` uint32); `events.{inputs,polls,golden}`
   array; polls ≤ 600; `claim.score === score`, `|claim.acc - acc| ≤ 0,5`,
   `maxCombo` int ≥ 0, counts int ≥ 0; inputs ≤ notes + 50.
3. `replayHash` (bila dikirim) harus sama dengan hash server — bila tidak,
   400 `"replayHash mismatch"`.
4. Dedupe (lihat 1.2).
5. Session: valid (ada, belum expired, belum used) → dikonsumsi (used=1).
   Dengan replay, `header.seed` HARUS sama dengan session seed — mismatch
   ditolak 400 SEBELUM session dikonsumsi.
6. `verified = 1` hanya bila session valid DAN plausibility lolos (sama
   seperti v2). Attestation ditandatangani HANYA bila replay valid +
   verified=1; signature + replayHash disimpan di baris `replays` dan (bila
   skor mengalahkan best wallet itu) di baris `scores`. Tanpa replay, jalur
   v2 berjalan persis seperti sebelumnya (verified 0/1, tanpa signature).
7. Batas replay: ≤ 256 KB; `gameVersion` ≤ 16 karakter (default `"v39"`).

### 1.4 Cara verifikasi signature (untuk siapa pun, tanpa private key)

1. Ambil `signature`, `replayHash`, `nonce`, `deadline`, `score`, `acc`,
   `mode`, `genre`, `diff`, `seedKey`, `gameVersion` dari respons submit.
2. Bentuk `songId = mode|genre|diff|seedKey`; `accuracy = round(acc*100)`.
3. Hitung domain separator + struct hash EIP-712 dengan domain di 1.1 dan
   typehash `Attestation(address player,uint256 score,uint256 accuracy,
   string songId,string gameVersion,uint256 seed,bytes32 replayHash,
   uint256 nonce,uint256 deadline)`.
4. Digest = `keccak256(0x1901 || domainSeparator || structHash)`.
5. Recover signer dari signature (65 byte, v 27/28) atas digest — harus
   `0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3`.
6. Independen dari itu, `replayHash` harus sama dengan SHA-256 atas canonical
   JSON replay yang disimpan di D1 (kunci diurutkan rekursif, tanpa spasi).

---

## 2. Perekam replay v1 (script.js, Pekerja B)

- Format: `{ v: 1, header, events: { inputs, polls, golden, finish }, claim }`.
- Semua waktu `t` = song-time (detik, `ac.currentTime - G.start`, presisi 3
  desimal, dijepit ≥ 0) — BUKAN `event.timeStamp`, BUKAN wall clock.
  `wallStartMs` satu-satunya wall-clock di header.
- `header`: wallet, mode, `seedKey`, `seed` (= `headerSeed`, lihat §2.1),
  genre, diff, lanes, mirror, practice, `offsetMs` (dijepit ±150),
  `wallStartMs`, duration, `initialZoomies`, `initialDistKm`.
- `recordReplayInput(lane)` — tiap tap yang mencapai game (hit, tap kosong,
  maupun miss), dibatasi `chart.length + 50` entri.
- `recordReplayPoll(s)` — tiap poll wheel LIVE/RACE (5 detik), maksimal 600;
  poll GAGAL ikut direkam (`ok: false`, rpm/dist null) — poll gagal = zoomies mati.
- `recordReplayGolden(note, st)` — satu entri per golden note saat muncul.
- `finish()` (kini `async`): mengisi `events.finish` + `claim` (score, acc,
  maxCombo, counts), menolak replay bila `G.sessionId` ada tapi
  `replay.header.seed !== G.sessionSeed`, lalu `lastResult.replayHash =
  await replayHashOf(replay)`.
- Fail-soft total: exception apa pun (termasuk `crypto.subtle` tak tersedia)
  = replay dibuang, `lastResult` tetap tanpa replay, submit jalan seperti
  biasa (verified=0). Submit mengirim `replay + replayHash + gameVersion:
  'v39'` hanya bila replay ada.
- `canonicalJSON(v)` — `JSON.stringify` dengan kunci diurutkan rekursif;
  `replayHashOf` = SHA-256 (`crypto.subtle`) atas canonical JSON, `0x` + 64 hex.
  Tes §5 membuktikan string canonical klien == server (`worker.js`
  `canonical()`) byte-per-byte, stabil terhadap urutan kunci.

### 2.1 header.seed == session seed

- `sessionSeed` = seed numerik sesi (uint32) bila ada session; bila offline
  (tanpa session), diturunkan deterministik dari seedKey (`cyrb53(seedKey) %
  2^32`).
- `headerSeed = sessionSeed !== null ? sessionSeed : (cyrb53(seedKey) %
  4294967296)`; header memakai `seed: headerSeed`; `G` membawa `sessionSeed`
  untuk pengecekan di `finish()`. Worker menuntut `header.seed == seed sesi`
  bila `sessionId` ikut dikirim.

### 2.2 Perbaikan kecil yang ikut dalam Batch 2

- `liveZoomies` di-reset di AWAL `play()` (sebelumnya hanya di `finish()`/
  `stop()`, jadi sisa ZOOMIES lagu sebelumnya bisa bocor ke lagu berikutnya);
  replay lama dibuang di awal `play()`.
- Zoomies saat lagu mulai di-snapshot (`snapZoom` — poll pertama baru 5 detik
  lagi, `judge()` butuh nilai benar dari tap pertama); `liveZoomies =
  snapZoom` sebelum lagu jalan.

---

## 3. Perbaikan 3 bug smoke test v38 (Pekerja B)

### Bug #1 — Panel hasil menampilkan lagu yang SALAH

- Gejala (smoke test v38, 17:18–17:21 WIB): lagu yang dimainkan "Void
  Phrygian", panel hasil menulis "Smoky Blues".
- Akar penyebab: DUA sumber kebenaran yang berbeda. (a) Panel membaca global
  `anthem`, yang bisa dibangun ulang oleh `preview()` sesudah lagu mulai.
  (b) Preview memakai seed wallet (`seedKeyFor`), sementara `play()` mode
  FREE memakai seed server dari `POST /session` — lagu yang dijanjikan
  preview (seed wallet) belum tentu lagu yang dimainkan (seed server).
- Perbaikan: `play()` mengambil snapshot lagu yang SEDANG dimainkan ke
  `G.song = { name, key, scaleName, bpm, notes }`; panel hasil
  (`resultKv`) dan kartu hasil (`drawResultCard`, via `lastResult.song`)
  membaca snapshot itu, bukan global `anthem` dan bukan DOM innerText.
  `lastResult` kini membawa `song` + `grade/maxCombo/counts/avgOff/live/race`
  (selain field v38: sessionId/taps/notes/durationMs).
- Prefetch sesi preview (§4) menutup separuh kedua akar penyebab: preview
  memakai seed sesi yang SAMA dengan yang akan dipakai `play()`.

### Bug #2 — MISS 103 vs NOTES 98

- Gejala: satu lagu penuh tanpa input: panel menulis MISS 103 padahal NOTES 98.
- Akar penyebab: chart yang DIMAINKAN (seed server, 103 note) bukan chart
  yang ditampilkan menu preview (seed wallet, 98 note). Loop MISS di `loop()`
  sendiri menghitung tiap note tepat sekali (`chartIdx` monoton naik + flag
  `judged`; note yang sudah `judged` dilewati, note yang lewat `CONFIG.W.good`
  ditandai `judged = 'miss'` sekali) — tidak ada hitung ganda.
- Perbaikan: guard di `finish()` — bila total judgement melebihi jumlah note
  chart, `MISS` dijepit ke `NOTES − (PERFECT+GREAT+GOOD)`. Invarian:
  PERFECT+GREAT+GOOD+MISS = NOTES. Guard ini pengaman bila chart berubah di
  tengah lagu; akar penyebabnya (preview ≠ lagu dimainkan) ditutup oleh
  prefetch §4, jadi guard idealnya tidak pernah terpicu lagi.

### Bug #3 — Banner "SKOR BARU TERBAIK!" untuk skor 0

- Gejala: skor 0 dengan rekor tersimpan 2300 menampilkan banner
  "SKOR BARU TERBAIK!" — menyesatkan (rekor 2300 tidak tertimpa, tapi banner
  mengklaim sebaliknya).
- Akar penyebab: kondisi "rekor baru" tersebar di tiga tempat (banner
  `bestMsg`, ribbon kartu `lastResultIsNew`, penyimpanan `saveBest`) sehingga
  bisa desinkron.
- Perbaikan: SATU kondisi eksplisit di `finish()`:
  `isNewBest = G.score > 0 && (!prev || G.score > prev.score)` — skor HARUS
  > 0 DAN (belum ada rekor ATAU skor > rekor). Ketiga tempat membaca kondisi
  yang sama: `bestMsg` (banner), `lastResultIsNew` (ribbon kartu), dan
  `if (!G.practice && isNewBest) saveBest(...)`. Skor 0 tidak pernah jadi
  rekor baru dan tidak pernah menimpa rekor tersimpan — termasuk pada game
  pertama (tidak ada rekor 0 yang disimpan).

---

## 4. Prefetch sesi preview (Pekerja B2)

- Masalah: preview memakai seed wallet, play() memakai seed server — preview
  menjanjikan lagu yang berbeda dari yang dimainkan (separuh akar penyebab
  Bug #1).
- Solusi: `ensurePreviewSession(wallet)` — SATU fetch `POST /session` per
  kunjungan tab PLAY (dedupe via `previewFetchInFlight`); sesi yang sama
  dipakai ulang untuk semua perubahan genre/diff (anthem dibangun ulang dari
  seed sesi + genre/diff baru, tanpa fetch baru).
- `play()` mode FREE memakai ulang sesi preview bila masih valid (belum
  dipakai, belum kedaluwarsa, wallet sama) dan menandainya `used` — satu sesi
  = satu play; Worker menolak sesi used, jadi play kedua tanpa sesi baru
  akan unverified. Bila tidak ada sesi preview yang valid, `play()` mengambil
  sesi baru seperti dulu. Mode non-FREE selalu ambil sesi baru (sesi preview
  hanya ada untuk FREE).
- `previewFreeSeedKey(wallet)` = `'FREE-' + seed` sesi preview, atau `null`
  (fallback seed wallet). `preview()` memakai `seedOverride` dari fungsi ini;
  guard pasca-await: bila mode/wallet berubah selagi fetch berjalan, render
  basi tidak menimpa preview terbaru.
- Hemat rate limit Worker (10/wallet/jam, 30/IP/jam): sesi valid bila
  `mode === 'free'`, `expiresAt > now + 5000 ms` (grace), seed uint32,
  belum used.
- Fail-soft: fetch gagal/offline/429 → preview kembali ke seed wallet,
  play() kembali seperti dulu. Game tidak pernah crash. DAILY/CHALLENGE/BOSS/
  LIVE/RACE deterministik dan tidak disentuh.

---

## 5. Hasil tes (Pekerja C)

Perintah: `node TEST-v34-neo.js` + `node TEST-motif.js` (cwd = folder v39).

- **TEST-v34-neo.js: 1084 passed, 0 failed** (baseline v38: 1015 passed,
  2 failed).
- **TEST-motif.js: 10 passed, 0 failed.**
- `node --check script.js` OK (2591 baris).

### 5.1 Dua tes gagal lama — diperbaiki (ekspektasi usang, bukan regresi)

Keduanya perubahan perilaku yang disengaja di v39; tesnya DIPERBARUI dengan
komentar alasan, tidak dihapus:

1. `result card reads the score from G (count-up safe)` — ekspektasi lama
   `G.score !== undefined ? G.score : val(0)`. v39: kartu dibaca dari STATE
   (`lastResult` + `G`): skor dari `G.score` dengan fallback
   `lastResult.score`, semua angka lain dari `lastResult`, tidak pernah dari
   DOM innerText. Tes baru mengunci `const r = lastResult || {};`,
   string skor baru, dan ketiadaan parsing `resultKv` innerText / `val(0)`.
   Ditambah tes baris anthem kartu membaca snapshot `r.song`.
2. `anthem kv row is name + key only (v33.2)` — ekspektasi lama
   `"${anthem.name}" • ${anthem.key}`. v39: baris anthem panel membaca
   snapshot lagu yang dimainkan `"${G.song.name}" • ${G.song.key}`, dan tes
   mengunci ketiadaan bentuk lama.

### 5.2 Tes regresi baru (§13, 65 tes)

- **(a) Panel = lagu dimainkan:** `G.song` snapshot di `play()`; `resultKv`
  + `lastResult.song` + kartu membaca snapshot; `previewFreeSeedKey` dari
  sesi preview; preview memakai `seedOverride`; `play()` memakai ulang sesi
  preview + menandai used; seedKey FREE dari seed sesi. Dijalankan fungsi
  aslinya (`previewSessionValid` + `previewFreeSeedKey` diekstrak dari
  script.js): sesi valid → `'FREE-123456789'`; sesi used / kedaluwarsa /
  mode non-free / seed di luar uint32 / wallet lain → invalid/null.
- **(b) Hitungan note:** guard `finish()` DIEKSEKUSI (bukan hanya dicek
  stringnya) dengan mock chart/counts: 103 MISS pada chart 98 note → MISS 98,
  jumlah = 98; judgement berlebih 50/20/10/30 → MISS 18, jumlah = 98;
  hitungan pas tidak berubah; tanpa chart (0 note) tidak berubah. Loop MISS
  dicek: `chartIdx` monoton + flag `judged`, tiap note dijudge sekali.
- **(c) Banner rekor:** ekspresi `isNewBest` ASLI diekstrak dari `finish()`
  dan dijalankan: (0, rekor 2300) → false; (0, tanpa rekor) → false;
  (2300, 2300) → false; (2301, 2300) → true; (100, tanpa rekor) → true.
  Ditambah: `saveBest` hanya bila `isNewBest`; `bestMsg` dan ribbon kartu
  memakai kondisi yang sama.
- **(d) Replay canonical JSON client == server:** fungsi `canonicalJSON`
  (script.js) dan `canonical` (worker.js) DIEKSEKUSI pada replay contoh yang
  sama (kunci dimasukkan dalam urutan berbeda): string canonical identik
  byte-per-byte; hash SHA-256 stabil terhadap urutan kunci; format
  `0x` + 64 hex; hash berubah bila claim berubah. Klien memakai
  `crypto.subtle.digest('SHA-256', canonicalJSON)`; server memakai
  `sha256(canonical(replay))`.
- **(e) Offset clamp ±150 ms** (fungsi `offsetMsClamp` asli dijalankan):
  200 → 150; −200 → −150; 153/152/148 → 150; 147 → 145; 7 → 5; −7 → −5;
  3 → 5; 2 → 0; 0 → 0. Header replay membawa offset yang sudah dijepit.
- **(f) header.seed == session seed:** `headerSeed` = session seed bila ada
  session, fallback `cyrb53(seedKey) % 2^32`; header memakai
  `seed: headerSeed`; `G` membawa `sessionSeed`; `finish()` membuang replay
  bila `replay.header.seed !== G.sessionSeed`.
- Label versi v39: HTML (≥2 kemunculan), title tab, meta description, README
  judul + entri changelog v39.

---

## 6. Label versi v39

- `index.html`: `<title>SQUEEKCHAIN // v39</title>`, meta description
  `SQUEEKCHAIN v39 — …`, `<h2>PIXEL ID // v39</h2>`, footer `• v39 •`.
- `README.md`: judul `# Squeekchain v39`, entri changelog `**v39**` (Batch 2),
  daftar audit + `AUDIT-v39.md`.
- `script.js`: submit mengirim `gameVersion: 'v39'` (sudah benar sejak
  Pekerja B — tidak diubah). Tidak ada label versi lain di aplikasi.
- 3 proofs Genesis TIDAK disentuh: meta tag `squeekchain-project`
  `05432539-b4e4-4f90-97b3-c258583905b7` (baris 8 index.html, byte-identical),
  baris terakhir README, TXT DNS. Verifikasi live di §7.

---

## 7. Verifikasi live (Pekerja C)

_(Diisi setelah push — lihat ADDENDUM di bawah.)_

---

## 8. Yang TIDAK dilakukan / masih terbuka

- **Smoke test browser satu lagu penuh tanpa input MASIH menjadi tugas
  parent** — Pekerja C tidak punya live browser. Yang harus dicek di browser:
  panel hasil menampilkan lagu yang dimainkan (bukan lagu preview), MISS =
  NOTES pada lagu tanpa input, dan tanpa banner "SKOR BARU TERBAIK!" untuk
  skor 0 dengan rekor tersimpan. Tes Node di §5 mengunci logika penyebabnya,
  tetapi bukan pengganti satu run browser.
- **Tidak ada enforcement replay** — sesuai rencana Fase 1: skor tanpa replay
  (atau replay tidak valid) tetap berperilaku seperti v2. Enforcement
  (menolak skor tanpa replay) adalah Batch 3.
- **Worker v3 tidak di-deploy ulang oleh Pekerja C** — Worker sudah live
  (Pekerja A); file `worker.js` di repo ini hanya disalin apa adanya untuk
  push. Logika worker TIDAK disentuh.
- **Tidak ada perubahan gameplay** selain yang tercantum di §2–§4.
- **Artifact preview in-app** (slug `squeekchain-v26-fix`): lihat ADDENDUM.

---

## ADDENDUM — Deploy + verifikasi live (Pekerja C, 2026-11-08)

_(Diisi setelah push + verifikasi live; commit terpisah seperti pola v38.)_
