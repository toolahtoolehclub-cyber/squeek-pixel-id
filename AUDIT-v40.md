# AUDIT-v40 — Batch 3 (Fase 2, langkah 1): ekstraksi engine.js + perbaikan determinisme

Squeek Pixel ID v39 → v40. Pekerjaan: Pekerja A — ekstraksi engine
(Batch 3, langkah 1 dari Riset-OnChain-v38-Diskusi.md Fase 2).
`worker.js` v4 (verifikasi replay async + enforcement) dikerjakan Pekerja
lain secara paralel di folder yang sama dan TIDAK disentuh di sini — tapi
API engine ini (`buildChart(header)`, `simulate(chart, replay)`, return
shape di §1.3) dirancang cocok dengan kontrak yang dipakai worker v4
(`import "./engine.js"` + `globalThis.SqueekEngine`, lihat worker.js
baris 129-139, 576-625).

Tidak ada perubahan gameplay, judgement window, tempo, formula skor,
storage key, XP, format replay v1, atau alur submit EIP-712. Submit kini
mengirim `gameVersion: 'v40'`.

---

## 1. engine.js — satu sumber kebenaran (baru, 340 baris)

### 1.1 Format modul

UMD: classic script di browser (`window.SqueekEngine`, dimuat dengan
`<script src="engine.js" defer>` SEBELUM `script.js` — deferred script
jalan berurutan, jadi `SqueekEngine` sudah ada saat `script.js` dieksekusi),
`require()` di Node (`module.exports`), dan `import './engine.js'` di
Cloudflare Worker (efek samping: mengisi `globalThis.SqueekEngine`).
Tidak ada `export` statement supaya file tetap bisa di-load sebagai
classic `<script>`. Diverifikasi: load lewat `vm` tanpa `module`/`window`
(`globalThis.SqueekEngine` terisi, `buildChart` jalan) dan lewat
`require()` di semua tes.

MURNI: tanpa DOM, tanpa network, tanpa Date/wall-clock, tanpa
`Math.random`, tanpa storage/timer — dikunci tes §5.4 (regex atas kode
tanpa komentar). Semua yang tidak deterministik (waktu dinding, snapshot
roda) masuk lewat replay, bukan lewat fungsi.

### 1.2 Yang diekstrak (disalin verbatim dari script.js v39)

| Fungsi engine | Asal v39 | Catatan |
|---|---|---|
| `cyrb53(str, seed)` | script.js baris 615 | Hash seed chart |
| `mulberry32(seed)` | script.js baris 616 (`rng`) | RNG chart |
| `buildChart(header)` | `makeAnthem()` baris 635-677 + penskalaan practice dari `play()` baris 892 | Mengembalikan anthem lengkap (bpm, step, scaleName, name, key, root, scale, chart, drums, duration, hue, lanes, mirror). `drums` adalah DATA (dipakai `schedule()` untuk audio) — audio tetap di script.js |
| `simulate(chart, replay)` | `judge()` baris 954-991, miss-marking `loop()` baris 1015-1023, `finish()` baris 1068-1150 | Mengembalikan `{score, acc, maxCombo, counts, grade, playerDistM, oppDistM, win, goldenHits, goldenChecks, oppDistMDerived, oppDistMMatch}` |
| `accuracyOf(counts)`, `gradeOf(acc, miss)` | `accuracy()`, `grade()` | Rumus sama persis, termasuk `tot 0 → 100` |
| `deriveOppDistM(header, polls)` | `raceOppDist()` | Diagnostik (lihat §3.2) |

`script.js` memakai engine lewat alias (`const cyrb53 =
SqueekEngine.cyrb53; const rng = SqueekEngine.mulberry32;`, baris ~612)
dan `makeAnthem()` yang kini mendelegasikan ke
`SqueekEngine.buildChart(header)` (+ param ke-6 `practice`, default
`false`). Tabel data `GENRES`/`DIFFICULTIES` tetap ada di script.js
(dipakai juga di luar `makeAnthem`: validasi param URL baris ~2550,
`CONFIG.SPEED` di `play()`) — isinya dikunci sama dengan engine lewat
tes §5.4. `SCALES`/`SONG_MOODS`/`NOTE_NAMES` hanya dipakai `makeAnthem`,
jadi pindah ke engine saja (dihapus dari script.js).

### 1.3 Aturan determinisme (didokumentasikan di header engine.js)

1. **Chart seed = `cyrb53(header.seedKey)`.** `header.seed` (uint32)
   adalah seed SESI (mengikat replay ke session Worker), BUKAN seed
   chart — jangan tertukar. LIVE: bpm dari seedKey (regex
   `/^LIVE-\d{4}-\d{2}-\d{2}-(\d{2,3})$/`); RACE/DAILY/BOSS/FREE: bpm
   dari rng seperti biasa. Practice (`header.practice`): semua nilai
   waktu × 1/0,6, bpm `Math.round(bpm*0,6)` — persis `play()` v39,
   kini di dalam `buildChart` supaya Worker cukup membaca header.
2. **Input:** song-time (detik, 3 desimal, ≥ 0). Judge memakai
   `st = t - offsetMs/1000`. Jendela PERFECT 0,045 / GREAT 0,09 / GOOD
   0,135 detik; pencarian note terdekat BERHENTI bila
   `n.t - st > 0,185` (= GOOD + 0,05).
3. **ZOOMIES ×2 HANYA dari log poll** (poll terakhir dengan
   `poll.t <=` waktu tap; sebelum poll pertama,
   `header.initialZoomies`; poll gagal = mati). Di luar live/race,
   zoomies SELALU false (client tidak pernah menyalakannya di mode
   lain) — `simulate()` mengabaikan initialZoomies/poll di mode lain.
4. **FEVER ×1,5:** combo ≥ 30. Pengali kombo
   `min(2, 1 + floor(combo/10)*0,1)` — kombo SETELAH increment.
   Skor per hit = `Math.round(base * mult)` (PERFECT 300 / GREAT 200 /
   GOOD 100). Golden TIDAK dikali (flat +1000).
5. **GOLDEN NOTE:** note pertama yang belum di-judge dengan `n.t >`
   song-time saat batas ronde terlewati. Replay merekam `{t, index}`.
   `simulate()` memakai index TEREKAM untuk bonus (+1000 poin, +5 m,
   hanya bila note itu akhirnya kena) dan MELAPORKAN di
   `goldenChecks[]` apakah pick itu cocok dengan aturan. Bila tidak
   cocok, skor tetap direproduksi apa adanya — Worker yang memutuskan.
6. **RACE:** `playerDist` HANYA dari note yang di-judge (PERFECT 1,0 m
   / GREAT 0,7 m / GOOD 0,4 m) + golden 5 m. `oppDistM` untuk
   menang/kalah = nilai TEREKAM di `replay.events.finish.oppDistM`.
   `deriveOppDistM()` menghitung ulang dari log poll; selisih wajar
   ≤ 1,05 m (pembulatan poll 3 desimal + finish 0,1 m).
7. **MISS:** note jadi miss saat `songTime - n.t > 0,135` (tanpa
   offset, mengikuti `loop()`). Invarian
   PERFECT+GREAT+GOOD+MISS = NOTES (guard `finish()` v39
   dipertahankan sebagai pengaman).
8. **AKURASI:** `(perfect*300 + great*200 + good*100) / (total*300)
   * 100`, dihitung SEBELUM guard MISS (persis `finish()` v39).

---

## 2. Perubahan di script.js (diff lengkap vs v39 — 5 titik, semua kecil)

1. **Baris ~612:** `cyrb53`/`rng` (2 fungsi) → alias ke `SqueekEngine`;
   `SCALES`/`SONG_MOODS`/`NOTE_NAMES` dihapus (pindah ke engine).
2. **`makeAnthem()`** (dulu baris 635-677, 43 baris) → wrapper 6 baris
   yang mendelegasikan ke `SqueekEngine.buildChart(header)`; jalur
   `randomize` (tidak pernah true — `genBtn` adalah `generateCard`,
   bukan `makeAnthem`) dipertahankan via `header.seedNum` opsional.
3. **`play()`:** `makeAnthem(w, false, seedKey, lanes, mirror,
   practiceMode)`; blok penskalaan practice manual dihapus, tinggal
   `CONFIG.SPEED` (rendering). Hasil akhir identik — dibuktikan 14
   golden case (§5.2) termasuk 2 case practice.
4. **`refreshLive()`:** `if (G && !G.ended && G.mode === 'race')
   computeZoomies();` tepat sebelum `recordReplayPoll(s)` — lihat §3.1.
5. **Submit:** `gameVersion: 'v40'` (baris 2222).

`judge()`, `loop()`, `finish()`, `recordReplay*`, `canonicalJSON`,
`replayHashOf`, dan semua logika lain TIDAK disentuh. `worker.js` TIDAK
disentuh. `style.css` TIDAK disentuh.

---

## 3. Perbaikan / audit determinisme

### 3.1 [DIPERBAIKI] ZOOMIES race flip tertunda 0–500 ms (satu-satunya celah nyata yang ditemukan)

**Temuan:** `liveZoomies` di mode RACE hanya diubah oleh tick 500 ms
(`startRaceTick()` → `computeZoomies()` membaca `liveSnapshot`),
sementara poll roda (5 detik) dicatat di `refreshLive()`. Jadi flag
bisa flip sampai 500 ms SESUDAH waktu poll yang terekam di replay —
selisih itu tidak ada di replay, dan `simulate()` tidak bisa
mereproduksi skor tap di jendela itu secara exact. Di mode LIVE tidak
ada masalah ini (`updateLiveHud()` sudah dipanggil di dalam
`refreshLive()`, sebelum `recordReplayPoll`).

**Perbaikan (script.js, `refreshLive()`):** panggil `computeZoomies()`
untuk mode race tepat setelah snapshot mendarat, sebelum
`recordReplayPoll(s)` — waktu flip == waktu poll yang terekam.
HUD tidak berubah (tetap di-update tick 500 ms); rumus skor tidak
berubah; satu-satunya efek perilaku: di mode race, flag kini flip
maksimal 500 ms LEBIH AWAL (tepat saat poll), bukan lebih lambat.
`liveZoomies` tetap di-reset di awal `play()` (perbaikan v39, baris
~812) — diverifikasi masih ada dan dikunci tes.

### 3.2 [TERVERIFIKASI, tanpa perubahan kode] Race: oppDistM & playerDist

- `finish()` (baris ~1100-1101): `oppDist = raceOppDist();
  raceWin = G.race.playerDist > oppDist;` — SATU variabel `oppDist`
  dipakai untuk keputusan menang/kalah DAN untuk
  `replay.events.finish = { t, oppDistM: +oppDist.toFixed(1) }`
  (baris ~1148). Nilai terekam == nilai keputusan (minus pembulatan
  0,1 m). Dikunci tes §5.7 (string + simulasi).
- `playerDist` hanya ditulis di DUA tempat, keduanya di `judge()`:
  `+= {perfect: 1.0, great: 0.7, good: 0.4}[k]` saat hit, dan `+= 5`
  saat golden kena. Tidak ada sumber lain. Dikunci tes (tepat 2
  kemunculan `playerDist +=`).
- `raceOppDist()` memakai snapshot poll TERAKHIR — jadi `oppDistM`
  dapat dihitung ulang dari log poll (`deriveOppDistM()`). Satu
  pengecualian yang didokumentasikan: bila balapan dimulai saat roda
  OFFLINE, client selalu mencatat `oppDistM` 0 walau poll belakangan
  ok (`G.race.offline`); nilai terekam tetap yang benar, dan
  `oppDistMMatch` sengaja BUKAN gerbang penolakan di worker v4.

### 3.3 [TERVERIFIKASI + DIDOKUMENTASIKAN] Golden Note

Aturan pick (di `loop()`): note pertama yang belum di-judge dengan
`n.t > st` saat `roundKeyFor(new Date())` berubah. Yang direkam sudah
cukup untuk mereproduksi + memverifikasi: event `{t, index}` membawa
waktu song-time saat pick terdeteksi DAN index note. `simulate()`
memeriksa tiap event: `expected` = note pertama yang belum di-judge
dengan `n.t > t` (dinilai dari input-input dengan `t <=` waktu event),
`ok = (expected === index) && !goldenPending`. Bonus mengikuti index
TEREKAM. Tes mencakup: golden kena PERFECT (+1000, +5 m), kena GREAT
(bonus tetap jatuh), dilewatkan (tanpa bonus, note jadi miss), dan
pick yang SALAH (skor tetap direproduksi, `check.ok === false`).

Tie-break yang didokumentasikan (engine.js aturan 5): input dan golden
event dengan `t` yang SAMA diproses input dulu (di client, handler tap
jalan sebelum rAF yang mem-pick golden berikutnya).

### 3.4 Batas yang diketahui (didokumentasikan, bukan bug yang bisa diperbaiki tanpa mengubah format replay v1)

- **Kuantisasi 1 ms:** semua waktu replay dibulatkan ke 3 desimal.
  Kasus yang jatuh dalam 0,5 ms dari tepi jendela judgement
  (0,045/0,09/0,135) atau dari tepi pick golden secara teori bisa
  berbeda antara client dan simulasi. Tap script di tes sengaja
  menghindari zona itu (offset +20 ms untuk live test supaya tap GOOD
  tidak jatuh di zona ambigu sub-frame — lihat komentar di tes).
- **Granularitas frame:** `loop()` menandai miss per frame (~16 ms).
  Tap yang mendarat < 1 frame sesudah note kedaluwarsa secara mentah
  tapi masih dalam jendela ber-offset bisa kena di client asli dan
  miss di simulasi (atau sebaliknya). Zona ini ≤ ~16 ms dan hanya
  untuk offset > 0. Tes menghindarinya; driver memakai aturan exact
  (`T - n.t > 0,135`) yang sama dengan `simulate()`.
- **Pembulatan `oppDistM` 0,1 m:** keputusan live memakai float
  mentah; `simulate()` memakai nilai terekam (yang akan dilihat
  Worker). Keduanya hanya bisa berbeda bila selisih
  `playerDist - oppDist` < 0,05 m.

---

## 4. Label versi v40

- `index.html`: `<title>SQUEEKCHAIN // v40</title>`, meta description
  `SQUEEKCHAIN v40 — …`, `<h2>PIXEL ID // v40</h2>`, footer `• v40 •`,
  dan `<script src="engine.js" defer></script>` SEBELUM `script.js`.
- `README.md`: judul `# Squeekchain v40`, entri changelog `**v40**`,
  daftar file + `engine.js` + `AUDIT-v40.md`.
- `script.js`: submit mengirim `gameVersion: 'v40'`.
- 3 proofs Genesis TIDAK disentuh: meta tag
  `squeekchain-project` `05432539-b4e4-4f90-97b3-c258583905b7`
  (baris 8 index.html, byte-identical), baris terakhir README,
  TXT DNS. (Verifikasi live menjadi tugas parent setelah push —
  lihat §6.)

---

## 5. Hasil tes (Pekerja A)

Perintah: `node TEST-v34-neo.js` + `node TEST-motif.js` (cwd = folder v40).

- **TEST-v34-neo.js: 1198 passed, 0 failed** (baseline v39: 1084
  passed, 0 failed; +114 tes baru §14, −0 tes lama — semua tes v39
  tetap lolos, hanya label v39→v40 dan 3 string check yang pindah ke
  engine.js yang diperbarui).
- **TEST-motif.js: 11 passed, 0 failed** (baseline 10/10 + 1 tes baru:
  wrapper `makeAnthem` == `engine.buildChart`).
- `node --check script.js`, `node --check engine.js`,
  `node --check TEST-v34-neo.js`, `node --check TEST-motif.js` OK.

### 5.1 §14a–14e — wiring, vektor, golden chart, determinisme

- `engine.js` dimuat sebelum `script.js`; `script.js` tidak punya
  implementasi `cyrb53`/`rng` kedua; `makeAnthem` mendelegasikan;
  `play()` meneruskan `practiceMode`; tidak ada penskalaan anthem
  manual lagi; `computeZoomies()` race di `refreshLive()`; reset
  `liveZoomies` di awal `play()` tetap ada; engine mengekspor 4
  fungsi wajib; engine murni (tanpa DOM/network/Date/`Math.random`).
- Vektor kunci: `cyrb53('') = 3338908027751811`,
  `cyrb53('a') = 7929297801672961`,
  `cyrb53('FREE-123456789') = 5616028065809105`,
  `cyrb53('DAILY-2026-11-08') = 3139317285301407`,
  `mulberry32(0)` → `0.26642920868471265, 0.0003297457005828619,
  0.2232720274478197`; `mulberry32(12345)` →
  `0.9797282677609473`.
- **14 golden case** (`TEST-v40-golden-charts.json`, diambil dari
  `makeAnthem` v39 ASLI sebelum refactor — semua genre/diff,
  LIVE/RACE/DAILY/BOSS/DUEL, wallet, 4-lane, mirror, practice):
  `buildChart(header)` **identik byte-per-byte** (perbandingan
  `JSON.stringify`) dengan output v39, termasuk 2 case practice
  (penskalaan tempo 60% yang dulu manual di `play()`).
- Tabel `GENRES`/`DIFFICULTIES` engine == script.js (teks baris).
- `buildChart` deterministik, sensitif terhadap seedKey, bpm LIVE
  dari seedKey (128), bpm RACE dari rng (bukan 145), practice
  mengalikan durasi dengan 1/0,6 dan membulatkan bpm ke 60%, mirror
  membalik semua lane, genre/diff tak dikenal ditolak.
- Wrapper `makeAnthem` (diekstrak dari script.js, dijalankan)
  == `buildChart` untuk free/normal, practice, wallet-seed 4-lane
  mirror, dan LIVE seedKey.

### 5.2 §14f — simulate() vs judge() CLIENT ASLI (bukti exact)

Driver menjalankan `judge()` yang diekstrak verbatim dari
`script.js` (dengan stub DOM/audio: `$, updatePrecision, tone,
addFloatText, hud, juiceHit, navigator, mtof, LW, glShockwave`),
plus miss-marking ala `loop()` dan zoomies dari log poll — lalu
hasilnya dibandingkan EXACT (skor, acc float, maxCombo, counts,
playerDistM) dengan `SqueekEngine.simulate()` untuk replay yang sama.
Klaim replay dibangun dari hasil DRIVER (bukan dari engine), jadi
tes ini membuktikan "simulate mereproduksi permainan terekam",
bukan "simulate cocok dengan dirinya sendiri".

Kasus tangan (angka dihitung manual, independen dari kedua
implementasi): 12× PERFECT = **3690** (SS, acc 100); 35× PERFECT
= **13110** (FEVER ×1,5 dari kombo 30); mixed P/G/Go = **3090**,
acc 83,33 (8P/2G/2Go); offset +50 ms tap di `note.t+0,05` =
PERFECT semua (3690); offset +50 ms tap di `note.t` = GREAT semua
(2460, acc 66,67); tap kosong + tap telat + miss = 3300, miss 1,
maxCombo 6, acc 91,67; ZOOMIES dari polls (5,5–8,5 dtk) = **4590**
(poll gagal tidak menyalakan); `initialZoomies` tanpa poll = 7380;
zoomies DIABAIKAN di mode free (3690 walau header mengklaim
initialZoomies + poll 80 rpm); GOLDEN kena PERFECT = 4690,
playerDist 17 m, menang vs 10 m, pick valid; GOLDEN dilewatkan =
3300, 11 m, tanpa bonus; GOLDEN kena GREAT = 4590, 16,7 m; pick
golden yang SALAH tetap direproduksi skornya tapi `check.ok=false`.

Kasus lagu asli (`buildChart` + tap script LCG deterministik):
FREE cyber/normal offset +20 ms + polls zoomies; RACE + golden +
zoomies + offset −30 ms (initialZoomies true, `oppDistM` dari poll
terakhir); PRACTICE tempo 60%; 4-lane MIRROR hard offset −80 ms;
fuzz 5 seed (genre/diff/mirror/offset berbeda) — **semua EXACT**
(driver == simulate == claim).

Tambahan: `simulate()` tidak memutasi chart pemanggil dan
idempotent (dua kali = hasil sama).

### 5.3 §14g–14h — race (b)

`finish()` memakai SATU `oppDist` untuk menang/kalah DAN
`replay.finish` (string check); `playerDist` hanya bertambah di
`judge()` (tepat 2 kemunculan `playerDist +=`: hit + golden);
`deriveOppDistM` = poll ok terakhir − `initialDistKm` (10 m untuk
poll 12,5 → 12,51 km), 0 bila tanpa poll ok, tidak pernah negatif.

### 5.4 Tes yang diperbarui (bukan dihapus)

- Label v39→v40: `html says v40`, tab title, meta description,
  README title + entri v40 (entri v39 tetap dicek sebagai riwayat).
- `gameVersion: 'v39'` → `'v40'` di §13d.
- 3 string check pindah ke engine.js: `SONG_MOODS`, `const motif`,
  `motif[bar % 2][s]`, dan `makeAnthem returns a song name` →
  `buildChart returns a song name (v40: in engine.js)`.
- Tes "precision readout reset" memakai string panggilan
  `makeAnthem` baru (argumen ke-6 `practiceMode`).
- `TEST-motif.js`: mengekstrak wrapper `makeAnthem` dari script.js
  (bukan lagi badan `makeAnthem` + tabel-tabel) dan menjalankannya
  lewat `SqueekEngine`; 10 asersi lama tidak berubah + 1 asersi baru.

---

## 6. Yang TIDAK dilakukan / masih terbuka

- **Tidak ada deploy Worker, push GitHub, atau perubahan artifact**
  — sesuai tugas. `worker.js` v4 di folder ini adalah pekerjaan
  Pekerja lain (paralel); file itu TIDAK disentuh di sini.
- **Verifikasi live (browser + push + site live) menjadi tugas
  parent** — Pekerja A tidak punya live browser. Yang harus dicek
  sesudah push: `engine.js` live == lokal byte-per-byte, game jalan
  normal (satu lagu penuh), panel hasil benar, dan 3 proofs Genesis
  utuh. Tes Node di §5 mengunci logika, tetapi bukan pengganti satu
  run browser.
- **Tidak ada enforcement replay di client** — `simulate()` hanya
  dipakai tes di sini; enforcement adalah langkah Worker v4 (Pekerja
  lain) yang memakai API ini.
- **Smoke test browser v39 yang sudah lolos** (panel = lagu dimainkan,
  MISS = NOTES, tanpa banner untuk skor 0 — MEMORY 2026-11-08
  17:54–17:56 WIB) tidak diulang di sini karena tidak ada browser;
  tidak ada perubahan pada kode panel hasil di v40, jadi temuan itu
  tetap berlaku.
- **Perbedaan perilaku yang ditemukan:** hanya satu, dan itu
  disengaja — flip ZOOMIES race kini maksimal 500 ms lebih awal
  (tepat saat poll mendarat), lihat §3.1. Selain itu tidak ada
  perbedaan perilaku yang ditemukan: chart identik (golden case),
  skor identik (driver vs simulate), dan semua 1084 tes v39 tetap
  lolos.

---

## 7. Worker v4 — verifikasi replay async + enforcement (Pekerja B)

### 7.1 Ringkasan perubahan dari v3

| | v3 (Batch 2) | v4 (Batch 3) |
|---|---|---|
| `POST /scores` tanpa replay | diterima, verified 0/1 ikut session | **DITOLAK 422** (`"replay required"`) |
| `POST /scores` replay valid | langsung verified=1 + attestation (sinkron) | **202 pending**, diverifikasi Cron tiap menit |
| `verified=1` | session valid + plausibility (+ replay valid) | **HANYA** replay lolos simulasi + attestation |
| Session | opsional | **WAJIB**, valid, sekali pakai, seed cocok |
| Practice | tidak dicek server | **DITOLAK 422** |
| Skor lama (TEST 3000, race 66805) | verified 0 | tetap verified 0, **tidak dihapus/diubah** |
| `GET /` | version 3 | **version 4** |
| Endpoint baru | — | `GET /verify?replayHash=...` |
| Tabel D1 baru | — | `verify_queue` (+ kolom `verification_status` di `replays`) |

Alasan async (jujur): Worker Free = 10 ms CPU/request. `buildChart` +
`simulate` satu lagu penuh itu kecil (orde 1–2 ms diukur lokal), tapi
antrean + Cron Trigger menjaga jalur submit tetap murah dan memberi ruang
bila chart/replay membesar. Cron Trigger TERSEDIA di free tier —
diverifikasi live 2026-11-08 (`GET .../schedules` merespons; jadwal
`* * * * *` terpasang dan TERBUKTI memproses antrean, §7.7). Ini
benar-benar async: POST mengembalikan 202 pending, Cron memverifikasi,
`GET /verify` melaporkan pending → verified (200) atau rejected (422).
Bukan klaim async di atas verifikasi sinkron.

### 7.2 Alur POST /scores (sinkron, murah — tanpa buildChart/simulate)

1. Rate limit (tidak berubah: 10/wallet/jam, 30/IP/jam, 429; semua percobaan
   dicatat di `submit_log` SEBELUM validasi lain).
2. Validasi skor/acc dasar + plausibility (tidak berubah; 400 bila gagal).
3. **Enforcement**: tanpa `replay` → 422 `"replay required"`.
4. Parse replay (≤ 256 KB) → 422 bila bukan JSON / terlalu besar.
5. `validateReplay` (sinkron, §7.4): bentuk v1, batas-batas, hash, dan cek
   determinisme yang tidak butuh chart (4a, 4c, 4d). Gagal → 422.
   Replay buruk TIDAK PERNAH membakar session (prinsip v3 dipertahankan).
6. `replayHash` (bila dikirim) harus sama dengan hash server → 422.
7. **Dedupe SEBELUM session disentuh** (supaya retry replay yang sama
   tidak membakar session baru): hash sudah ada → kembalikan statusnya
   (verified → 200 + signature tersimpan + `duplicate:true`;
   pending/processing → 202; rejected → 422 + reason). Wallet berbeda →
   422.
8. **Session WAJIB**: harus ada (`sessionId`), ditemukan, belum used,
   belum expired, `header.seed == session.seed`. Lalu cek wall-clock:
   `wallStartMs` harus di dalam jendela session
   (`[expires_at − 30 mnt, expires_at]`, toleransi 5 detik) dan submit
   harus tiba PALING CEPAT `duration` lagu setelah run dimulai
   (`now ≥ wallStartMs + duration − 5 dtk`) — replay yang "dimainkan"
   dalam 0 detik wall time adalah fabrikasi. Gagal → 422.
   Session dikonsumsi (used=1) hanya setelah SEMUA cek di atas lolos.
9. Simpan: `replays` (status `pending`, signature NULL) + `verify_queue`
   (status `pending`) → **202**
   `{ok:true, pending:true, verification_status:"pending", replayHash,
   wallet, mode, score}`. Skor BELUM menyentuh board.

### 7.3 Cron Trigger — `scheduled()` tiap menit

- Mengambil ≤ 3 baris `pending` terlama (`VERIFY_BATCH = 3`, supaya satu
  invokasi terjadwal nyaman di dalam budget CPU free tier 10 ms).
- Klaim baris (`pending → processing`, bersyarat `status='pending'`)
  supaya dua invokasi yang tumpang tindih tidak memverifikasi replay yang
  sama dua kali. Baris `processing` lebih tua dari 5 menit direset ke
  `pending` di awal tiap run (invokasi yang mati di tengah jalan).
- Per baris, `verifyOne`: `buildChart(header)` → `simulate(chart, replay)`
  → `verifySimulated` (§7.4). Lolos → tandatangani attestation EIP-712
  (nonce per-wallet +1, deadline now+600) dan tulis SEMUA dalam SATU batch
  D1 (satu transaksi): queue `verified` + signature/nonce/deadline,
  replays `verified` + signature, `nonces`, dan upsert `scores`
  (verified=1, hanya bila mengalahkan best wallet itu — klausa
  `WHERE excluded.score > scores.score` yang sama seperti v3).
  Gagal deterministik → queue + replays `rejected` + reason.
  Error transient (engine throw, D1 hiccup, CPU) → attempts+1, baris
  kembali `pending`; setelah 3 percobaan → `rejected`
  (`"verification error"`).
- `GET /verify?replayHash=...`: pending/processing → **202**;
  verified → **200** + signature/nonce/deadline; rejected → **422** +
  reason; tidak ditemukan → 404. Baris v3 lama (di `replays` tanpa baris
  antrean) tetap bisa dicek.

### 7.4 `verifySimulated` + cek determinisme 4a–4d

Perbandingan (fungsi murni, unit-testable): durasi chart vs
`header.duration` (±0,011); jumlah claim counts == panjang chart; tiap
golden lolos cek 4b (`sim.goldenChecks[].ok`); `sim.score`,
`sim.maxCombo`, tiap counts SAMA PERSIS; `|sim.acc − claim.acc| ≤ 0,01`
(claim dibulatkan klien ke 2 desimal). `sim.oppDistMMatch` SENGAJA bukan
gate penolakan — engine mendokumentasikan bahwa nilainya false untuk
balapan yang dimulai saat roda offline (§3.2); cek 4a sudah menangani
pengecualian itu.

- **(4a) `finish.oppDistM` vs log poll** (`checkOppDist`, sinkron).
  `raceOppDist()` = `max(0, (snapshotDistTerakhir − startDistKm) × 1000)`,
  snapshot = hasil `refreshLive` terakhir, tiap `refreshLive` terekam
  sebagai poll. Bukan race → harus `null`. Race + poll terakhir gagal
  (atau tanpa poll) → harus 0 (±0,05). Race + poll terakhir ok → harus di
  `[base − 2, base + rateMax × gap × 1000 × 1,5 + 2]`, `base` = (dist poll
  ok terakhir − `initialDistKm`) × 1000 m, `gap = finish.t − t poll
  terakhir`, `rateMax` = laju roda tercepat teramati (lantai 0,002
  km/detik = 2 m/detik). Pengecualian: `initialDistKm == 0` → nilai 0
  juga diterima (roda offline di awal lagu memaksa `oppDistM` 0 walau poll
  belakangan ok — tidak bisa dibedakan dari header saja). `oppDistM`
  tidak membawa skor — ini cek konsistensi, bukan gate skor.
- **(4b) Golden** — engine menghitung di `goldenChecks[]` (aturan 5,
  §1.3): tiap pick harus note pertama yang belum di-judge dengan
  `n.t > t` berdasarkan input sebelum `t`. Worker menolak bila ada satu
  pun `ok == false`. Batas: ≤ 2 event, `t` naik ketat, index berbeda.
  **Celah jujur:** 4b TIDAK memvalidasi bahwa event golden terjadi TEPAT
  di batas ronde 10 menit wall-clock — batas itu memakai waktu LOKAL
  pemain (zona waktu tidak ada di replay), jadi server tidak bisa
  menghitungnya dari `wallStartMs`. Golden palsu di waktu sembarang yang
  memenuhi 4b masih bisa lolos (+1000 per event, maks 2). Perbaikan penuh
  butuh replay v2 (rekam `roundKey` / waktu dinding batas di header).
- **(4c) Polls** — `t` tidak menurun, di dalam durasi lagu (+2 detik);
  poll ok → `rpm ≥ 0`, `dist ≥ 0`; poll gagal → `rpm`/`dist` HARUS `null`.
  Monotonisitas `dist` TIDAK diberlakukan (perilaku reset API roda tidak
  diketahui; cek 4a memakai poll ok terakhir sehingga tetap kokoh).
- **(4d) ZOOMIES hanya dari log poll** — `rpm ≥ 70` dari poll terakhir
  (`poll.t ≤` waktu tap); sebelum poll pertama, `header.initialZoomies`;
  `simulate` menerapkan ini (dan SELALU false di luar live/race). Worker
  memberlakukan sisi headernya: di luar live/race, `initialZoomies` harus
  `false` dan `initialDistKm` harus 0. Perbaikan klien v40 (§3.1) yang
  membuat ini dapat direproduksi: `liveZoomies` race kini flip tepat saat
  poll mendarat. Konsekuensi: replay RACE client v39 bisa gagal simulasi
  bila flip jatuh di jendela 0–500 ms itu — dapat diterima karena v40 yang
  live.

Dua celah format yang ditutup Worker (bukan engine): `header.seedNum`
DITOLAK (jalur randomize lama yang tidak pernah dipakai gameplay — bila
dibiarkan, replay palsu bisa memilih seed chart sembarang); `genre`/`diff`
di-whitelist ke `{cyber,synth,chip,void}`/`{easy,normal,hard}` supaya
`buildChart` tidak pernah throw deterministik di Cron (fail closed bila
game menambah genre/diff — Worker harus diperbarui). Batas kuantisasi:
waktu replay dibulatkan ke 1 ms — kasus dalam 0,5 ms dari tepi jendela
judgement/pick golden secara teori bisa berbeda antara client dan simulasi
(false reject yang sangat jarang, belum pernah teramati).

**Apa yang TIDAK dibuktikan verifikasi (jujur):** skor yang diklaim DAPAT
DICAPAI oleh input-input terekam pada chart deterministik untuk seedKey
itu; run dimulai di dalam jendela session segar; run memakan waktu paling
tidak selama durasi lagu dalam wall time. Verifikasi TIDAK membuktikan
manusia bermain real-time: bot yang mengambil session, menurunkan chart
publik, dan menunggu selama durasi lagu masih bisa memfabrikasi sebuah
run. Session + wall-clock membatasi itu ke satu session segar per run;
spam skor buta (angka karangan) sudah mati.

### 7.5 Cara Worker memakai engine.js (build)

`upload_worker.py` hanya mengunggah SATU file, jadi `engine.js` di-inline
oleh esbuild pada SAAT DEPLOY (repo tetap memakai import; lihat
`build-worker.sh` di folder v40). Karena UMD tidak punya ESM `export`,
named import GAGAL di esbuild — Worker memakai side-effect import + baca
dari global:

```js
import "./engine.js"; // UMD: mengisi globalThis.SqueekEngine
const { buildChart, simulate } = globalThis.SqueekEngine;
```

### 7.6 Skema D1 (migrasi `migrate-v4.sql`, diterapkan 2026-11-08 ~11:08 UTC)

```sql
CREATE TABLE IF NOT EXISTS verify_queue (
  replay_hash TEXT PRIMARY KEY, wallet TEXT NOT NULL, mode TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'GUEST', score INTEGER NOT NULL, acc REAL NOT NULL,
  replay TEXT NOT NULL, game_version TEXT NOT NULL DEFAULT 'v40', session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|verified|rejected
  reason TEXT, signature TEXT, nonce INTEGER, deadline INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_verify_queue_status ON verify_queue(status, created_at);
ALTER TABLE replays ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
UPDATE replays SET verification_status = 'verified' WHERE signature IS NOT NULL;
```

Tidak ada perubahan pada `scores` / `sessions` / `submit_log` / `nonces`.
Tidak ada baris lama yang dihapus. (`UPDATE` mengubah 0 baris — tidak ada
replay ber-signature tersimpan saat migrasi.)

### 7.7 Deploy Worker v4

- **Deploy id:** `squeekchain-leaderboard` (Workers Scripts API tidak
  mengembalikan UUID deployment terpisah — id script adalah pengenalnya).
- **Bundle:** 137,0 KB (esbuild, `worker.js` + `engine.js` + @noble),
  SHA-256 `f3afad804958b0804ada4dc729c373efcafb1cea9a354e0265aab295a39b4fbd`.
- **Waktu deploy:** 2026-11-08 ~11:10 UTC (18:10 WIB) deploy pertama,
  lalu **re-deploy ~11:35 UTC** — alasannya: `engine.js` di repo
  diperbarui Pekerja A 11:13 UTC (perbaikan zoomies, lihat bawah) SESUDAH
  deploy pertama, sehingga bundle live sempat memakai engine lama.
  Pekerja B menangkap drift ini lewat rebuild + perbandingan hash,
  me-redeploy dengan engine baru, dan menguji ulang live (smoke test
  §7.8). Pelajaran: JANGAN anggap repo diam selama deploy — verifikasi
  hash bundle vs repo sesudah deploy.
  `GET /` → `{"service":"squeekchain-leaderboard","version":4}`.
  Startup 7 ms (deploy pertama 8 ms).
- **Perbaikan engine 11:13 yang membuat re-deploy wajib:** `simulate()`
  kini mengabaikan zoomies di luar live/race (`zoomiesApplies` guard).
  Engine lama menerapkan `initialZoomies`/poll ke SEMUA mode — replay
  free palsu dengan poll rpm tinggi bisa mengklaim skor ×2 dan lolos
  verifikasi (cek sinkron Worker hanya memblokir `initialZoomies=true`,
  bukan poll di mode free). Ditutup oleh engine baru + dikunci tes
  regresi T20 (§7.8): sim free dengan poll rpm 120 == sim tanpa poll ==
  claim 138300.
- **Cron Trigger:** `* * * * *`, terpasang 2026-11-08T11:10:57Z,
  terkonfirmasi lewat `GET .../schedules` dan TERBUKTI memproses antrean
  (§7.8). Catatan: body PUT harus ARRAY `[{"cron": "* * * * *"}]` —
  objek polos `{"cron": ...}` ditolak 400 "Could not parse request body"
  (sudah diperbaiki di komentar `worker.js`).
- **Secret:** `SIGNING_KEY` sudah ada sejak v3 — TIDAK diputar, TIDAK
  dimasukkan ulang, TIDAK PERNAH diminta.

### 7.8 Hasil tes Worker v4

**Lokal — plumbing (stub engine mainan, /tmp saja): 31/31.** Bundle uji
memakai stub engine (chart 5 note, hash FNV — BUKAN logika game; hanya
untuk memvalidasi plumbing antrean/Cron/attestation/enforcement) + shim
D1 in-memory (node:sqlite) + kunci signing uji segar. Semua lolos: 202
pending → Cron → verified=1 + signature (recovery = signer uji); replay
diubah → rejected 422 (simulated score mismatch), tidak masuk board;
tanpa replay / practice / tanpa session / session tidak dikenal /
claim≠body → 422; race + golden valid → verified; golden index salah →
rejected; polls tidak urut / finish.t terlalu awal / lebih cepat dari
durasi lagu → 422; rate limit 10×422 lalu 429; board bersih sesudah
cleanup.

**Lokal — engine ASLI: 34/34.** Harness yang sama dengan `engine.js`
asli (chart nyata ~100–220 note): replay perfect free skor 66300 dan race
perfect+golden 191800 terverifikasi; **+3 tes regresi T20** untuk
perbaikan zoomies engine 11:13 (sim free dengan poll rpm 120 == sim tanpa
poll == claim 138300 → verified). **Cross-check chart 23/23:**
`buildChart` engine vs `makeAnthem` v39 ASLI (diekstrak verbatim dari
`script.js` v39) — 8 kombinasi genre/diff/seedKey/lanes/mirror ×
practice on/off; tiap note (`t`/`lane`/`midi`) identik persis, begitu juga
bpm/durasi/nama/kunci. `cyrb53`/`mulberry32` identik (100 draw).
Cross-check diulang sesudah engine 11:13 — tetap 23/23 (`buildChart`
tidak berubah, hanya `simulate` zoomies).

**Live — 3 uji wajib + tambahan (wallet sekali-pakai, 2026-11-08
~18:12–18:25 WIB).** Baseline: board free 1 baris (TEST 3000, verified 0,
wallet `0x372d…a1Db`), race 1 baris (66805, verified 0, wallet
`0x8853…cf9a`).

| # | Uji | Hasil |
|---|---|---|
| (1) | Replay asli (free, perfect, 221 note, skor **169800**, acc 100, maxCombo 221; session segar, wallStartMs di jendela session, submit sesudah durasi lagu 69,2 dtk) | **202 pending → Cron → verified=1**. Signature `0x3b8ce97bf806c166cb123bf6e1e47f2f1aee9099bc2a635d6e22307244f670ad1ccabc7f23186a006c761cf9567e29543c1172b870a3e43f1ba628c7940ec6811c`, nonce 1, deadline 1794137246. **Recovery independen = signer `0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3`** ✅ |
| (2) | Replay diubah (claim DAN body score dinaikkan +1000 → 146500) | **202 → Cron → rejected 422** `reason: "simulated score mismatch"`; tidak masuk board ✅ |
| (3) | Submit tanpa replay | **422** `"replay required"` ✅ |
| (4) | Race imperfect (skor 67160, acc 80,58, counts 84/42/0/13, golden valid `index 42 expected 42 ok:true`, polls + oppDistM konsisten) | Percobaan pertama **GAGAL — BUKAN bug Worker**: input sintetis uji tidak urut waktu (tap +60 ms pada chord note), Worker benar menolak 422 `"replay inputs not in time order"`. **Retest sesudah input diurutkan: 202 → Cron → verified=1**, signature `0xd68e28a55df47033d6543be886a4cbf0881f84c91b39054e1c6c6d4777fe8cc36c9110c8277e7e073db28bbdf19475baae35b0ae8dc0be98471a8feb52be94ff1c`, nonce 1, deadline 1794137666, **recovery = signer** ✅ |
| (5) | Duplikat replay (1) | **200 `duplicate:true`, verified:1, signature SAMA** ✅ |

**Smoke test pasca-redeploy (bundle baru, engine 11:13): PASS.**
Replay genuine free (170 note perfect, skor 123900, acc 100) → 202 →
verified=1, signature
`0x7b38206674ed5c94d5b7e417ac34c3e93b4c6f60667bbbd8f8cb45f75a9ba703144caadd4bf889d597826290b6d747d4afe694f3fdcd6b8d671ea6864833e8801b`,
nonce 1, deadline 1794137905, **recovery = signer**; board kembali bersih
(TEST 3000 saja) ✅.

**Pembersihan D1 — board kembali bersih.** Dihapus via D1 API (hanya
baris wallet uji `0x...e2e1`, `0x...e2e2`, `0x...e2e3`, `0x...e2e5` +
session uji): `scores`, `replays`, `nonces`, `submit_log`,
`verify_queue` (semua 0 untuk wallet uji), `sessions` (sessionId uji).
Verifikasi akhir: `GET /scores?mode=free` → 1 baris (TEST 3000,
verified 0); `GET /scores?mode=race` → 1 baris (66805, verified 0);
`verify_queue` 0 baris; `scores` 2 baris; `replays` 0 baris ✅.
(Catatan: `sessions` masih berisi 2 baris session expired milik pihak
lain — BUKAN dari uji ini, dibiarkan; prune malas Worker menghapusnya
pada `POST /session` berikutnya.)

### 7.9 Yang TIDAK dilakukan / masih terbuka (bagian Worker v4)

- **Push GitHub TIDAK dilakukan** — sesuai tugas. Yang diubah Pekerja B
  di folder v40: `worker.js` (v4), `migrate-v4.sql` (baru),
  `build-worker.sh` (baru), dan §7 dokumen ini. `engine.js`,
  `script.js`, `index.html` adalah hasil Pekerja A — tidak disentuh.
- **Submit dari client v40 asli (browser sungguhan) BELUM diuji
  end-to-end** — replay uji live di §7.8 dibangun mengikuti format v1
  persis dan diverifikasi engine yang sama dengan yang dipakai client,
  tapi satu run browser sungguhan tetap menjadi bukti terakhir (terutama
  flip zoomies race + golden di kondisi nyata). Smoke test browser tetap
  tugas parent.
- **Celah golden wall-clock** (§7.4, 4b) dan **kuantisasi 1 ms** — lihat
  §7.4; perbaikan butuh replay v2.
- **Throughput Cron**: 3 replay/menit (≈180/jam). Bila antrean menumpuk,
  naikkan `VERIFY_BATCH` (jaga budget CPU 10 ms); Cron sudah tiap menit,
  tidak bisa lebih rapat.
- **Artifact preview in-app** tidak diperbarui (bukan wewenang subagent
  ini) — seperti di v39.
- **TEST entry di board** (TEST 3000) tetap ada — keputusan hapus/tidak
  masih terbuka, JANGAN hapus tanpa pilihan eksplisit user.
