# AUDIT-v42 — Toko SQK + Kapsul Emas (Worker v7, Kontrak Shop, Batch 5)

Tanggal: 2026-11-08 ~22:40 WIB. Status: **Worker v7 LIVE, client v42 selesai + di-push, kontrak toko SELESAI + diuji tapi BELUM di-deploy** — seluruh bagian SQK tampil nonaktif dengan jujur sampai user deploy kontrak via Remix.

## 1. Yang dikerjakan

- Kontrak `SqueekPixelShop.sol` (Foundry, pola Batch 4): beli kosmetik pakai SQK via permit, split 70/30, prize pool on-chain, sweep akhir musim, gacha Kapsul Emas dari dataHash hamster + hard pity 20 on-chain.
- Worker v7: konstanta `SCORES_CONTRACT` (Batch 4, live), `SHOP_CONTRACT` = zero placeholder, `SQK_TOKEN`; 2 endpoint baru `POST /capsule-resolve` + `POST /capsule`; deploy live.
- Client v42: `CONFIG.SHOP_ADDRESS` (zero placeholder), `SQK_TOKEN`, `SEPOLIA_RPC`; bagian TOKO SQK + KAPSUL EMAS di tab SHOP (di bawah toko Keju); i18n EN + ID; `gameVersion: 'v42'`.
- Paket deploy Remix: `SqueekPixelShop.flat.sol` (0 import) + `PANDUAN-DEPLOY-REMIX-SHOP.md` + `DEPLOYED-SHOP.md` (draft).
- Tes: Foundry 50/50 + client 1572/1572 + motif 11/11 (semua diverifikasi ulang sendiri oleh koordinator).

## 2. Kontrak toko — desain (frozen)

- Constructor: `(sqk_, owner_, dataSigner_, seasonEnd_)`, semua immutable; tolak zero address; seasonEnd harus di masa depan. Owner = `0x88538a82143065664232422e2dec4309038fcf9a`; dataSigner = `0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3` (signer Worker); seasonEnd yang disarankan panduan: `1801915200` = Sabtu, 2027-02-06 19:00 WIB (90 hari dari deploy); sweep tersedia 2027-02-13 19:00 WIB.
- Katalog (harga wei SQK 18 desimal): 1 "Skin Rare" 5, 2 "Efek Epic" 10, 3 "Bingkai Animasi" 15, 4 "Skin Epic" 20, 5 "Golden Wheel" 50, 6 "Skin Legendary" 100. Hadiah gacha 101–104 tidak bisa dibeli (`itemPrice` = 0).
- Kepemilikan kosmetik dicatat di kontrak toko saja (mapping player → itemId → balance), BUKAN ERC-1155 penuh. Alasan: permukaan serang terkecil — tanpa transfer/approval/operator/`safeTransferFrom`; kosmetik terikat akun game seperti item Keju di D1; bila suatu hari harus bisa dipindah-tangankan, deploy kontrak token baru yang membaca balance di sini sebagai snapshot.
- Pembayaran HANYA via permit EIP-2612 (jumlah exact + deadline ~10 menit). TIDAK ADA unlimited approve / setApprovalForAll di mana pun.
- Split dihitung `splitFor(price)`: ownerShare = price*70/100 (dikirim LANGSUNG ke owner dalam tx yang sama), poolShare = price-ownerShare (mengendap; `prizePool` += poolShare). Untuk harga katalog (kelipatan 1 SQK) split EXACT.
- Gacha: `commitCapsule(targetRound, ...)` — permit 2 SQK + split yang sama, pullId mulai 1. `resolveCapsule(pullId, dataHash, deadline, signature)` — signature EIP-712 dataSigner atas struct `CapsuleResolve(address player, uint256 pullId, uint256 targetRound, bytes32 dataHash, uint256 deadline)`, domain `{name: "Squeek Pixel Shop", version: "1", chainId: 11155111, verifyingContract: address(this)}` — KONVENSIONAL (beda dengan Batch 4 yang memakai signer sebagai verifyingContract, karena di sana Worker sudah menandatangani begitu lebih dulu; di sini Worker menandatangani khusus untuk kontrak ini sejak awal, jadi signature gacha tidak bisa dipakai ulang di kontrak lain).
- Rarity: `rand = uint256(keccak256(abi.encode(dataHash, pullId, player))) % 100` → 0–69 common (101), 70–91 rare (102), 92–98 epic (103), 99 legendary (104). Hard pity: `pityCounter >= 19` → `rand = 70 + (rand % 22)` (hasil minimal rare). Pity naik tiap common, reset 0 tiap rare/epic/legendary.
- Duplikat: balance tidak bertambah, `duplicate=true`, `kejuCompensation` = 25/50/100/250 per tier — TERCATAT di event `CapsuleResolved`, dikreditkan Worker (bukan kontrak), karena Keju hidup di D1.
- `sweep()`: hanya bila `block.timestamp >= seasonEnd + 7 days`; kirim SELURUH prizePool ke owner (tujuan tetap); siapa pun boleh memanggil; hanya sekali; pool 0 tetap menandai swept. State diubah SEBELUM transfer (checks-effects-interactions).
- Views: `prizePool()`, `owner()`, `sqk()`, `dataSigner()`, `seasonEnd()`, `sweepAvailableAt()`, `isSwept()`, `itemPrice()`, `itemName()`, `balanceOfItem()`, `pityCounter()`, `pulls()`, `nextPullId()`, `domainSeparator()`, `splitFor()` (publik, untuk preview + fuzz).
- Events: `ItemPurchased`, `CapsuleCommitted` (player + pullId indexed), `CapsuleResolved` (**player + pullId indexed**, sisanya non-indexed), `PrizePoolSwept`.

## 3. Kontrak toko — tes + dry-run (diverifikasi ulang koordinator)

- `forge test` di `batch4-prep/` (dijalankan sendiri oleh koordinator, ~14 detik): **50/50 LOLOS, 0 gagal** — 23 unit Shop + 6 fuzz (256 runs/fungsi) + 6 invariant (runs 64, depth 64) + Batch 4 tetap lolos (9 unit + 8 fuzz + 4 invariant) + Counter 2/2.
- Yang dibuktikan unit test: permit jumlah salah DITOLAK, permit kedaluwarsa DITOLAK, item tidak ada DITOLAK, saldo 0 DITOLAK, split 70/30 EXACT (5 SQK dan 2 SQK), sweep dini DITOLAK, sweep tepat waktu + kedua kali DITOLAK, resolve 2x DITOLAK, signature salah DITOLAK, pull orang lain DITOLAK, pity 20 dijamin (19 common → pull ke-20 paksa rare, item 102, pity reset 0), duplikat tidak tambah balance + kompensasi Keju 25 di event.
- Fuzz: split selalu `owner+pool == price`, pool 30% (EXACT untuk harga kelipatan 100 wei; ±1 wei untuk harga acak), pity tidak pernah > 19. Invariant: saldo SQK kontrak == `prizePool` setiap saat; total item + pool + penerimaan owner cocok.
- **Anvil dry-run (subagent kontrak, aliran asli, permit asli, key test publik Anvil):**
  - Mock SQK `0x5FbDB231…` (nama "Squeek", domain permit = token asli); shop `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`.
  - Beli item 1 (5 SQK), gas 187.606: **owner +3,5 SQK, pool +1,5 SQK**, balance item 1 = 1 ✓
  - Commit kapsul (2 SQK), gas 122.041: **owner total 4,9 SQK, pool total 2,1 SQK**, pullId 1 ✓
  - Resolve (signature dataSigner asli), gas 109.963: common (item 101), pity 1 ✓
  - Sweep (warp ke seasonEnd+7 hari+1 detik, dipanggil akun BUKAN owner), gas 56.559, status 1: **pool 2,1 SQK terkirim ke owner, prizePool 0, isSwept true, saldo owner total 7 SQK, saldo shop 0** ✓; sweep kedua revert `AlreadySwept` ✓
  - Gas deploy shop: 1.796.574 (optimizer on) dan **2.780.383 TANPA optimizer** (file flat, solc 0.8.34 = pengaturan Remix) → pada ~16 wei ≈ **0,00004 ETH**.
- **Flat file diverifikasi ulang koordinator:** `SqueekPixelShop.flat.sol` 4.097 baris, 0 import, **compile standalone solc 0.8.34 tanpa optimizer: exit 0, 0 error** (proyek /tmp terpisah; hanya lint warning `reentrancy-events` soal posisi emit setelah transfer di `sweep()` — tidak berbahaya karena state sudah diubah sebelum transfer).
- Catatan jujur: `forge test` default (invariant runs 256, depth 500) tidak selesai dalam 9+ menit untuk handler Shop — `foundry.toml` ditambah `[invariant] runs = 64, depth = 64` (sesuai pola Batch 4), sehingga `forge test` polos selesai ~16 detik. Ini perubahan config, bukan kontrak/tes.

## 4. Worker v7 — live (diverifikasi ulang koordinator)

- `GET /` → `{"service":"squeekchain-leaderboard","version":7}` ✓
- `GET /cheese`, `GET /league` tetap jalan ✓ (board kosong, 0 skor)
- `POST /capsule-resolve` wallet valid → **503 `{"error":"shop not deployed"}`** ✓; wallet buruk → 400 ✓
- `POST /capsule` txHash palsu → **503** ✓ (gate toko mendahului validasi txHash di endpoint ini — sengaja)
- Unit offline Worker 25/25: split, odds, pity, `settlementForRound`, `dataHashForSettlement`, parse log `CapsuleResolved` (2 layout), sign + recovery CapsuleResolve.
- **KOREKSI terhadap draf audit awal:** event `CapsuleResolved` di kontrak ASLI memakai `player` + `pullId` **indexed** — parser Worker yang defensif (menerima layout indexed dan non-indexed) sudah benar; asumsi "non-indexed" di draf awal salah dan dikoreksi di sini.
- Konstanta baru: `SCORES_CONTRACT` = `0x06be1517d7187ec1663c4f26d11a8f6cc217304f`, `SHOP_CONTRACT` = zero placeholder, `SQK_TOKEN` = `0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e`.
- TIDAK diubah: verifikasi replay, enforcement 422, attestation EIP-712 skor, ekonomi Keju, liga mingguan, rate limit yang sudah ada. Tidak ada migrasi D1 baru — `/capsule` memakai tabel `cheese_*` (idempotency via `replay_hash` = txHash + partial UNIQUE index + `INSERT OR IGNORE`, kind `'capsule-duplicate'`).

## 5. Probe API Squeekchain + token SQK (2026-11-08 ~22:17 WIB)

- `GET /v1/status`: `settledThroughRound = 692`, `blockHeight = 3205`; round terbuka = 693.
- `GET /v1/settlements` (TANPA query — query apa pun ditolak `invalid_query`): 10 entri terbaru, tiap entri punya `transactionHash`, `previousSettledThroughRound`, `settledThroughRound`, `cumulativeWork`, `cumulativeBlockUnits`, `first/lastCompletedBlock`, `blockHeight`, `ethereumBlockNumber`, `blockTimestamp`, `sqkMintedBaseUnits`. **Tidak ada field hash per-round.**
- **Definisi dataHash (FROZEN):** `transactionHash` dari settlement yang mencakup targetRound (entri pertama dengan `previousSettledThroughRound < targetRound <= settledThroughRound`). Alasan: bytes32, on-chain, kanonik, bisa dicek ulang siapa pun dari API yang sama. **Fallback** (hanya bila record tak punya transactionHash valid): `keccak256(canonical JSON record settlement)`.
- Keterbatasan jujur: jendela `recentSettlements` hanya 10 settlement terakhir (~100 menit). Resolve harus dilakukan segera setelah targetRound settled; round yang lebih tua dari jendela → 409 dengan pesan jelas.
- Token SQK (dua subagent memverifikasi independen, hasil sama): `name()` = **"Squeek"** (KRITIS — domain permit memakai nama "Squeek", BUKAN "SQK"; permit dengan nama "SQK" akan revert), `symbol()` = "SQK", `decimals()` = 18, `nonces(genesis)` = 0, `DOMAIN_SEPARATOR()` on-chain `0x2cc99df9c423e838a7b45ff60b5ee38ad122ea209dca8da37a8d2f3befdf0017` == hasil hitung ("Squeek","1",11155111,token). Client membaca `name()`/`nonces()` live, fallback "Squeek", version "1".

## 6. Client v42 (diverifikasi ulang koordinator)

- Tab SHOP: katalog 6 item SQK (5/10/15/20/50/100), prizePool + seasonEnd + info sweep, Kapsul Emas (odds 70/22/7/1, pity counter, 2 SQK/pull, tombol COMMIT/RESOLVE). Alur beli: permit EIP-2612 exact amount + deadline 10 menit (1 signature + 1 tx, tanpa unlimited approve) → `buyWithPermit`; commit `targetRound = settled + 2`; resolve via Worker → `resolveCapsule`; duplikat dikredit via `POST /capsule`. Semua signing lewat `window.ethereum`; client tidak pernah menyentuh private key.
- **Karena `SHOP_ADDRESS` masih zero, SELURUH bagian SQK tampil nonaktif dengan jujur:** banner "TOKO SQK SEGERA HADIR — kontrak toko belum di-deploy. Belanja SQK dibuka setelah deploy." + semua tombol beli/commit/resolve `disabled` (bukan disembunyikan). i18n EN + ID lengkap.
- Tes client (dijalankan sendiri oleh koordinator): **TEST-v34-neo.js 1572/1572** (baseline v41.1 1426/1426 + 146 asersi baru v42: harga katalog, odds, pity math incl. forced rare counter 19, split 70/30, permit domain builder, UI disabled saat SHOP_ADDRESS zero, struktur CapsuleResolve + encoding calldata, konstanta Worker) + **TEST-motif.js 11/11**. `node --check` OK. `engine.js` + migrasi D1 identik v41.1. 0 kata "BNB"/"Binance" di semua file situs + worker (dicek koordinator).
- 3 proofs Genesis utuh di v42 (dicek koordinator): meta tag `05432539-b4e4-4f90-97b3-c258583905b7` (index.html:8), baris README sama UUID (README.md:110), TXT DNS via Google DoH `_squeekchain.squeekpixel.web.id` → `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9`.

## 7. Yang BELUM selesai (terblokir deploy kontrak toko)

- Kontrak `SqueekPixelShop` **belum di-deploy ke Sepolia** — butuh tanda tangan wallet Genesis user via Remix (paket sudah siap: flat file di root repo + panduan). Akibatnya: `SHOP_CONTRACT` masih zero di Worker + client; kedua endpoint baru menjawab 503; tombol SQK nonaktif.
- Yang belum BISA diuji end-to-end sampai deploy: signature CapsuleResolve asli (butuh `SHOP_CONTRACT` nyata sebagai verifyingContract), alur beli/commit/resolve sungguhan, kredit Keju duplikat dari receipt nyata, tampilan prizePool/seasonEnd live.
- Setelah deploy, yang harus dilakukan: isi `SHOP_CONTRACT` di `worker.js` + `script.js` (alamat sama), deploy ulang Worker (kode v7 yang sama), lalu uji beli 5 SQK + 1 kapsul penuh. Perkiraan biaya deploy shop: ~0,00004 ETH.
- Catatan kecil: di `sqkPermitAndSend`, bila `eth_chainId` gagal dibaca (null), client tetap lanjut (MetaMask normalnya selalu menjawab); risikonya hanya transaksi sia-sia di chain yang salah, bukan kehilangan dana — permit domain-nya eksplisit Sepolia.
- Verifikasi source (Sourcify/Blockscout) untuk kontrak shop hanya bisa dilakukan SETELAH deploy — belum ada yang bisa dicek sekarang.
- Batch 6 (season/tournament/guild/ZK) TIDAK dimulai — giliran berikutnya setelah shop di-deploy user.

## 8. File dibuat/diubah

- `batch4-prep/src/SqueekPixelShop.sol` (baru), `batch4-prep/test/SqueekPixelShop*.sol` (baru, 3 file), `batch4-prep/script/DeployShop.s.sol` + `DryRunShop.s.sol` (baru), `batch4-prep/SqueekPixelShop.flat.sol` (baru), `batch4-prep/PANDUAN-DEPLOY-REMIX-SHOP.md` (baru), `batch4-prep/DEPLOYED-SHOP.md` (baru, draft), `batch4-prep/foundry.toml` (tambah `[invariant] runs = 64, depth = 64`).
- `squeekchain-v42/`: `worker.js` (v7), `script.js` (v42 + toko SQK), `index.html` (v42 + seksi SQK), `style.css` (`.sqk-*`), `README.md` (bagian v42), `TEST-v34-neo.js` (+146 asersi), `build-worker.sh` (path v42), `AUDIT-v42.md` (file ini).
- TIDAK disentuh: `SqueekPixelScores.sol` + tes Batch 4, `engine.js`, migrasi D1, semua file v41.1. TIDAK ada transaksi/sign/deploy dari sisi agent. TIDAK ada private key/seed yang diminta atau disentuh.
