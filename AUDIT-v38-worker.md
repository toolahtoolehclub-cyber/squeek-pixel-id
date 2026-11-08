# AUDIT v38 — Worker Fase 0 (Session + Plausibility + Rate Limit)

Tanggal: 2026-11-08 ~17:05–17:15 WIB (deploy 2026-11-08T10:00:36Z)
Pekerja: Worker Fase 0 (Batch 1)
File diubah: HANYA `worker.js` (271 baris, dulu 138 baris, v1).
Tidak disentuh: file lain di folder v38, Genesis listing/proofs, smart contract
(tidak ada deploy kontrak apa pun).

## 1. Perubahan worker.js (v1 → v2)

- `GET /` → `{ service: "squeekchain-leaderboard", version: 2 }`.
- `POST /session` (baru): terbitkan `{ sessionId, seed, nonce, expiresAt }`.
  `sessionId` = `crypto.randomUUID()`; `seed` = 1× uint32 dari
  `crypto.getRandomValues` (seed dari server, bukan dari client); `nonce` =
  16 byte acak hex; `expiresAt` = epoch ms, +30 menit. Disimpan ke D1
  `sessions` dengan `used=0`.
- `POST /scores` diperluas, perilaku lama dipertahankan:
  - Field baru (opsional): `sessionId`, `notes`, `taps`, `durationMs`.
  - Rate limit SEBELUM plausibility: hitung `submit_log` 1 jam terakhir per
    wallet (maks 10) dan per IP dari header `CF-Connecting-IP` (maks 30);
    bila lewat → `429 { error: "rate_limited" }`. Setiap percobaan dengan
    wallet valid dicatat ke `submit_log` (termasuk yang 400/429); baris
    >1 jam di-prune tiap POST /scores. Wallet tidak valid ditolak 400
    sebelum logging (tidak bisa dihitung per wallet).
  - Plausibility (hanya field yang dikirim yang dicek; gagal → 400, TIDAK
    disimpan): `score <= notes*1800+1000`; `taps <= notes+50`;
    `durationMs` dalam [30000, 300000]; `score` 1..5000000 (lama);
    `acc` 0..100.
  - Session (bila dikirim): harus ada di D1, belum expired, belum used.
    Bila valid → `used=1` (klaim atomik `UPDATE ... WHERE used=0`).
    Session tidak valid TIDAK menolak skor — hanya `verified=0`.
  - `verified=1` HANYA bila session valid DAN plausibility lolos; selain
    itu `verified=0`. Skor tetap disimpan bila mengalahkan best wallet+mode
    (perilaku lama), dengan kolom `verified` ikut ter-upsert.
  - Respons sukses kini menyertakan `verified`:
    `{ ok, improved, verified, wallet, mode, score }`.
- `GET /scores`: tiap baris kini menyertakan `verified` (0/1).
- `GET /rank`: tidak berubah.
- PERUBAHAN PERILAKU YANG DISENGAJA (sesuai spek tugas): v1 me-clamp `acc`
  ke 0..100; v2 menolak `acc` di luar 0..100 dengan 400
  (`"acc is not valid"`). Field `notes`/`taps`/`durationMs` yang dikirim
  tapi bukan angka juga ditolak 400.

## 2. Skema D1 baru (database `squeekchain-leaderboard`, uuid cd6920f3-…)

Diverifikasi via `SELECT sql FROM sqlite_master`:

- `scores` — kolom baru: `verified INTEGER NOT NULL DEFAULT 0`.
  Skor lama TIDAK dihapus/reset; keduanya jadi `verified=0`.
- `sessions (session_id TEXT PRIMARY KEY, seed INTEGER NOT NULL, nonce TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)`
- `submit_log (wallet TEXT NOT NULL, ip TEXT NOT NULL, ts INTEGER NOT NULL)`

## 3. Deploy

- Via `upload_worker.py squeekchain-leaderboard <worker.js v38> <d1-id>`.
- Hasil: `success: true`, `deployment_id: 16d76aed99224c759ac31a74a5c1c84c`,
  `modified_on: 2026-11-08T10:00:36.637027Z`, `compatibility_date: 2026-11-07`.

## 4. Hasil smoke test live

Catatan: tugas menyebut VM tidak bisa mengakses workers.dev langsung, tapi
faktanya `curl` langsung ke
`https://squeekchain-leaderboard.pancigoreng.workers.dev` berhasil
(HTTP 200). Semua smoke test di bawah memakai curl langsung; ini
verifikasi live sungguhan, bukan via API manajemen.

| # | Tes | Hasil |
|---|-----|-------|
| T1 | `GET /` | 200 `{"service":"squeekchain-leaderboard","version":2}` ✅ |
| T2 | `POST /session` | 200 `{"sessionId":"e20fa215-e020-435f-a980-f8c7812eac11","seed":4189039506,"nonce":"5d7f2ca23f7d439062cc632e0cccd9d6","expiresAt":1794133847697}` ✅ (+30 menit) |
| T3 | `POST /scores` TEST `0x372D…3a1Db` mode free score 100 (tanpa session) | 200 `{ok:true, improved:false, verified:0, score:100}` ✅ board tidak berubah |
| T3b | Sama + session T2 + notes 10, taps 10, durationMs 60000 | 200 `{ok:true, improved:false, verified:1}` ✅ session valid + plausibility lolos |
| T3c | Session T2 dipakai kedua kali | 200 `{ok:true, improved:false, verified:0}` ✅ single-use terbukti |
| T4 | score 9999999 | 400 `{"error":"score is not valid"}` ✅ |
| T5 | notes 10, taps 200 | 400 `{"error":"taps exceed notes + 50"}` ✅ |
| T6 | Rate limit: 11× POST wallet sekali-pakai `0x0000…dEaD`, semua plausibility-gagal (notes 10, taps 200) | 1–10 → 400, ke-11 → `429 {"error":"rate_limited"}` ✅ |

Insiden saat T6: percobaan pertama memakai alamat dead wallet salah ketik
(44 hex, bukan 40) sehingga 11× ditolak 400 `"wallet address is not valid"`
SEBELUM logging — tidak mengotori `submit_log` maupun board. Diulang dengan
alamat benar (`0x000000000000000000000000000000000000dEaD`, 40 hex) dan
hasilnya sesuai tabel di atas.

## 5. Status D1 setelah tes (SELECT langsung)

- `scores`: TEST free tetap **3000, verified 0** (`updated_at` lama tidak
  berubah — upsert 100 tidak mengalahkan best); race
  `0x8853…cf9a` tetap **66805, verified 0**. Tidak ada baris baru.
- Wallet sekali-pakai `0x0000…dEaD`: **0 baris** di `scores` ✅.
- `sessions`: 1 baris — session T2, `seed 4189039506`, `used=1` ✅.
- `submit_log`: TEST wallet 5 baris, dead wallet 11 baris (semua percobaan
  tercatat, termasuk yang gagal) ✅.
- `GET /scores?mode=free`: 1 baris, menyertakan `"verified":0` ✅.
- `GET /rank` TEST free: `rank 1, score 3000, total 1` ✅.

## 6. Kontrak koordinasi (untuk pekerja game — JANGAN diubah)

- `POST /session` → `{ sessionId, seed, nonce, expiresAt }`.
- `POST /scores` menerima
  `{ wallet, name, score, acc, mode, sessionId?, notes?, taps?, durationMs? }`.
- `verified=1` hanya bila session valid DAN plausibility lolos, selain itu 0.
- Rate limit 10/wallet/jam + 30/IP/jam → 429.
- `GET /scores` mengembalikan `verified` per baris.

## 7. Yang TIDAK sempat / TIDAK dilakukan + alasannya

- **Submit `verified=1` yang benar-benar mengalahkan best di board TIDAK
  diuji live** — butuh skor >3000 di wallet TEST free, yang akan mengubah
  board publik. Jalur upsert-nya sama dengan T3b (hanya nilai `verified`
  yang di-bind berbeda); pengujian itu ditahan supaya board tidak berubah.
- **Tidak ada prune otomatis untuk `sessions` kedaluwarsa** — baris session
  yang expired tapi tidak terpakai menumpuk di D1. `submit_log` di-prune
  tiap POST /scores, tapi `sessions` tidak. Butuh keputusan: prune di
  POST /session, cron, atau biarkan (volume kecil: 1 baris per run game).
- **Tidak ada pembersihan `submit_log` di luar prune 1 jam** — sesuai
  desain (rate limit jendela 1 jam).
- **Tidak ada perubahan sisi game (script.js/index.html)** — itu tugas
  pekerja game; worker hanya menyediakan kontrak di atas.
- **Tidak ada penghapusan entri TEST di leaderboard** — keputusan itu masih
  terbuka di tangan user (lihat MEMORY.md); worker tidak menghapus apa pun.
