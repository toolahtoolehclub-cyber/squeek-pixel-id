# AUDIT-v41.1 — Tanda ✓ Verified di Baris Liga Mingguan (display-only patch)

Squeek Pixel ID v41 → v41.1. **Tidak ada kontrak on-chain, tidak ada SQK,
tidak ada transaksi Sepolia, tidak ada perubahan verifikasi, tidak ada
perubahan ekonomi Keju.** Worker v5 → v6 dan client v41.1 hanya menambah
field `verified` di respons `GET /league` dan tanda ✓ di baris liga
mingguan — inkonsistensi tampilan yang ditemukan smoke test browser v41
(2026-11-08 21:29–21:34 WIB): baris yang sama menampilkan ✓ di board
global tapi tidak di liga mingguan. Judgement window, tempo, dan formula
skor tidak berubah (`engine.js` byte-identik dengan v41).

## 1. Perubahan

### 1.1 Worker v6 — field `verified` di GET /league
- `GET /league` sekarang mengembalikan `verified` (0/1) per baris skor
  dan di objek `you`, lewat `LEFT JOIN scores s ON s.wallet = l.wallet
  AND s.mode = 'free'` + `COALESCE(s.verified, 0)`. Alasan join (bukan
  kolom baru): baris liga HANYA pernah ditulis dari `verifyOne` (jalur
  terverifikasi), jadi nilainya 1 untuk setiap baris liga yang nyata;
  join hanya menjaga tampilan kalau baris `scores` sewaktu-waktu tidak
  sependapat. Tidak ada migrasi D1 — tidak ada tabel yang diubah.
- Tidak disentuh: `verifyOne`, `validateReplay`, `verifySimulated`,
  enforcement, replay, cheese (kredit/ledger/kapsul/beli/equip),
  reset mingguan, rate limit, sesi. `GET /` → version 6.

### 1.2 Client — ✓ di baris liga mingguan
- `renderLeagueWeekly()` sekarang menampilkan `<span
  class="lb-verified">✓</span>` + title "TERVERIFIKASI ✓" untuk baris
  `verified=1`, persis pola board global (v40.1, baris 2177); baris
  `verified=0` tetap tanpa tanda. Class CSS `.lb-verified` sudah ada
  sejak v40.1 — tidak ada CSS baru.
- Submit mengirim `gameVersion: 'v41.1'`; judul/header/footer situs
  v41.1.

### 1.3 Yang TIDAK diubah
- Verifikasi replay + EIP-712 + enforcement Cron, ekonomi Keju
  (harga/katalog/kapsul/misi), reset liga Senin 19:00 WIB, `engine.js`,
  Batch 4 / SQK / gacha, listing Genesis, 3 proofs Genesis.

## 2. Tes (TEST-v34-neo.js + TEST-motif.js)

- **1426/1426 lolos** (baseline v41: 1413/1413; +13 asersi baru v41.1)
  + motif **11/11**; `node --check` lolos untuk script.js, engine.js,
  dan worker.js (parse check).
- Baru di seksi 15e: string checks (join + mapping `verified` di
  `/league` dan `you`, version 6, jalur verifikasi utuh, `gameVersion:
  'v41.1'`, judul v41.1, README v41.1) + tes fungsional yang menjalankan
  `renderLeagueWeekly()` ASLI (diekstrak dari script.js, `new Function`
  + DOM palsu + mock respons `/league`): baris verified=1 → tepat satu
  `✓` (`lb-verified`); baris verified=0 → tanpa `✓`; skor + nama tetap
  tampil; board kosong → pesan kosong.
- 4 tes lama yang mematok versi diperbarui ke v41.1 (judul tab,
  gameVersion submit, worker root version, ORDER BY liga yang kini
  memakai alias `l.`). Selama pengembangan: 1 kegagalan tes fungsional
  karena `new Function` tidak melihat closure (`els`) — diperbaiki
  dengan meneruskan `els` sebagai parameter; 1 kegagalan karena fake
  I18N tidak punya `leagueWeeklyEmpty` (kode asli memakai
  `I18N[lang].leagueWeeklyEmpty` langsung, bukan `msg()`) — diperbaiki
  di fake. Keduanya bug tes, bukan bug produk.

## 3. Verifikasi live (curl + D1, 8 Nov 2026 ~21:4x WIB)

- `GET /` → `{"service":"squeekchain-leaderboard","version":6}`.
- `GET /league` (board kosong) → `count: 0`, bentuk respons tidak
  berubah selain tambahan field.
- Bukti ujung-ke-ujung field `verified` dengan baris uji sementara
  (wallet uji dead, lalu DIHAPUS — board kembali 0):
  - `scores.verified=1` → `/league` mengembalikan `"verified":1` di
    baris skor DAN di `you`.
  - `scores.verified=0` → `/league` mengembalikan `"verified":0` di
    keduanya.
  - Baris uji dihapus dari `scores` + `league_scores`; `GET /league`
    dan `GET /scores?mode=free` kembali `count: 0`.
- Deploy Worker: `build-worker.sh` (esbuild bundle — upload mentah
  gagal 400 karena `@noble/curves` tidak ikut ter-upload; bundle
  152.631 byte berisi perubahan v6, deploy sukses, `startup_time_ms`
  7). Pelajaran: JANGAN upload worker.js mentah — selalu lewat
  `build-worker.sh`.

## 4. Yang TIDAK sempat / masih terbuka

- Smoke test browser v41.1 (main 1 lagu + submit + lihat ✓ di liga
  mingguan dari client asli): tidak bisa dari subagent — perlu parent.
- Update artifact preview (slug `squeekchain-v26-fix`): tidak bisa dari
  subagent (tool artifact tidak tersedia di sesi ini) — perlu parent.
- Baris liga mingguan kini menampilkan ✓; tidak ada perubahan lain yang
  tertunda untuk patch ini.

## ADDENDUM — Deploy + verifikasi live (2026-11-08 ~21:4x WIB)

### A1. Worker v6 deploy
- Deploy via `build-worker.sh` (esbuild bundle 152.631 byte, `startup_time_ms`
  7, `success: true`). Upload mentah gagal 400 (`No such module
  "@noble/curves/secp256k1.js"`) — bundle adalah satu-satunya jalur.
- `GET /` → `{"service":"squeekchain-leaderboard","version":6}`.
- `GET /league` field `verified` terbukti dua arah dengan baris uji
  sementara (lalu dihapus): verified=1 → `"verified":1` (baris + `you`);
  verified=0 → `"verified":0` (keduanya). Board kembali `count: 0`.

### A2. Push GitHub
- Commit `b9733090` (11 file, source-dir = folder v41.1, tanpa folder
  stray di repo). Remote head sebelum push `430b0221`; kartu
  persetujuan disetujui langsung (tidak ada timeout).
- Raw GitHub terverifikasi: index.html v41.1, script.js
  `gameVersion: 'v41.1'`, 2x `lb-verified`, SHA-256 cocok dengan lokal.

### A3. Site live
- `https://squeekpixel.web.id` menampilkan `SQUEEKCHAIN // v41.1`.
  Catatan: sesaat setelah push situs masih v41 (cache/build GitHub
  Pages) — setelah ~3 menit berubah ke v41.1; script.js live ==
  lokal byte-for-byte (SHA-256
  `98a3f6ce402d38a8c28f2910f0029550e848cc646ce1c0afc34d94eeb9479b89`).

### A4. 3 proofs Genesis utuh (live)
- Meta tag di HTML live: `squeekchain-project` content
  `05432539-b4e4-4f90-97b3-c258583905b7` (byte-identical).
- Baris terakhir README raw GitHub:
  `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`.
- TXT DNS via Google DoH (`_squeekchain.squeekpixel.web.id`):
  `"squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9"`.

### A5. Yang masih terbuka
- Smoke test browser v41.1 (main 1 lagu + submit + lihat ✓ di liga
  mingguan dari client asli) masih tugas parent.
- Update artifact preview (slug `squeekchain-v26-fix`) tidak bisa dari
  subagent (tool artifact tidak tersedia di sesi ini) — perlu parent.
- Worker v6 tidak disentuh lagi setelah deploy; tidak ada submit uji
  ke board (tidak ada baris uji untuk dibersihkan).
