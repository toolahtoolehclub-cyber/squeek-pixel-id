# AUDIT v42.5 — Audit Fixes + GHOST Squeektoshi + Dream Seeds/Lullaby (Worker v10)

Tanggal: 2026-11-09 ~02:00 WIB. Status: **SELESAI DIBANGUN + SEMUA TES HIJAU, MENUNGGU "GO PUSH" — BELUM DI-DEPLOY** (tidak ada push GitHub, tidak ada deploy Worker, tidak ada perubahan Pages/artifact).

Rilis ini menutup SEMUA item audit independen v42.4 (P0–P3). Tidak ada perubahan gameplay, judgement window, tempo, rumus skor, katalog, harga, split, seasonEnd, atau Project ID. Kontrak tidak disentuh.

## Ringkasan tes

| Suite | Hasil |
|---|---|
| TEST-v34-neo.js | **1788/1788** (termasuk 28 tes statis v42.5 baru + 12 ID baru + perbaikan harness equip) |
| TEST-v42.5.js (baru) | **61/61** (GHOST pace, engine ghost, poll cross-check, validasi ghost, rate-limit v10, dreamReward, preview toko, wallet UX, Dream Seeds/Lullaby) |
| TEST-motif.js | **11/11** |
| `node --check` script.js / worker.js / engine.js | OK |
| esbuild Worker bundle-only | OK — 172.113 byte, berisi `version: 10` |
| WC bundle `wc-provider.bundle.js` | byte-identik dengan v42.4 (md5 `c155a420…`) — bukti eksekusi nyata v42.3 tetap berlaku |

## Item per item

### P0-1 — Worker v10 rate-limit (ROOT CAUSE insiden resolve 01:16 WIB)
**Bukti:** `/capsule-resolve` dan `/scores` berbagi `submit_log` (10/wallet/jam); keduanya INSERT baris SEBELUM cek limit, jadi percobaan yang ditolak menambah baris dan memperpanjang blokirnya sendiri. Wallet user tercatat 16 baris/jam terakhir (burst 9 submit 00:54–00:58 + resolve 01:16).
**Perbaikan (worker.js):**
- `rateLimitAllowed(env, table, wallet, ip, walletMax, ipMax)` — COUNT dulu, INSERT hanya bila lolos; 429 membawa `retryAfterSec` (detik sampai baris tertua keluar jendela).
- `/capsule-resolve` memakai tabel sendiri `resolve_log` — submit skor berkali-kali tidak bisa lagi memblokir resolve kapsul.
- `/scores` memakai helper yang sama; 429 membawa `retryAfterSec`.
- Client: `submitLb` dan `resolveSqkCapsule` menangani 429 spesifik — tampilkan "TERLALU SERING — COBA LAGI {jam}" (EN+ID), bukan "RESOLVE FAILED" generik. Bila `retryAfterSec` tidak ada, fallback "COBA LAGI BEBERAPA MENIT LAGI".
**Tes:** mock D1 di TEST-v42.5.js — 10 submit lolos, ke-11 ditolak + `retryAfterSec` 1–3600 + jumlah baris tetap 10 (percobaan ditolak TIDAK menambah baris); 10 submit tidak memblokir resolve (tabel terpisah); limit IP 30.
**Sisa:** tidak ada.

### P1-1 — Wallet UX (ROOT CAUSE keluhan user 01:19 WIB)
**Bukti:** `currentWallet()` membaca field teks; `from:` transaksi diisi dari field (script.js:2867,2978 v42.4). Edit field setelah connect → wallet menolak transaksi dengan error membingungkan. Tidak ada tombol DISCONNECT di halaman; alamat manual tersimpan tampil seolah-olah connect.
**Perbaikan (script.js + index.html + style.css):**
- `txWallet()` = `connectedAddr || currentWallet()`; dipakai `buySqkItem`, `commitSqkCapsule`, `resolveSqkCapsule`. Jalur read-only (`fetchSqkShop`, `equipSqkItem`) tetap memakai field (smoke test mengisi alamat Genesis manual untuk cek EQUIP read-only).
- `updateConnectBtn()` kini merender keadaan penuh: terhubung → kartu status hijau `walletStatus` (alamat terhubung + "Transaksi memakai alamat INI"), tombol `disconnectBtn` terlihat, field read-only, catatan MANUAL disembunyikan; belum terhubung → kartu + disconnect disembunyikan, field bisa diedit + label "MANUAL (bukan koneksi)".
- `disconnectWallet()` baru (WC: `provider.disconnect()`; injected: bersihkan state lokal) + tombol DISCONNECT sendiri.
- `sqkNoProvider` diperbaiki di 4 definisi (MSG.en/id + I18N.en/id): "TAP [ CONNECT WALLET ] TO CONNECT (WORKS WITH OKX, METAMASK AND OTHER WALLETS)" — tidak ada lagi "BUKA HALAMAN INI DI METAMASK".
- Restore gagal → `updateConnectBtn()` eksplisit di boot menampilkan BELUM TERHUBUNG; alamat lama tidak pernah tampil seolah connect.
- **Bug yang ditemukan tes (diperbaiki saat build):** `msg('modeLullaby')` dan `msg('lullabyInfo')` memanggil kunci yang hanya ada di I18N, bukan MSG — `msg()` akan menampilkan nama kuncinya mentah ke user. Kini keduanya ada di MSG (EN+ID); `modeLullaby` juga ditambahkan ke I18N sebagai label tombol.
**Tes:** harness wallet di TEST-v42.5.js (injected + WC + restore gagal): tidak terhubung → kartu/disconnect hidden, field editable; terhubung → kartu terlihat + alamat, disconnect terlihat, field readonly; disconnect → kembali ke CONNECT WALLET; restore gagal → tetap BELUM TERHUBUNG.
**Sisa:** tidak ada.

### P1-2 — Replay v2: session→wallet + poll cross-check (K17)
**Bukti:** poll log dipercaya apa adanya; poll palsu yang klaim ZOOMIES sepanjang lagu menggandakan skor (ZOOMIES = ×2). `worker.js:1843-1849` hanya punya cek wall-clock.
**Perbaikan (worker.js):**
- POST /session menyimpan wallet peminta ke `session_wallets` (lazy CREATE TABLE IF NOT EXISTS); POST /scores menolak bila binding ada dan wallet submit berbeda (`session wallet mismatch`, 422). Sesi legacy/GUEST tanpa binding tidak dicek (kompatibel mundur). **Batasan jujur:** client masih bisa meminta sesi tanpa wallet (GUEST) — binding mencegah pencurian/pakai-ulang sesi antar wallet, bukan anti-cheat yang kedap udara.
- `pollsContradictWheel(stats, wallStartMs, durationMs, polls)` — memakai `/v1/measurement/stats?range=7d` (bucket 30 menit, `workUnits`, `coverage`): bila SEMUA bucket yang menutupi jendela lagu ber-coverage `complete` dan `workUnits === "0"`, roda TERBUKTI tidak bergerak → poll yang klaim rpm > 0 = fabrikasi → verifyOne menolak ("polls contradict public wheel data"). Bucket hilang/partial/null → SKIP (fail open, tidak pernah menolak atas data yang hilang). Fetch stats SEKALI per cron run (di `processVerifyQueue`), bukan per baris; gagal fetch → skip.
- Ghost race tidak kena: poll ghost menunjukkan rpm 0 (tidak ada klaim live yang bisa dibantah); bila hamster bangun di tengah lagu, bucket menunjukkan work > 0 → tidak ada kontradiksi.
**Tes:** TEST-v42.5.js — ZOOMIES palsu di jendela yang terbukti diam → kontradiksi; gerakan asli (workUnits 500) → tidak; partial/null/hilang → fail open; tanpa poll rpm>0 → tidak.
**Sisa:** validasi golden wall-clock penuh (replay v2 lengkap) masih terbuka — cross-check ini menutup serangan poll palsu, bukan semua bentuk replay yang dipalsukan. Dilaporkan sebagai "sisa", bukan disembunyikan.

### P1-3 — GHOST Squeektoshi
**Bukti:** `raceOppDist()` (v42.4) return 0 saat hamster tidur/offline — balapan malam = menang gratis, membosankan. User: "saya mau dia tidak tidur biar seru".
**Perbaikan (script.js + engine.js + worker.js):**
- Pace dari data NYATA 7 hari: `/v1/measurement/stats?range=7d`, rata-rata work unit per bucket 30 menit jam 10:00–14:00 WIB (03:00–07:00 UTC). 1 work unit ≈ 0,878 m (jarak seumur hidup 25.202.990 mm / 28.705 work unit). Rata-rata siang ~1075 work/30 mnt → **~0,52 m/s**; default 0,5 m/s; cache localStorage `sqk42:ghostPace` 24 jam.
- `raceOppDist()`: ghost → `pace × songTime()`; bila liveSnapshot menunjukkan RPM > 0 di tengah lagu → kembali ke live (SATU ARAH saja, tidak pernah kembali ke ghost dalam satu lagu — jarak tidak lompat mundur).
- Label jujur di mana-mana: `raceGhostLine` ("GHOST PACE: {pace} m/s — REAL 7-DAY DAYTIME AVERAGE (SIMULATION, NOT LIVE DATA)"), `petLine` ("SQUEEKTOSHI IS ASLEEP — RACING HIS GHOST (SIMULATION)"), tag `(GHOST — SIMULATION)` di HUD lawan + panel hasil + kartu. Tidak pernah pura-pura live.
- Replay header: `ghost` + `ghostPaceMs` (keadaan AKHIR, dikoreksi di `finish()` bila hamster bangun di tengah lagu). Worker: validasi header (ghost hanya di race, pace 0–1,0 m/s) + `checkOppDist` cabang ghost (oppDistM ≈ pace × finish.t ± 2 m). Engine `deriveOppDistM` cabang ghost (pace × finish.t; parameter `finishT` baru).
- Menang lawan ghost tetap +50 XP (simulasi yang jujur, dilabeli).
**Tes:** `ghostPaceFromStats` — 1075 work → 0,524 m/s; bucket malam/partial diabaikan; nol semua → null. Engine — ghost 0,5 × 61 dtk = 30,5 m, `oppDistMMatch` true; jalur live dari poll tidak berubah. Worker — ghost cocok → null; mismatch → error; pace 2,0 → error; replay ghost minimal VALID; ghost di luar race → ditolak; replay v42.4 tanpa field ghost tetap VALID.
**Sisa:** tidak ada. Catatan: hamster asli tetap tidak bisa dibangunkan — ghost adalah solusinya, sesuai keputusan.

### P1-4 — Kesan pertama
Tagline `<p class="tagline" data-i18n="tagline">Your high score depends on a hamster.</p>` di bawah header (EN + ID "Skormu tergantung pada seekor hamster."). Tes: teks EN di HTML, ID di I18N.

### P1-5 — Visual toko
`skinPreviewHtml(skinId, slot)` + `capsulePreviewHtml()`: skin not = 4 dot warna palet skin itu; frame = mini panel berbingkai dengan class frame itu; kapsul = 4 chip rarity. Dipakai di `renderShop` (Keju, 8 item) dan `renderSqkShop` (SQK, 6 item) + preview kapsul di kedua toko (`capsulePreview`, `sqkCapsulePreview`). Tanpa aset gambar baru (CSS/canvas saja). Tes: preview SQK rare mengandung #3b82f6 (4 dot); frame-sqk mengandung `pv-frame frame-sqk`; skin tak dikenal → kosong; kapsul mengandung 4 chip. Harness equip v42.4 diperbaiki: `renderSqkShop` kini butuh NOTE_SKINS + kedua helper di scope ekstraksi.

### P2-1 — Loading toko
Teks awal `sqkShopSoon` di index.html: "SQK SHOP COMING SOON" → "LOADING…". Pesan coming-soon tetap ada di MSG (`sqkShopSoon`) untuk kasus toko belum di-deploy. Tes lama yang menegaskan teks lama di HTML diperbarui.

### P2-2 — Dream Seeds + Lullaby (Rencana §1.4, K15)
- **Dream Seeds:** tanam di malam hari (19:00–06:00 WIB, zona waktu perangkat) ATAU saat hamster tidur (liveSnapshot rpm 0/offline); satu per malam Squeek; disiram dengan memainkan Lullaby (maks. 2 tahap); panen via Worker POST /dream/harvest → 25 + 25×tahap, maks. 75 Keju; satu panen per (wallet, malam) ditegakkan server oleh `dream_harvests` PRIMARY KEY + indeks UNIQUE ledger `idx_cheese_ledger_dream`. State lokal `sqk42:dream` {plantedAt, stage, harvested}.
- **Lullaby:** mode baru di modeRow (`?lullaby=1` juga didukung); selalu synth/easy, tempo 60% (practice); seedKey `LULLABY-<hari Squeek>`; +50 XP flat; skor TIDAK PERNAH disubmit (blok client `lbLullaby` + Worker menolak practice); menyiram Dream Seed bila ditanam malam ini.
- **Batasan jujur (didokumentasikan, bukan disembunyikan):** `plantedAt` diklaim client — reward sengaja kecil (maks. 75 Keju ≈ satu lagu) dan satu-per-malam ditegakkan server. Jendela gagal kecil: bila guard `dream_harvests` berhasil tapi batch kredit gagal (D1 error), retry mengembalikan 409 dan kredit hanya bisa diperbaiki manual.
**Tes:** harness Dream Seeds di TEST-v42.5.js — tanam saat hamster tidur → stage 0; tanam 2× → ALREADY; siram 1→2→0 (maks.); panen tahap 2 → POST /dream/harvest + harvested; panen 2× → NO SEED; panen tahap 0 → NOT READY; Lullaby box tampil + info bangun/tidur; seedKey `LULLABY-<hari>`.

### P2-3 — Verifikasi mentok 90 detik
`VERIFY_POLL_MAX_TRIES` 9 → 12 (~120 detik, Cron per menit bisa melewati 90 detik). `lastVerifyHash`/`lastVerifyStatus` disimpan; `recheckVerifyOnLeague()` mengecek ulang status saat tab LEAGUE dibuka (bila belum verified). Tes: pollVerify offline 12 tries lalu unknown.

### P2-6 — GENERATE CARD pindah
Dari bawah RETRY ke bawah SUBMIT, class `btn-secondary btn-small`. Tes: urutan RETRY < SUBMIT < GENERATE CARD + class kecil. (Catatan: tombol ini sebelumnya rawan ketuk nyasar karena duduk di sebelah SUBMIT.)

### P3-1 — Hapus retry fail-soft
Baris `if (!r.ok && r.status === 400 && lastResult.replay) r = await postScores(bodyBase);` dihapus dari `submitLb`. Worker menolak tanpa-replay dengan 422 — retry itu tidak pernah berhasil dan hanya membakar 1 baris rate-limit. Tes: baris itu tidak ada di script.js.

### P2-5 — Analitik ringan (K12)
POST /analytics {event} dengan allowlist ketat (visit, play, mode_free, mode_daily, mode_live, mode_race, mode_boss, mode_lullaby, shop_open, submit). Worker menyimpan `analytics_daily (day_key, event, n)` — hitungan saja, TANPA wallet, TANPA IP. Client: visit 1×/sesi, play + mode saat game mulai, shop_open saat tab SHOP, submit saat submit berhasil. Fire-and-forget (gagal = diam).

### P3-2 — Minify script.js
**DILEWATI (keputusan sadar).** Pengecekan diff artifact membandingkan JS artifact vs repo (v42.4: style+engine byte-identik, JS berbeda tepat 3 baris: duelLink + overlayUrl + jalur bundle WC). Minify akan membuat diff itu tidak bermakna dan patch 3 baris lebih sulit. Tidak ada minify di rilis ini.

## Perubahan file (vs v42.4)

| File | v42.4 → v42.5 | Isi perubahan |
|---|---|---|
| script.js | 3389 → 3671 baris | txWallet, wallet UX, GHOST, preview toko, Dream Seeds/Lullaby, verify 12, 429, fail-soft dihapus, analitik, gameVersion v42.5 |
| worker.js | 1977 → 2174 baris | Worker v10: rateLimitAllowed, resolve_log, session_wallets, pollsContradictWheel, ghost, /dream/harvest, /analytics |
| engine.js | 355 → 362 baris | deriveOppDistM cabang ghost (param finishT) |
| index.html | 412 → 433 baris | tagline, walletStatus/disconnect/manual-note, lullabyBox, dreamBox, raceGhostLine, capsule previews, LOADING…, GENERATE CARD pindah |
| style.css | 599 → 633 baris | .tagline, .wallet-status, .shop-preview/.pv-dot/.pv-frame/.pv-cap, #dreamBox/#lullabyBox, .btn-small |
| TEST-v34-neo.js | — | versi v42.5, 12 ID baru, 28 tes statis v42.5, harness equip diperbaiki, tes lama diperbarui (poll 12, setTab, endGame, coming-soon) |
| TEST-v42.5.js | baru, 410 baris | 61 tes fungsional |
| migrate-v10.sql | baru | resolve_log, session_wallets, dream_harvests, idx_cheese_ledger_dream, analytics_daily |
| build-worker.sh | — | jalur v42.5 + Worker v10 |
| README.md | — | judul v42.5 + entri changelog |
| wc-provider.bundle.js | tidak berubah | byte-identik dengan v42.4 |

## Bukti Genesis (dicek ulang sebelum lapor — ketiganya UTUH)
1. DNS TXT `_squeekchain` = `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9` (dicek live via DNS-over-HTTPS, 2026-11-08 18:59 UTC).
2. Meta tag `<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">` di index.html.
3. Baris terakhir README: `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`.

## Yang DITAHAN (belum dilakukan — menunggu "GO PUSH")
- Push ke GitHub (repo head tetap `35723fa6` / v42.4).
- Deploy Worker v10 (Worker v9 masih live). **Catatan deploy:** jalankan `migrate-v10.sql` via cf_api.py SEBELUM deploy Worker v10 (meski Worker membuat tabel secara lazy, migrasi adalah catatan resmi + jaring pengaman).
- Update Pages / artifact preview (artifact masih v42.4).

## Sisa yang diketahui (untuk batch berikutnya, bukan blocker)
1. Validasi golden wall-clock penuh (replay v2 lengkap) masih terbuka — cross-check poll v42.5 menutup serangan poll palsu, bukan semua bentuk replay yang dipalsukan.
2. Session→wallet binding bukan anti-cheat kedap udara (client bisa meminta sesi GUEST tanpa wallet).
3. Jendela gagal kecil di /dream/harvest (guard berhasil, batch kredit gagal → retry 409, kredit manual).
4. Keju +500 grade S/SS belum pernah teramati di tes mana pun (belum ada run grade S).
5. Nama item SQK 2 ("Efek Epic") dan 5 ("Golden Wheel") masih samar untuk skin not (minor, bukan blocker).
6. Touch-tap di layar sentuh HP user belum pernah diverifikasi langsung (hanya mouse di smoke test).
7. `toCardBtn` kini kecil di bawah SUBMIT — tetap perlu dicek di smoke test browser apakah masih rawan ketuk nyasar.
