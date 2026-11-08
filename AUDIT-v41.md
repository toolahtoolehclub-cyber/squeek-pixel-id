# AUDIT-v41 — Toko Keju + Liga Mingguan (Batch 5, off-chain only)

Squeek Pixel ID v40.1 → v41. **Tidak ada kontrak on-chain, tidak ada SQK,
tidak ada transaksi Sepolia, tidak ada perubahan verifikasi.** Worker v4 →
v5 dan client v41 hanya menambah ekonomi Keju + liga mingguan di atas jalur
verifikasi yang sudah ada (replay v1 + EIP-712 + enforcement Cron — tidak
disentuh). Judgement window, tempo, dan formula skor tidak berubah
(`engine.js` byte-identik dengan v40.1).

## 1. Perubahan

### 1.1 Worker v5 — Toko Keju (D1 baru: `migrate-v5.sql`, 7 statement)
- **Kredit Keju HANYA saat replay terverifikasi** (`verifyOne`, di dalam
  batch atomik yang sama dengan upsert skor + signature): 100/lagu,
  +500 grade S/SS (`cheeseEarned(sim.grade)`), +50 misi harian (lagu
  terverifikasi pertama di hari Squeek, `squeekDayKey` = flip 12:00 UTC /
  19:00 WIB). Idempotent per `replay_hash` (partial UNIQUE index di
  `cheese_ledger`); misi harian unik per (wallet, hari). Tidak pernah
  dikredit di submit mentah — tidak bisa di-farm tanpa main sungguhan.
- **Misi harian didefinisikan di sini** (dokumen desain hanya menyebut
  "+50/misi harian" tanpa merinci misinya): misi = main 1 lagu
  terverifikasi per hari Squeek. Alasan: misi lain (streak/quest) belum
  ada di client; definisi ini sederhana, terverifikasi, dan tidak butuh
  state baru.
- **Kapsul** (`POST /cheese/pull`): 100 Keju/pull, RNG server-side
  (`crypto.getRandomValues`), raritas berbobot 70/22/7/1, pool = 8 item
  katalog (2 per raritas, note + frame), duplikat → kompensasi Keju
  (25/50/100/250). Deduct atomik (`UPDATE ... WHERE balance >= 100`).
- **Beli** (`POST /cheese/buy`): harga Keju saja, item `capsuleOnly`
  (legendary, harga 0) ditolak 400; deduct atomik; race beli bersamaan
  di-refund. **Equip** (`POST /cheese/equip`): harus dimiliki; satu
  batch mengosongkan slot lalu menyalakan satu item.
- **Katalog** (8 item, `CHEESE_CATALOG` di worker.js): note-mint 300,
  note-gold 800, note-void 1500, note-rainbow legendary (kapsul saja);
  frame-neon 300, frame-gold 800, frame-royal 1500, frame-rainbow
  legendary (kapsul saja). Harga mengikuti pola katalog SQK di Rancangan
  (5/10/15/20/50/100 SQK) yang dipetakan ke Keju 300/800/1500/kapsul —
  keputusan v41, bukan dari dokumen (dokumen tidak memberi harga Keju).
- **Liga mingguan** (`GET /league`): `league_scores` (wallet, week_start,
  best_score) ditulis di `verifyOne` HANYA untuk mode FREE; minggu mulai
  Senin 19:00 WIB (= Senin 12:00 UTC), top 30, `?week=` dinormalisasi ke
  Senin minggunya, `?wallet=` mengembalikan peringkat sendiri.
- Cron per menit tetap aktif (terverifikasi live). `GET /` → version 5.

### 1.2 Client — tab SHOP baru + liga mingguan di LEAGUE
- Tab **SHOP** (di antara LEAGUE dan ME; TABS kini 6): saldo Keju dari
  server (`GET /cheese`), katalog dari server (client tidak pernah
  hardcode katalog), tombol beli/pakai, kapsul 100 Keju/pull, pesan
  hasil. Saldo TIDAK pernah dihitung client — hanya dirender dari
  respons server.
- **Skin not terlihat di game**: `NOTE_SKINS` (mint/gold/void/rainbow)
  mewarnai hamster note lewat `noteColor(lane, th.notes, G.noteSkin)`;
  `G.noteSkin` di-snapshot dari skin yang di-equip saat `play()`.
- **Bingkai kartu hasil**: `applyResultFrame()` di `finish()` memberi
  class `frame-neon/gold/royal/rainbow` pada `#resultPanel` (CSS border +
  glow; rainbow = gradient border).
- **Liga mingguan di tab LEAGUE**: box baru (label minggu + tombol
  refresh + daftar top 30 + peringkat sendiri), fetch saat tab dibuka
  dan setelah submit terverifikasi.
- Setelah submit terverifikasi (poll maupun dedupe), client me-refresh
  saldo toko + liga mingguan (Keju dikredit server-side saat verifikasi,
  bukan saat submit). Submit mengirim `gameVersion: 'v41'`.
- Label v41: title, h2, footer, meta description, README.

### 1.3 Yang TIDAK diubah
- `engine.js` (chart/judge/simulate), judgement window, tempo, formula
  skor, format replay v1, `validateReplay`/`verifySimulated`/enforcement,
  EIP-712, signer, Cron, XP, storage key lama, 3 proofs Genesis.
- Tidak ada file Batch 4 / toko SQK / gacha yang disentuh.

## 2. Tes (TEST-v34-neo.js + TEST-motif.js)

- **1413/1413 lolos** (baseline v40.1: 1243/1243; +170 asersi baru),
  motif **11/11**. `node --check` lolos untuk script.js, worker.js,
  engine.js. 0 kata "BNB"/"Binance" di semua file situs.
- Fungsi murni Worker dieksekusi (bukan string-match): `cheeseEarned`
  (S/SS 600, lain 100), `squeekDayKey` (vektor batas 12:00 UTC, cocok
  dengan `squeekTodayStr` client), `weekStartMs`/`weekStartKey` (Senin
  18:59 WIB → minggu lalu; Senin 19:00 WIB → minggu baru; Sabtu → Senin
  yang sama; reset = +7 hari), `capsuleRarity` (batas 0.7/0.92/0.99 +
  tolak di luar [0,1)), `capsulePool`/`capsulePick` (isi pool, wrap
  indeks, tolak input buruk), `dupCompensation` (25/50/100/250),
  `catalogItem`, invarian katalog (8 item, 2/raritas, 2/slot, capsuleOnly
  = legendary harga 0, harga beli > 0).
- Fungsi client dieksekusi: `noteColor` (theme tanpa skin, gold lane 1,
  wrap lane 5, fallback skin tak dikenal), `shopSkin`/`saveShopSkin`
  (default kosong, round-trip `sqk41:skin`, tahan store korup).
- Wiring: endpoint v5 ada, kredit Keju + liga di `verifyOne` (mode FREE
  saja, `MAX` untuk best mingguan), deduct atomik, RNG server-side,
  migrasi v5 (4 tabel + 3 index), tab SHOP + liga mingguan, skin/frame
  di game, refresh setelah verified, client tidak menghitung saldo
  sendiri, CSS 4 frame + shop, README mendokumentasikan v41.
- Tiga tes lama disesuaikan (bukan dihapus): TABS kini 6 entri, meta
  description/title/README v41, `gameVersion: 'v41'`,
  `setTab` LEAGUE kini fetch board + liga mingguan.

## 3. Verifikasi live (curl, 8 Nov 2026 ~21:2x WIB)

- **D1**: 7 statement migrasi sukses; 4 tabel + 3 index terverifikasi
  (`cheese_balances`, `cheese_ledger`, `cheese_inventory`,
  `league_scores`, `idx_cheese_ledger_replay`,
  `idx_cheese_ledger_daily`, `idx_league_week`). Semantik SQL diuji
  langsung di D1 (wallet uji, lalu dibersihkan, sisa 0): upsert saldo
  mengakumulasi (100+50=150), `INSERT OR IGNORE` replay ganda ditolak
  (count tetap 1), upsert liga `MAX` (5000 bertahan setelah 3000).
- **Worker v5 live**: `GET /` → version 5. `GET /cheese` (tanpa wallet)
  → katalog 8 item. `GET /cheese?wallet=` → balance 0, items [].
  `GET /league` → `week_start 2026-11-02` (benar: 8 Nov 2026 = Minggu),
  count 0, `reset_at` = Senin 9 Nov 12:00 UTC (19:00 WIB). `GET /scores`
  tetap jalan, count 0 (board kosong seperti sebelumnya).
- **Loop toko end-to-end live** (wallet uji `0x00...dead`, saldo di-seed
  500 langsung di D1 untuk mensimulasikan hasil lagu terverifikasi,
  lalu dibersihkan): beli note-mint 300 → balance 200; beli lagi → 400
  already owned; equip → ok slot note; pull #1 → duplikat note-mint →
  +25 kompensasi, balance 125; pull #2 → item baru frame-gold (rare),
  balance 25; pull #3 → 402 not enough cheese; `GET /cheese` akhir:
  balance 25, note-mint equipped ✓. Setelah cleanup: balance 0,
  items [].
- **Error paths live**: pull tanpa saldo → 402; beli item tak dikenal
  → 400; beli capsule-only → 400; equip yang belum dimiliki → 400;
  wallet buruk → 400; `?week=bogus` → fallback minggu berjalan.
- **Cron**: schedule `* * * * *` masih aktif.
- **Catatan**: satu putaran tes pertama memakai alamat uji 42-hex
  (bukan 40) sehingga Worker menolaknya 400 — alamat uji yang benar
  adalah `0x000000000000000000000000000000000000dEaD`; tidak ada data
  produksi yang tersentuh (semua baris uji dihapus, diverifikasi 0 sisa).

## 4. Yang TIDAK sempat / masih terbuka

- **Smoke test browser** (main satu lagu penuh dari client asli →
  submit → verified → Keju masuk + liga terisi): TIDAK dilakukan —
  subagent ini tidak punya live browser. Jalur kredit Keju di
  `verifyOne` terverifikasi lewat tes unit + SQL live + loop toko live,
  tetapi rantai penuh client→replay→Cron→Keju belum dibuktikan dari
  browser. Tugas parent.
- **Artifact preview** (slug squeekchain-v26-fix): lihat §5.
- Folder stray `squeekchain-v40.1/` di repo sudah dibersihkan user
  (commit `778bdb0c`, 8 Nov 2026 13:54 UTC) — bukan lagi item terbuka.

## 5. Deploy + verifikasi live (site)

_(Diisi setelah push — lihat ADDENDUM di bawah.)_

---

## ADDENDUM — Deploy + verifikasi live (2026-11-08 ~21:2x–21:3x WIB)

### A1. Worker v5 deploy
- Migrasi D1 dulu (7 statement, `migrate-v5.sql`), lalu bundle esbuild
  152.338 byte → upload via `upload_worker.py`: `success: true`.
- `GET /` → `{ service: "squeekchain-leaderboard", version: 5 }`.
- Cron `* * * * *` masih aktif (terverifikasi via API).

### A2. Push GitHub
- Remote head SEBELUM push diverifikasi via CLI: `778bdb0c` (cleanup
  stray folder, 8 Nov 2026 13:54 UTC).
- Push (commit `c914432f2bedf2bc77bc92c115d05443ee9632e0`, approval
  disetujui): `--source-dir` = folder `squeekchain-v41`, path bare
  (`index.html`, `script.js`, `style.css`, `worker.js`, `README.md`,
  `TEST-v34-neo.js`, `build-worker.sh`, `migrate-v5.sql`,
  `AUDIT-v41.md`) → mendarat di root repo (pola v38–v40.1 yang benar,
  bukan subfolder).

### A3. Site live
- `GET https://squeekpixel.web.id/` → 200, `<title>SQUEEKCHAIN //
  v41</title>`, header `PIXEL ID // v41`.
- `script.js` live == lokal byte-per-byte: SHA-256
  `8a6fde1d789014c43b35f28a5e8e38eb600a835ace53a76dc99398ccbed5410f`.
- `worker.js` live == lokal:
  `067d6587b247e05d037794bc53000e470eb041cc30e0131d2acad76c6b7a2531`.
- Live `script.js` memuat `fetchShop`/`fetchLeagueWeekly`/`noteColor`/
  `gameVersion: 'v41'` (13 match); live `index.html` memuat tab SHOP;
  live `style.css` memuat frame.

### A4. 3 proofs Genesis utuh (live)
- Meta tag di HTML live: `squeekchain-project` content
  `05432539-b4e4-4f90-97b3-c258583905b7` (baris 8, byte-identical).
- Baris terakhir README raw GitHub:
  `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`.
- TXT DNS via Google DoH (`_squeekchain.squeekpixel.web.id`):
  `"squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9"`.

### A5. Yang masih terbuka
- Smoke test browser (satu lagu penuh + submit dari client asli, lihat
  Keju masuk setelah "TERVERIFIKASI ✓" + liga mingguan terisi) masih
  tugas parent — subagent ini tidak punya live browser. Verifikasi di
  atas via curl/Node + D1, bukan browser.
- Tidak ada submit uji ke board (tidak ada baris uji untuk dibersihkan);
  semua baris uji D1 sudah dihapus (0 sisa).
