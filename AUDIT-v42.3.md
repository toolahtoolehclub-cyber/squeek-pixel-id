# AUDIT-v42.3 — WalletConnect FIX (vendored bundle + lazy-load)

## Ringkasan
v42.2 gagal di fitur utamanya: CONNECT WALLET dari Chrome tanpa wallet tidak
membuka modal, hanya pesan `wcLoadFail`. Root cause-nya BUKAN di kode
connect (logika `wcGetProvider`/`connectWalletConnect` benar), melainkan di
file UMD CDN yang dimuat `index.html`: `@walletconnect/ethereum-provider`
2.26.0 `dist/index.umd.js` BUKAN standalone. v42.3 menggantinya dengan
bundle esbuild VENDORED (`wc-provider.bundle.js`, semua dependensi ikut
ter-bundle), lazy-loaded hanya saat CONNECT WALLET ditekan dari browser
tanpa wallet. Tidak ada lagi ketergantungan runtime ke unpkg/jsdelivr/esm.sh
untuk WalletConnect.

## 1. Root cause v42.2 (ditemukan parent, dikonfirmasi di sini)
File UMD `https://unpkg.com/@walletconnect/ethereum-provider@2.26.0/dist/index.umd.js`
punya tiga cabang: CommonJS (`require('bs58'), require('viem'), ...`),
AMD, dan global. Cabang global-nya memanggil factory dengan
`gt.bs58, gt.viem, gt.vanilla, gt.utils$1, gt.lit, gt.decorators_js,
gt.ifDefined_js, gt.QRCodeUtil, gt.ref_js, gt.staticHtml_js, gt.classMap_js,
gt.Big` — semuanya `undefined` kalau file dimuat sendirian. Factory memakai
decorator lit saat definisi class, jadi throw saat evaluasi SEBELUM baris
akhir `gt.EthereumProvider=YB` tercapai. Akibatnya `window.EthereumProvider`
tetap `undefined` dan `wcGetProvider()` mengembalikan null →
`wcLoadFail`. Tag `<script>` itu TIDAK AKAN PERNAH jalan sendirian.
Pelajaran yang dicatat: verifikasi "file ada + berisi `gt.EthereumProvider`"
TIDAK cukup — verifikasi harus load + eksekusi nyata.

## 2. Perbaikan v42.3 — bundle sendiri (vendored)
- Build di direktori sementara `~/wc-build-tmp` (BUKAN di repo):
  `npm install @walletconnect/ethereum-provider@2.26.0 esbuild@0.28.2`,
  entry `import { EthereumProvider } from '@walletconnect/ethereum-provider';
  window.EthereumProvider = EthereumProvider;`, lalu
  `esbuild entry.js --bundle --format=iife --platform=browser --minify
  --define:process.env.NODE_ENV='"production"' --outfile=wc-provider.bundle.js`.
- Hasil: `wc-provider.bundle.js`, **2.108.792 byte (~2,0 MB)**, IIFE mandiri,
  semua dependensi ter-bundle (viem, lit, bs58, valtio, qrcode, big.js).
  `node --check` lolos. File disimpan di folder v42.3 (sejajar index.html).
- `index.html`: tag script unpkg DIHAPUS (hanya komentar penjelasan yang
  tersisa). Tidak ada lagi referensi CDN WalletConnect di halaman.
- Catatan build: `/tmp` adalah tmpfs 512 MB dan sempat penuh saat `npm
  install` pertama (419 MB) — build dipindah ke `~/wc-build-tmp` (disk home
  148 GB kosong). Direktori build sementara dihapus setelah selesai.

## 3. Lazy-load (wcLoadBundle)
- Bundle JANGAN dimuat saat halaman dibuka — 2 MB hanya untuk pemain yang
  menekan CONNECT WALLET tanpa injected wallet. `wcGetProvider()` sekarang:
  bila `window.EthereumProvider` undefined → `await wcLoadBundle()` yang
  menyuntikkan `<script src="wc-provider.bundle.js">` secara dinamis
  (deduped via satu Promise; watchdog 15 detik; `onerror` → false).
  Gagal load → null → pesan `wcLoadFail` yang sudah ada (fail-soft).
- Pengecualian yang disengaja: `restoreWalletConnectSession()` (saat load,
  hanya bila ada kunci `wc@2:` di localStorage, yaitu pengguna WC yang
  kembali) juga memakai `wcGetProvider()` sehingga bisa memuat bundle —
  tapi TIDAK PERNAH untuk pemain biasa tanpa sesi WC. Semangat lazy-load
  (jangan bebani semua pemain) terpenuhi.
- Perbaikan kecil: `setTab()` kini memanggil `say('')` di awal, jadi pesan
  status/error (mis. `wcLoadFail`) hilang saat pindah tab.

## 4. BUKTI verifikasi eksekusi bundle (WAJIB — bukan grep)
Metode: bundle disuntikkan sebagai `<script>` sungguhan ke window jsdom
(jsdom 26, `runScripts: 'dangerously'`, URL `https://squeekpixel.web.id/`),
lalu `EthereumProvider.init` dipanggil dengan Project ID asli. Skrip uji:
`~/wc-build-tmp/verify-bundle.js` (disimpan di direktori build sementara;
dua stub ditambahkan karena jsdom tidak punya `TextEncoder`/`TextDecoder`
di window — API yang PASTI ada di browser sungguhan, jadi stub itu hanya
menambal kekurangan jsdom, bukan bundle).

Output nyata (2026-11-09 ~00:20 WIB, exit 0):
```
script injected: OK (no throw on eval)
typeof window.EthereumProvider: function
init: OK, provider object: true
typeof p.request: function
typeof p.connect: function
typeof p.disconnect: function
p.accounts: []
RESULT: PASS
```
Artinya: bundle mengevaluasi tanpa throw, `window.EthereumProvider`
terbentuk, dan `init({projectId: '1f186dd…', chains: [11155111],
showQrModal: false, rpcMap, metadata})` mengembalikan provider yang
berfungsi. (Chromium headless langsung TIDAK bisa dipakai di VM ini:
binary `/opt/meta-chromium/chrome` menolak start — "Hatch WebGL domain
policy is required for browser startup" — browser hanya lewat layanan
browser task; pembukaan modal `connect()` dibuktikan di smoke test
browser, bukan di jsdom.) Dua kegagalan perantara selama verifikasi,
keduanya artefak harness BUKAN bundle: (a) `window.eval` di jsdom 26
tidak mengekspos `window` sebagai global — dialihkan ke injeksi
`<script>` (cara browser yang sesungguhnya); (b) `TextEncoder is not
defined` di window jsdom — ditambal dengan `TextEncoder` Node.

## 5. Pertanyaan Kartu ID — TIDAK ADA jalur auto-open (dicek di kode)
Smoke test v42.2 melaporkan dialog Kartu ID ("SQUEEK CITIZEN") terbuka
otomatis saat lagu selesai. Grep lengkap: satu-satunya kode yang membuka
`#cardOverlay` adalah `openCard()`, dan pemanggilnya hanya empat:
definisi `openCard` sendiri, `bindClick('cardBarOpen', ...)` (membuka
kembali kartu yang di-minimize — klik eksplisit), `generateCard()` line
1631 (dipanggil hanya dari `genBtn` dan `toCardBtn` — klik eksplisit),
dan `bindClick('resultCardBtn', ...)` (tombol eksplisit di panel hasil).
`finish()` TIDAK memanggil `openCard`/`generateCard` sama sekali
(0 kemunculan di badan `finish()`). Kesimpulan: TIDAK ADA jalur
auto-open — laporan smoke test adalah klik nyasar agen (sama seperti
kesimpulan v40.1). TIDAK ADA perubahan kode untuk ini. (Teks placeholder
tautan duel + pembulatan ACC 12.67% vs 12.7% sudah dipastikan BUKAN bug —
tidak disentuh.)

## 6. Tes
- `TEST-v34-neo.js`: **1602/1602, 0 gagal** (baseline v42.2 1597/1597;
  +7 asersi baru v42.3, −2 asersi tag UMD yang dihapus = +5).
  Asersi baru: tidak ada CDN WalletConnect di HTML; bundle vendored ada
  (>1 MB, berisi `EthereumProvider`, tanpa referensi unpkg); `wcLoadBundle`
  ada; lazy-load via injeksi script (bukan tag saat load); `wcGetProvider`
  memanggil `await wcLoadBundle()`; `setTab` membersihkan `say('')`;
  dialog Kartu ID tanpa jalur auto-open (tepat 4 pemanggil `openCard(`).
- `TEST-motif.js`: **11/11**.
- `node --check`: `script.js`, `engine.js`, `wc-provider.bundle.js` — semua OK.
- Yang TIDAK berubah: judgement windows, tempo, formula skor, engine.js,
  verifikasi replay/EIP-712/enforcement/Keju/liga, harga katalog, split
  70/30, seasonEnd, alamat toko, Project ID.

## 7. Smoke test browser (TODO saat audit ini ditulis — diisi setelah jalan)
- Chrome biasa TANPA wallet → CONNECT WALLET → modal WalletConnect HARUS
  muncul (QR + daftar wallet termasuk OKX) → JANGAN selesaikan pairing,
  tutup modal.
- Toko SQK tetap aktif, satu lagu FREE + submit wallet uji MATI
  `0x000000000000000000000000000000000000dEaD` → "TERVERIFIKASI ✓".
- Bersihkan SEMUA baris uji dari D1 (9 tabel by wallet, `LOWER(wallet)`,
  kolom liga = `best_score`; board kembali 0).

## 8. Deploy
- GitHub head: (diisi setelah push)
- GitHub Pages: (diisi setelah verifikasi live v42.3)
- 3 bukti Genesis: meta tag, baris README, DNS TXT — (dicek setelah push)
- Artifact preview slug `squeekchain-v26-fix`: (di-update ke v42.3)
