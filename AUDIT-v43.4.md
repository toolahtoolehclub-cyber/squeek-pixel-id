# AUDIT v43.4 — Tampilan Wallet HANYA Bila Benar-Benar Terhubung (Profil + Toko + Peringkat)

Tanggal: 2026-11-09 ~21:11–21:50 WIB. Basis: v43.3 (repo head `78b3d337`).
Worker: TETAP v13 (tidak berubah, tidak di-deploy ulang).
Engine: TIDAK berubah (byte-identik v43.3).

## 1. Laporan user — dua permukaan, satu akar masalah

User melaporkan (21:11 WIB, lalu 21:13–21:14 WIB dengan screenshot) dua
inkonsistensi yang sama:

1. **Kartu profil "YOUR PIXEL SELF"** tampil padahal wallet DISCONNECTED /
   GUEST. User: "bikin malu ajh" — profilnya tampil di mode tamu.
2. **Toko (SQK + Keju)** tampil padahal wallet DISCONNECTED / GUEST:
   "SQK BALANCE: 972.00", "Skin Rare • OWNED ×1" + tombol [ EQUIP ] dan
   [ BUY ]; "🧀 BALANCE: 700", "Mint Notes • OWNED" + "Golden Notes •
   OWNED" + tombol [ EQUIP ] dan [ BUY ]. Tab PLAY bilang WALLET
   DISCONNECTED, tab SHOP dengan senang hati menampilkan saldo dan
   membiarkan equip. User: "tidak sejalan", buggy. User benar.

**Akar masalah (terverifikasi di kode v43.3):** semua tampilan ini membaca
alamat dari field manual / alamat yang DIINGAT (`localStorage
'sqk38:wallet'`, diisi otomatis saat halaman dibuka), BUKAN dari status
koneksi yang sebenarnya. `preview()` memanggil
`renderAvatarPreview(w)` dengan `w = $('walletInput').value.trim()`;
`renderAvatarPreview` menampilkan kartu bila `isAddr(w)`; `currentWallet()`
mengembalikan nilai field manual; `renderShop` / `renderSqkShop` /
`fetchShop` / `fetchSqkShop` memakai itu. `setConnected(addr)` — satu-satunya
choke point status koneksi — tidak pernah mengevaluasi ulang visibilitas
avatar, jadi disconnect pun kartunya tetap tampil.

## 2. Aturan baru (v43.4)

Satu helper baru, satu-satunya sumber kebenaran "benar-benar terhubung":

```js
function connectedWallet() { return (connectedAddr && isAddr(connectedAddr)) ? connectedAddr : null; }
```

Semua tampilan yang terikat wallet di-gate pada `connectedWallet()`:

- **Belum connect (`connectedAddr` null):** kartu profil TERSEMBUNYI;
  saldo SQK dan saldo Keju "—"; TIDAK ada penanda OWNED / EQUIPPED;
  TIDAK ada tombol EQUIP / UNEQUIP / BUY; kapsul Keju, commit kapsul
  SQK, dan resolve kapsul nonaktif; pity kosong; sorotan baris sendiri
  di board/liga hilang; teks "peringkatmu" kosong. Sebagai gantinya ada
  ajakan jelas "CONNECT A WALLET FIRST TO USE THE SHOP" /
  "CONNECT A WALLET FIRST TO USE THE SQK SHOP".
- **Sudah connect:** semuanya tampil persis seperti v43.3 (saldo,
  OWNED, EQUIP/BUY, kapsul, pity, sorotan baris, teks peringkat).
- **Katalog tetap tampil** (info publik): nama item, warna, HARGA,
  odds kapsul, pool, musim. Perbaikan kecil saat implementasi: harga
  Keju sebelumnya hanya ada di tombol BELI (jadi hilang saat belum
  connect, padahal komentar kode mengklaim "harga tetap tampil") — kini
  harga tampil di meta item saat belum connect; saat connect harga tetap
  di tombol BELI seperti v43.3 (perilaku connect TIDAK berubah).
- **TIDAK di-gate (sengaja):** progres lokal (ME: achievement, mastery,
  diary, champs, unlock) dan kunci level gameplay (lane/mirror/void) —
  itu progres HP sendiri dan permainan manual, bukan data server
  terikat wallet. User hanya mengeluh soal kartu profil dan toko.

## 3. Yang diubah di v43.4

### A. Profil (script.js)
- `renderAvatarPreview(w)`: tampil HANYA bila `connectedWallet()` valid;
  sembunyikan bila tidak, walau `w` alamat yang diingat/manual valid.
  Data profil (level/XP/streak/seed) tetap memakai `w` saat tampil.
- `setConnected(addr)`: setelah update `connectedAddr` + `updateConnectBtn()`,
  evaluasi ulang SEMUA tampilan terikat wallet (masing-masing dalam
  try/catch agar tidak pernah merusak alur restore WalletConnect):
  `renderAvatarPreview(connectedAddr)`, `renderShop()`, `renderSqkShop()`,
  `renderLb()`, `renderLeagueWeekly()`; saat connect, muat ulang data
  toko/peringkat untuk wallet yang baru terhubung (`fetchShop()`,
  `fetchSqkShop()`, `fetchLbRank()`, `fetchLeagueWeekly()`).

### B. Toko Keju (script.js)
- `renderShop`: saldo "—" bila belum connect; OWNED/EQUIP/UNEQUIP/BUY
  dan kapsul hanya bila `connectedWallet()`; ajakan connect di depan
  katalog; `capsuleBtn.disabled = !w`.
- `fetchShop`: tanpa wallet → ambil katalog saja (tanpa `?wallet=`),
  tidak membaca saldo/kepemilikan.
- `buyItem` / `pullCapsule` / `equipItem` / `unequipItem`: pakai
  `connectedWallet()`; tolak dengan `shopNeedWallet` bila belum connect.

### C. Toko SQK (script.js)
- `renderSqkShop`: saldo "—" bila belum connect; OWNED/EQUIPPED dan
  tombol hanya bila terhubung; ajakan connect; pity kosong; commit/
  resolve `disabled = !deployed || !w`; pool/musim/katalog tetap tampil.
- `fetchSqkShop`: bacaan saldo/pity/kepemilikan hanya bila terhubung.
- `buySqkItem` / `commitSqkCapsule` / `resolveSqkCapsule`: dari
  `txWallet()` → `connectedWallet()` (identik saat connect; gagal cepat
  dengan pesan jelas saat belum connect). Membeli tetap butuh wallet
  terhubung (permit + tx) dan tetap jalan saat connect.
- `equipSqkItem` / `unequipSqkItem`: pakai `connectedWallet()` (equip
  memang lokal saja, tapi per permintaan eksplisit user tombolnya
  disembunyikan saat belum connect demi konsistensi tampilan).

### D. Peringkat (script.js)
- `renderLb` / `renderLeagueWeekly`: sorot baris sendiri (`lb-me`) hanya
  via `connectedWallet()`; `fetchLbRank` mengosongkan teks peringkat saat
  belum connect; `fetchLeagueWeekly` tanpa parameter wallet saat belum
  connect; teks peringkat mingguan hanya bila terhubung.

### E. Versi
- index.html 4 tempat (meta description, `<title>`, header
  "PIXEL ID //", footer) v43.3 → v43.4; script.js
  `gameVersion: 'v43.4'`; README.md judul `# Squeekchain v43.4`
  (sempat terlewat di bump awal — ketahuan saat tes, diperbaiki).
- `txWallet()` kini tidak lagi dipakai siapa pun (definisi dibiarkan,
  satu baris, tidak berbahaya); semua pemakai lamanya sudah pindah ke
  `connectedWallet()`.

## 4. Tes — 2386 tes, 0 gagal

Suite penuh di folder v43.4 (semua `TEST-*.js` + `verify-icon-routes.js`):

| File | Hasil |
|---|---|
| TEST-v43.4.js (baru: Part C gate, 28 tes) | 66 passed, 0 failed |
| TEST-v43.4-submit.js | 34 passed, 0 failed |
| TEST-v43.3.js | 38 passed, 0 failed |
| TEST-v43.3-submit.js | 34 passed, 0 failed |
| TEST-v34-neo.js | 1813 passed, 0 failed |
| TEST-v42.5.js | 147 passed, 0 failed |
| TEST-v42.5.3-ghost.js | 27 lolos, 0 gagal |
| TEST-v42.5.4-capsule.js | 30 passed, 0 failed |
| TEST-v42.5.4-restore-ui.js | 28 lolos, 0 gagal |
| TEST-v43.js | 51 passed, 0 failed |
| TEST-v43.1.js | 36 passed, 0 failed |
| TEST-v43.2.js | 34 passed, 0 failed |
| TEST-v13-capsule-fallback.js | 28 passed, 0 failed |
| TEST-motif.js | 11 passed, 0 failed |
| verify-icon-routes.js | 9 passed, 0 failed |
| **TOTAL** | **2386 passed, 0 failed** |

**Tes Part C (baru, TEST-v43.4.js, `mkGateHarness` — fungsi render ASLI
diekstrak by-name, dijalankan di sandbox dengan mock DOM):**
- C1–C3 profil: belum connect + alamat diingat → kartu TERSEMBUNYI;
  sudah connect → TAMPIL; `setConnected(addr)` tampil →
  `setConnected(null)` sembunyi; connect memanggil ulang 4 fetch
  (toko/peringkat), disconnect tidak.
- C4–C5 toko Keju: belum connect → saldo "—" (bukan 700), TANPA OWNED /
  BELI / PAKAI, ada ajakan CONNECT + kapsul nonaktif, katalog (nama +
  harga) tetap tampil; sudah connect → saldo 700 + OWNED + PAKAI + BELI
  + kapsul aktif.
- C6–C7 toko SQK: belum connect → saldo "—" (bukan angka), TANPA OWNED /
  BELI / PAKAI, ajakan CONNECT + commit/resolve nonaktif + pity kosong,
  katalog + pool tetap tampil; sudah connect → saldo tampil + OWNED +
  PAKAI/LEPAS + BELI + commit/resolve aktif + pity tampil.
- C8–C9 peringkat: belum connect → board TIDAK menyorot baris sendiri
  (skor tetap tampil), liga mingguan TIDAK menyorot + TANPA teks
  peringkat; sudah connect → menyorot + teks peringkat tampil.
- 6 tes statis gate (helper ada, setConnected mengevaluasi ulang,
  toko Keju/SQK gated, peringkat gated, aksi beli/equip menolak).

**Yang sempat gagal saat pengerjaan (jujur — semua diperbaiki, bukan
disembunyikan):**
- Awalnya 6 gagal di TEST-v43.4.js: 2 perilaku + 4 statis. Penyebab:
  (a) harga Keju ternyata hanya ada di tombol BELI (tidak tampil saat
  belum connect) — DIPERBAIKI di kode (harga ke meta saat belum
  connect); (b) stub I18N harness kurang `sqkPoolTpl` (pool tampil
  literal "sqkPoolTpl") — DIPERBAIKI di harness; (c) 4 asersi statis
  ditulis dari ingatan, tidak cocok dengan kode asli — DIPERBAIKI agar
  cocok dengan kode (bukan sebaliknya).
- Suite penuh sempat gagal di 8 file lain: `ReferenceError:
  connectedWallet is not defined` di harness lama yang mengekstrak
  fungsi yang kini memanggil `connectedWallet()` (submit harness,
  renderLeagueWeekly, fetchShop, unequip, render toko, equipSqk).
  DIPERBAIKI dengan menambahkan stub `connectedWallet` ke tiap harness
  (mengembalikan ADDR untuk skenario connect, null untuk disconnect).
  Ini BUKAN bug di kode game — harness tesnya yang ketinggalan.
- Asersi versi (v43.3) di file tes lama harus naik ke v43.4 (konvensi:
  tes carried-over menegaskan versi SAAT INI). README sempat tertinggal
  di v43.3 — DIPERBAIKI. Path bundle TEST-v13 basi
  (`/tmp/v42.5.3-build`, sudah dibersihkan dari /tmp) — DIPERBAIKI ke
  `/tmp/v43-build` + bundle di-rebuild via `./build-worker.sh
  bundle-only` (442.865 byte).

## 5. Yang TIDAK berubah (verifikasi byte)

- `engine.js` byte-identik v43.3 (`cmp` bersih).
- `worker.js` byte-identik v43.3 — Worker TETAP v13, tidak di-deploy ulang.
- `style.css` byte-identik v43.3.
- `wc-provider.bundle.js` byte-identik v43.3.
- `index.html` hanya 4 tempat versi yang berubah; `README.md` hanya
  judul yang berubah.
- `script.js`: 129 baris berubah (hanya gate + komentar v43.4).
- 3 bukti Genesis UTUH dan tidak berubah (dicek di §6).

## 6. Bukti Genesis — UTUH (verifikasi sebelum deploy)

1. DNS TXT `_squeekchain` =
   `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9`
   — dicek via DNS sebelum deploy (lihat laporan deploy).
2. Meta di `index.html` head:
   `<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">`
   — ada, tidak berubah.
3. README baris terakhir:
   `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`
   — ada, tidak berubah (judul README naik ke v43.4, baris bukti tidak
   disentuh).

## 6b. Verifikasi LIVE (setelah deploy, 2026-11-09 ~21:41 WIB)

- GitHub head: `517fb56798b6e61c5a57eb4dc3043bd1bc56f3e6` (commit v43.4).
- Live site https://squeekpixel.web.id/ : `<title>SQUEEKCHAIN //
  v43.4</title>`, 4× "v43.4" di HTML (deploy Pages selesai ~21:41 WIB,
  ~3 menit setelah push).
- Live `script.js` byte-identik dengan `script.js` lokal v43.4
  (`cmp` bersih); `gameVersion: 'v43.4'` + `function connectedWallet()`
  ada di live.
- Live `engine.js` byte-identik v43.3; live `worker.js` byte-identik
  v43.3 (Worker tetap v13).
- 3 bukti Genesis di LIVE: (1) DNS TXT `_squeekchain` via Google DoH =
  `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9`;
  (2) meta tag di live `index.html` utuh; (3) baris terakhir live
  `README.md` = `squeekchain-project:
  05432539-b4e4-4f90-97b3-c258583905b7` + judul `# Squeekchain v43.4`.

## 7. Skenario user — penalaran (verifikasi live menyusul setelah deploy)

1. Halaman dibuka dengan alamat yang diingat (`sqk38:wallet`) tapi tanpa
   sesi WalletConnect live → kartu profil TERSEMBUNYI, wallet GUEST;
   toko menampilkan katalog + harga, saldo "—", tanpa OWNED/tombol.
2. User tap CONNECT, setujui di OKX → `setConnected(addr)` →
   kartu profil MUNCUL, toko menampilkan saldo/OWNED/tombol, peringkat
   menyorot baris sendiri.
3. User disconnect → `setConnected(null)` → kartu profil
   TERSEMBUNYI lagi, toko kembali ke mode "—" + ajakan connect.
   (Dibuktikan oleh tes C1–C9; verifikasi di HP user menyusul.)

## 8. Catatan / sisa

- `txWallet()` kini mati (tidak dipakai). Boleh dihapus di versi
  berikutnya; dibiarkan di v43.4 demi perubahan minimal.
- Verifikasi di HP user (buka situs, cek kartu/toko saat GUEST lalu
  setelah CONNECT) belum dilakukan — butuh browser user; tes otomatis
  di atas adalah bukti terkuat yang bisa dibuat dari sini.
- Investigasi submit GHOST race 16:09 WIB yang ditolak (bukan bagian
  v43.4) masih terbuka — lanjut terpisah.
