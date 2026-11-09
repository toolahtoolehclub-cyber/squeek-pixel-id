# AUDIT-v42.5.4 — Restore WalletConnect + perbaikan bug kapsul kritis

## Bagian 1 — Restore WalletConnect: status terlihat + tombol nonaktif selama restore

## Masalah (laporan user, 08:32 WIB 9 Nov 2026, 2 screenshot)
User membuka https://squeekpixel.web.id/ (v42.5.3) dan langsung melihat
tombol `[ CONNECT WALLET ]` + alamatnya sudah terisi, padahal OKX
(DApp Terhubung) menunjukkan "Squeek Pixel ID" **MASIH connect** — dan
ikon hamster kini tampil benar di OKX (perbaikan ikon v42.5.1 berhasil).
User bingung: kenapa situs bilang belum connect, kenapa harus connect lagi,
dan kenapa alamatnya sudah ada di kolom (padahal ia tidak pernah paste).

Penjelasan (sudah disampaikan parent): alamat di kolom itu dari
localStorage `sqk38:wallet` — diingat, bukan koneksi (by design, ada label
MANUAL). OKX menyimpan sesi di pihaknya, tapi situs di Chrome harus
menghidupkan lagi sesi itu tiap kali halaman dibuka: unduh bundle WC
2,1 MB dulu (di koneksi user ~3–12 K/s bisa 1–3 menit), baru `enable()`.
Selama restore berjalan, tombol masih menunjukkan CONNECT WALLET, jadi
user mengira restore gagal padahal mungkin masih jalan. Alasan gagal
restore (bundle-timeout / no-accounts / enable-rejected) sudah ditampilkan
v42.5.2 sebagai teks kecil — user tidak menyadarinya.

## Perbaikan (client saja; Worker tetap v13, engine.js TIDAK berubah)
Logika restore v42.5.2 **TIDAK diubah**: `enable()` bila `p.session` ada,
tunggu bundle 60 dtk, preload bila kunci `wc@2:` ada, `showQrModal:false`.
Yang berubah hanya UI di sekitarnya:

1. **Status restore TERLIHAT.** Begitu `restoreWalletConnectSession()`
   mulai (kunci `wc@2:` ada), `setWcRestoreNote('restoring')` menampilkan
   satu baris status di area kartu wallet: `MENGHUBUNGKAN KEMBALI KE
   WALLET…` / `RECONNECTING TO YOUR WALLET…` (i18n EN+ID, kunci baru
   `wcRestoring`), gaya `.restoring` (cyan, 13px bold, berbordir — sama
   bobotnya dengan `.wallet-status`), dan tombol CONNECT WALLET
   **dinonaktifkan** selama restore berjalan (supaya user tidak mengetuk
   connect di tengah restore dan membuat sesi ganda). Berhasil → TERHUBUNG
   (sudah ada, via `setConnected`). Gagal → alasan tampil jelas (poin 2).
2. **Alasan gagal DITAMPILKAN JELAS.** `#wcRestoreNote` kini 13px bold
   berbordir dengan kelas `.failed` (kuning), bukan lagi teks 11px
   opacity .75. Teks template TIDAK berubah
   (`WC RESTORE GAGAL: {reason} — KETUK [ CONNECT WALLET ] UNTUK
   MENGHUBUNGKAN LAGI.` / EN) — hanya tampilannya. Kode alasan tetap
   (bundle-timeout / no-accounts / enable-rejected); `no-session-key`
   dicatat tapi tidak ditampilkan (itu keadaan normal belum-pernah-connect).
3. **Status tidak pernah menempel.** `restoreWalletConnectSession()`
   membungkus isi restore dalam `try/finally`: bila body berakhir tanpa
   alasan akhir (throw tak terduga), finally membersihkan `'restoring'`
   (lalu outer catch melaporkan `bundle-timeout`). `setTab()` tidak
   menyentuh elemen/alasan restore — `say('')` hanya membersihkan
   `#message`, jadi pindah tab tidak bisa membuat status menempel maupun
   menghidupkannya kembali; status mencerminkan keadaan restore yang
   sebenarnya, bukan tab.

## Detail implementasi
- `setWcRestoreNote(reason)`: keadaan baru `'restoring'` (tampilkan +
  kelas `restoring` + teks `msg('wcRestoring')`); kegagalan (kelas
  `failed`); `null`/`no-session-key` (sembunyikan). Juga menonaktifkan
  tombol connect saat `'restoring'` dan mengaktifkannya kembali saat
  alasan gagal — lewat `$('connectBtn')` langsung dengan null-check,
  supaya harness tes lama (yang `$`-nya hanya mengenal `wcRestoreNote`)
  tetap jalan.
- `updateConnectBtn()`: cabang baru — bila `wcRestoreReason ===
  'restoring'`, tombol nonaktif (teks tetap label connect). Guard
  `typeof wcRestoreReason !== 'undefined'` supaya harness yang mengekstrak
  fungsi ini tanpa mendeklarasikan variabel itu tetap jalan.
- `style.css`: `#wcRestoreNote` 13px bold berbordir; `.restoring` cyan,
  `.failed` kuning. HTML tidak berubah (elemen sudah ada sejak v42.5.2).
- `build-worker.sh` menunjuk folder v42.5.4 + Worker v13 (tidak ada deploy
  Worker di rilis ini; worker.js tidak berubah).

## Tes
- Baru `TEST-v42.5.4-restore-ui.js`: **28/28** — status reconnecting
  terlihat + tombol nonaktif selama restore (bundle lambat) lalu TERHUBUNG;
  sukses via passive read; gagal tiap alasan (enable-rejected,
  bundle-timeout, no-accounts) → alasan jelas + tombol aktif lagi +
  status tidak menempel; tanpa kunci sesi → note tersembunyi + tombol
  biasa; `init()` melempar → finally membersihkan, bundle-timeout tampil;
  i18n EN+ID; statis (status + finally + CSS + HTML + setTab tidak
  menyentuh note + gameVersion v42.5.4).
- Suite lama hijau: TEST-v34-neo.js **1815/1815** (termasuk perbaikan
  1 asersi usang yang sudah gagal di v42.5.3: `build-worker.sh` kini
  benar-benar menunjuk Worker v13), TEST-v42.5.js **144/144**,
  TEST-v42.5.3-ghost.js **27/27**, TEST-motif.js **11/11**,
  verify-icon-routes.js **9/9**. Total **2034**.
- `node --check` bersih untuk script.js / engine.js / worker.js.
- Asersi versi lama yang diperbarui ke v42.5.4: judul + gameVersion di
  TEST-v34-neo.js (5) dan TEST-v42.5.js (2, termasuk label salah
  'gameVersion v42.5.2' yang nilainya sudah v42.5.3).

## Bagian 2 — BUG KAPSUL KRITIS (prioritas di atas Bagian 1; commit kedua di v42.5.4)

### Masalah (laporan user, ~08:38 WIB 9 Nov 2026)
User commit kapsul pull #1 (targetRound 712) lalu tap RESOLVE → OKX
menampilkan "Eksekusi kontrak pihak ketiga error", gas "--", tombol
Konfirmasi nonaktif. Parent membuktikan via simulasi eth_call dari wallet
user ke shop `0x43f568AcfaDcee4333785c9F26596719ED0B02fb`:
`resolveCapsule(1, dataHash 0xe5e50f…, deadline, signature Worker fresh)`
→ `0x` (SUKSES, tidak revert); `resolveCapsule(712, …)` → revert
`PullNotFound(712)` (data `0xf7545117…02c8`). Jadi transaksi user memakai
pullId=712, bukan 1. **2 SQK AMAN** (tidak ada transaksi yang masuk; OKX
memblokir; tidak ada gas terbuang).

### ROOT CAUSE 1 — parsing log commit (commitSqkCapsule)
Event `CapsuleCommitted(address indexed player, uint256 indexed pullId,
uint256 targetRound)` — player DAN pullId KEDUANYA indexed, jadi DATA log
hanya berisi `[targetRound]`. Kode lama membaca `words[0]` sebagai pullId
→ mendapat targetRound (712), menimpa nilai benar dari `nextPullId` (1),
lalu menyimpan `{pullId: 712, …}` ke localStorage `sqk42:capsule`.
Komentar lama "Non-indexed: [player, pullId, targetRound]" SALAH.
**Perbaikan:** helper baru `sqkPullIdFromCommitLog(log, fallback)` —
pullId dari `topics[2]` (indexed pullId); bila topics < 3, fallback ke
nextPull; null bila log bukan CapsuleCommitted. `commitSqkCapsule()`
memakainya menggantikan loop inline lama.

### ROOT CAUSE 2 — parsing hasil resolve (resolveSqkCapsule)
Event `CapsuleResolved(address indexed player, uint256 indexed pullId,
uint256 targetRound, bytes32 dataHash, uint8 rarity, uint256 itemId,
bool duplicate, uint256 kejuCompensation)` — DATA hanya 6 kata
`[targetRound, dataHash, rarity, itemId, duplicate, kejuCompensation]`.
Kode lama mensyaratkan `words.length >= 7` (SELALU salah → result null →
tampil `sqkResolveFail` walau transaksi SUKSES di chain, dan kompensasi
Keju duplikat tidak pernah dikirim) dan indeksnya off-by-one
(rarity=words[3], itemId=words[4], dst). **Perbaikan:** helper baru
`sqkResultFromResolveLog(log)` — syarat `>= 6`; rarity=words[2],
itemId=words[3], duplicate=words[4], kejuCompensation=words[5];
`resolveSqkCapsule()` memakainya menggantikan loop inline lama.

### ROOT CAUSE 3 — self-healing (WAJIB, supaya pullId user yang sudah rusak sembuh otomatis)
`resolveSqkCapsule()` kini, SEBELUM memanggil Worker / mengirim
transaksi, memanggil `sqkHealPendingCapsule(w, pending)` yang memverifikasi
pull tersimpan on-chain via getter publik `pulls(uint256)` →
`(player, targetRound, resolved)`. Selector ditambahkan ke `SQK_SEL`:
`pulls: '0x7a9dfa7e'` = keccak256("pulls(uint256)")[:4] — **diverifikasi
live** terhadap shop sebelum ditulis: `pulls(1)` → player
`0x88538a82143065664232422e2dec4309038fcf9a`, targetRound `0x2c8` = 712,
resolved `false` (pull user masih pending — persis keadaan yang harus
disembuhkan). Bila pull tersimpan salah (player==0 / milik wallet lain /
sudah resolved), pindai pull 1..nextPullId-1 (paling baru dulu, maks 50)
dan pakai pull milik wallet yang belum resolved dan targetRound-nya cocok
dengan yang tersimpan (fallback: pull milik wallet yang belum resolved
dan paling baru); simpan perbaikannya ke localStorage
(`sqkSavePendingCapsule`) lalu lanjutkan resolve seperti biasa. Bila
tidak ada pull yang cocok, kembalikan null → pemanggil menampilkan
`sqkNoPending` dan **TIDAK mengirim transaksi yang pasti revert**.
Bila pembacaan on-chain gagal (RPC mati), kembalikan pending apa adanya —
jalur tx akan gagal dengan aman sendiri (`eth_sendTransaction` melempar)
dan user bisa coba lagi saat koneksi pulih. Perbandingan alamat
case-insensitive (provider bisa mengembalikan alamat checksum).

### Tes (baru `TEST-v42.5.4-capsule.js`: 30/30)
- Parsing log commit sungguhan (topics[2]=1, data=[712]) → pullId=1
  (bukan 712); **regresi: logika lama (words[0]) pada log yang sama →
  712** (bug terbukti); log topik lain → null; topics<3 → fallback.
- Parsing log CapsuleResolved sungguhan (6 kata: ronde 712, dataHash
  0xe5e50f…, rarity 1, itemId 102, duplicate 1, keju 50) → rarity rare,
  itemId 102, duplicate true, keju 50; varian common (101, bukan
  duplikat, keju 0) benar; **regresi: syarat lama >=7 pada log 6 kata →
  false** (result lama selalu null); **regresi indeks lama: words[3]
  sebagai rarity → 'common' (salah), words[4] sebagai itemId → 1
  (salah)**; log topik lain / data < 6 kata → null.
- Self-healing — **kasus user persis**: stored pullId 712 + nextPullId 2
  + pulls(1)=(wallet,712,false) → pullId 1, targetRound tetap 712,
  txHash dipertahankan, localStorage diperbaiki ke pullId 1.
- Self-healing — stored pull benar → dikembalikan apa adanya tanpa tulis
  ulang; tidak ada pull cocok (milik wallet lain) → null; stored pull
  sudah resolved + tidak ada lain → null; fallback targetRound tidak
  cocok → pull terbaru belum resolved (pullId 2, ronde 800) +
  localStorage diperbaiki; RPC mati → pending dikembalikan apa adanya;
  alamat case-insensitive.
- Statis: `resolveSqkCapsule` memanggil healer SEBELUM `/capsule-resolve`
  dan memakai pullId hasil heal; `commitSqkCapsule` memakai helper
  (bukan words[0] di kode); `SQK_SEL.pulls = 0x7a9dfa7e`.
- Suite lama tetap hijau (total baru **2064**: 1815 + 144 + 27 + 28 +
  11 + 9 + 30 kapsul baru). `node --check` bersih. Worker tetap v13,
  engine.js TIDAK berubah.

## Verifikasi live (dilakukan setelah push head 089bfd7e, 9 Nov 2026 ~09:05 WIB)
- Judul live `SQUEEKCHAIN // v42.5.4`, `gameVersion: 'v42.5.4'` ✓.
- Worker GET / → `{"service":"squeekchain-leaderboard","version":13}` —
  TIDAK berubah ✓. `/icon.png` + `/og.png` 200 ✓.
- `script.js` live mengandung perbaikan kapsul (7 match:
  `sqkHealPendingCapsule`, `pulls: '0x7a9dfa7e'`,
  `sqkPullIdFromCommitLog`, `sqkResultFromResolveLog`) ✓.
- 3 bukti Genesis utuh: meta `05432539-b4e4-4f90-97b3-c258583905b7` ✓,
  README baris terakhir sama ✓, DNS TXT `_squeekchain` =
  `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9`
  ✓ (dicek via Google DNS-over-HTTPS; resolver lokal VM mengembalikan
  kosong — masalah resolver, bukan record).
- Board D1 tidak berubah: `scores` tetap 1 baris — wallet Genesis,
  mode race, 28280, verified=1 ✓.
- Selector `pulls` diverifikasi live SEBELUM ditulis: `pulls(1)` →
  player `0x8853…cf9a`, targetRound 712, resolved false (pull user masih
  pending — keadaan yang harus disembuhkan self-healing).

## Cara user menguji
1. **Restore wallet** — Buka https://squeekpixel.web.id/ (refresh bila
   sudah terbuka): kartu wallet harus menampilkan **"MENGHUBUNGKAN
   KEMBALI KE WALLET…"** dengan tombol CONNECT WALLET yang tidak bisa
   diketuk selama beberapa detik, lalu berubah menjadi **TERHUBUNG**
   (bila sesi OKX masih valid) atau satu baris alasan gagal yang jelas
   (bila restore gagal — laporkan alasan persisnya: bundle-timeout /
   no-accounts / enable-rejected).
2. **RESOLVE KAPSUL (yang paling penting)** — Buka game → tab SHOP →
   tekan **[ RESOLVE KAPSUL ]** → setujui di OKX. Kapsul harus terbuka
   dan hasilnya tampil benar (mis. "KAPSUL: #102 (rare) ✓" atau hasil
   sebenarnya), BUKAN "Eksekusi kontrak pihak ketiga error" dan BUKAN
   "RESOLVE GAGAL". Bila hasilnya duplikat, kompensasi Keju harus
   masuk. (Perbaikan self-healing bekerja otomatis: pullId 712 yang
   rusak di HP user diperbaiki sendiri menjadi 1 sebelum transaksi
   dikirim — user tidak perlu menghapus apa pun.)
