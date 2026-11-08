# AUDIT-v40.1 — Verified badge (display-only patch)

Squeek Pixel ID v40 → v40.1. Patch kecil: client menampilkan status verifikasi
setelah submit. **Tidak ada perubahan gameplay, judgement window, tempo,
formula skor, storage key, XP, format replay v1, logika submit, enforcement,
atau Worker.** Worker v4 tidak disentuh.

## 1. Masalah (smoke test browser v40, 8 Nov 2026 18:38–18:43 WIB)

Worker v4 memverifikasi replay secara ASYNC (Cron per menit): POST /scores
mengembalikan 202 pending tanpa signature, dan verifikasi selesai ~1 menit
kemudian. Client v40 hanya menampilkan "SKOR TERKIRIM — REKORMU TETAP." —
pemain tidak bisa melihat status verified-nya di layar, padahal skor itu
akhirnya verified=1 di server (dicek di D1: verification_status='verified',
scores.verified=1).

## 2. Perubahan

### 2.1 Panel hasil — poll GET /verify setelah submit
- `submitLb()`: bila respons berisi signature (dedupe — replay yang sama sudah
  terverifikasi sebelumnya), perilaku v39 dipertahankan ("TERVERIFIKASI ✓ •
  <hash8> • 0x<sig8>").
- Bila respons 202 pending + replayHash, client memanggil `pollVerify(hash,
  showStatus)`: poll `GET /verify?replayHash=…` tiap 10 detik, maks 9 kali
  (~90 detik).
  - pending → "SKOR TERKIRIM — … • MENUNGGU VERIFIKASI…"
  - verified → "… • TERVERIFIKASI ✓ • <hash8> • 0x<sig8>", lalu board
    di-refresh (`fetchLb`) supaya barisnya muncul.
  - rejected → "VERIFIKASI DITOLAK — SKOR TIDAK MASUK BOARD." (menggantikan
    teks kirim — skor yang ditolak memang tidak masuk board).
  - poll gagal/offline sampai habis → "… • STATUS VERIFIKASI BELUM
    DIKETAHUI — CEK TAB LEAGUE." (netral: bukan error, tidak klaim verified).
- `pollVerify` hanya memanggil `onStatus` dua kali: 'pending' di awal, lalu
  SATU status terminal ('verified' | 'rejected' | 'unknown'). Tick
  intermediate diam — network blip sesaat tidak membalik pesan ke unknown
  selagi percobaan tersisa.
- Submit baru membatalkan poll lama (`stopVerifyPoll()` di awal `submitLb()`
  dan di `resetLbSubmit()`).

### 2.2 Board LEAGUE — tanda ✓ pada baris verified
- `renderLb()`: baris dengan `verified=1` (field sudah dikembalikan
  GET /scores) menampilkan `<span class="lb-verified">✓</span>` hijau
  (CSS baru `.lb-verified`). Baris verified=0 tidak berubah.

### 2.3 Kenapa GET /verify, bukan GET /rank
Tugas awal menyebut poll GET /rank, tetapi `/rank` mengembalikan
`{wallet, mode, rank, score, total}` — **tidak ada field verified** — jadi
tidak bisa mendeteksi verifikasi. `GET /verify?replayHash=…` adalah endpoint
yang memang dibuat untuk ini (202 pending / 200 verified + signature /
422 rejected / 404 not found). Maksud tugas (poll sampai terverifikasi,
maks ~90 detik, interval 10 detik) dipertahankan; hanya endpoint-nya yang
dibetulkan. Dicatat di sini supaya tidak dikira menyimpang diam-diam.

### 2.4 Label versi v40.1
- `index.html`: `<title>SQUEEKCHAIN // v40.1</title>`, meta description
  `SQUEEKCHAIN v40.1 — …`, `<h2>PIXEL ID // v40.1</h2>`, footer `• v40.1 •`.
- `README.md`: judul `# Squeekchain v40.1`, entri changelog `**v40.1**`,
  daftar audit + `AUDIT-v40.1.md`.
- `script.js`: submit mengirim `gameVersion: 'v40.1'`.
- 3 proofs Genesis TIDAK disentuh: meta tag `squeekchain-project`
  `05432539-b4e4-4f90-97b3-c258583905b7` (baris 8 index.html, byte-identical),
  baris terakhir README, TXT DNS. Verifikasi live di §5.

## 3. Tes (TEST-v34-neo.js + TEST-motif.js)

- 4 MSG key baru (`lbVerifying`, `lbVerified`, `lbVerifyRejected`,
  `lbVerifyUnknown`) — ada di kedua bahasa (EN + ID), dicek per bahasa.
- `verifyPollOutcome` (pure, dieksekusi): 202 → pending (dengan/tanpa body),
  200 + verified → verified, 200 lain → unknown, 422 → rejected,
  404/500 → unknown.
- `verifyBadgeText` (pure, dieksekusi): verified dengan/tanpa hash+sig,
  pending, rejected, unknown — semua string persis.
- `pollVerify` (async, fetch + timer di-mock, dieksekusi):
  - verified setelah 2× pending → statuses [pending, verified], signature
    terbawa, timer berhenti, /verify dipanggil 3× dengan hash yang benar.
  - rejected di tick pertama → [pending, rejected], berhenti, 1 call.
  - offline total → 9 tries lalu [pending, unknown], tidak pernah verified.
  - pollVerify kedua membatalkan timer poll pertama; hanya hash baru yang
    di-poll.
- String/wiring: renderLb ✓ hanya untuk verified, CSS `.lb-verified` ada,
  interval 10 s / maks 9, submitLb memanggil pollVerify pada submit pending,
  stopVerifyPoll di submit baru + reset.

## 4. Yang TIDAK dilakukan

- Tidak ada perubahan Worker (v4 tetap), tidak ada perubahan enforcement.
- Tidak ada perubahan pada alur submit selain tampilan status.
- Smoke test browser (satu lagu penuh + submit dari client asli, lihat badge
  muncul) masih tugas parent — subagent ini tidak punya live browser.

## 5. Verifikasi live

_(Diisi setelah push — lihat ADDENDUM di bawah.)_

---

## ADDENDUM — Deploy + verifikasi live (2026-11-08 ~19:35–19:45 WIB)

### A1. Push GitHub (dengan satu kesalahan yang diperbaiki)
- Remote head SEBELUM push diverifikasi via CLI: `00615611` (addendum v40).
- Push pertama (commit `a466337e`) SALAH SASARAN: `--source-dir` menunjuk
  folder `files/` dengan path `squeekchain-v40.1/index.html`, sehingga file
  mendarat di subfolder `squeekchain-v40.1/` di repo, bukan di root — root
  `index.html`/`script.js` tetap v40 (terbukti via raw.githubusercontent.com).
  Kesalahan ini tertangkap karena verifikasi live, bukan karena asumsi.
- Push perbaikan (commit `c066f191992850d459d526797b25b4cfd336b73a`):
  `--source-dir` = folder `squeekchain-v40.1`, path bare
  (`index.html`, `script.js`, `style.css`, `README.md`, `AUDIT-v40.1.md`,
  `TEST-v34-neo.js`) → mendarat di root repo seperti pola v38–v40.
- Sisa kesalahan: folder stray `squeekchain-v40.1/` kini ada di repo (dari
  push pertama) — tidak memengaruhi site (Pages hanya membaca root), tetapi
  perlu dibersihkan di kesempatan berikut (push-files tidak bisa delete).

### A2. Site live
- `GET https://squeekpixel.web.id/` → 200, `<title>SQUEEKCHAIN //
  v40.1</title>`, header `PIXEL ID // v40.1`.
- `script.js` live == lokal byte-per-byte: SHA-256
  `ff4716afe786dfbd7a78085a1187374073b3885094dbc85f7f30ce7d6fa6bd63`.
- `engine.js` live == lokal (tidak berubah di v40.1):
  `33399e1a2601b8d264365d4388efd00094a495e073163484c4cd16d57dafaded`.

### A3. 3 proofs Genesis utuh
- Meta tag di HTML live: `squeekchain-project` content
  `05432539-b4e4-4f90-97b3-c258583905b7` (baris 8, byte-identical).
- Baris terakhir README raw GitHub:
  `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`.
- TXT DNS via Google DoH (`_squeekchain.squeekpixel.web.id`):
  `"squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9"`.

### A4. Yang masih terbuka
- Smoke test browser (satu lagu penuh + submit dari client asli, lihat badge
  "MENUNGGU VERIFIKASI…" lalu "TERVERIFIKASI ✓") masih tugas parent.
  Verifikasi di atas via curl/Node, bukan browser.
- Worker v4 tidak disentuh (tidak perlu — endpoint /verify sudah ada sejak
  v40); tidak ada submit uji ke board (tidak ada baris uji untuk dibersihkan).
