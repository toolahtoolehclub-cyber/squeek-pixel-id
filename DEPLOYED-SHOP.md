# DEPLOYED — SqueekPixelShop (Batch 5)

Kontrak toko SQK + Kapsul Emas (gacha) Squeek Pixel ID.
Status: **DI-DEPLOY 2026-11-08 ~23:07 WIB** — user deploy via Remix
(WalletConnect + MetaMask, wallet Genesis). Verifikasi on-chain LENGKAP.

## Alamat & transaksi

- **Kontrak:** `0x43f568AcfaDcee4333785c9F26596719ED0B02fb`
- **Chain:** Sepolia (chain ID 11155111)
- **Tx deploy:** `0x506ba0a37d0c7c959de26889df9e12777d9a954ccca76d123d7e698996408765`
- **Blok:** `12091616` (txIndex 53, nonce 46)
- **Deployer:** `0x88538a82143065664232422e2dec4309038fcf9a` (wallet Genesis user)
- **Gas dipakai:** `18.642.371` (~0,000019 ETH; gas Sepolia saat itu ~1 gwei — jauh lebih murah dari estimasi 0,00004 ETH)
- **Compiler:** solc 0.8.34 (Remix), optimizer OFF, source flat `SqueekPixelShop.flat.sol` (0 import).

## Constructor args (yang di-deploy)

- **SQK:** `0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e`
- **Owner:** `0x88538a82143065664232422e2dec4309038fcf9a`
- **Data signer:** `0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3`
- **Season end:** `1801915200` (= Sabtu, 2027-02-06 19:00 WIB; 90 hari setelah 2026-11-08)
- **Sweep tersedia mulai:** `1802520000` (= Sabtu, 2027-02-13 19:00 WIB; seasonEnd + 7 hari)

## Verifikasi on-chain (dicek langsung via RPC publik, 2026-11-08 ~23:10–23:16 WIB)

- `owner()` → `0x88538A82143065664232422E2DEc4309038Fcf9A` ✅
- `sqk()` → `0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e` ✅
- `dataSigner()` → `0x69f24C0598C8e6b6b938527D84141dd04ec2b3E3` ✅
- `seasonEnd()` → `1801915200` ✅
- `sweepAvailableAt()` → `1802520000` ✅
- `prizePool()` → `0` ✅ (belum ada penjualan)
- `isSwept()` → `false` ✅
- `DOMAIN_SEPARATOR()` → `0x086127eb5e72e191a621590d1bc74ffa9833f58b62f817384c6ae33da14e6c84` ✅ — SAMA PERSIS dengan hitungan EIP-712 domain {name "Squeek Pixel Shop", version "1", chainId 11155111, verifyingContract = alamat toko}
- `itemPrice(1..6)` → 5 / 10 / 15 / 20 / 50 / 100 SQK ✅ (5e18 / 10e18 / 15e18 / 20e18 / 50e18 / 100e18)
- Catatan: `capsulePrice()` BUKAN fungsi — harga kapsul 2 SQK adalah `CAPSULE_PRICE` constant (baris 76 source), jadi eth_call ke selector itu revert. Bukan bug.

## Verifikasi source code

- **Sourcify:** **TERVERIFIKASI full match** (creation + runtime, matchId 58821398, verifiedAt 2026-11-08T16:18:34Z; job `b35054cb-0c3b-4165-9404-6a03be23d685`, disubmit ~23:19 WIB via endpoint v2 `POST /v2/verify/11155111/<alamat>`, stdJson flat source, solc 0.8.34+commit.80d5c536, optimizer OFF, creationTransactionHash — match dalam 3 detik)
- **Blockscout Sepolia:** diteruskan Sourcify (verificationId `43f568acfadcee4333785c9f26596719ed0b02fb6af0a0da`) tapi status `Fail - Unable to verify` saat dicek ~23:21 WIB — sama seperti Batch 4 (Blockscout lambat/gagal meneruskan); Sourcify full match sudah cukup sebagai bukti, cek ulang nanti di https://eth-sepolia.blockscout.com/address/0x43f568AcfaDcee4333785c9F26596719ED0B02fb
- **Etherscan:** forwarding gagal karena limit harian Etherscan (500 submission/hari) — BUKAN masalah kontrak, sama seperti Batch 4
- **Routescan:** diteruskan (verificationId `2872842c-f28a-53c3-8b77-e7465190a893`)
- Link Sourcify: `https://sourcify.dev/server/v2/contract/11155111/0x43f568AcfaDcee4333785c9F26596719ED0B02fb`
- Link Blockscout: `https://eth-sepolia.blockscout.com/address/0x43f568AcfaDcee4333785c9F26596719ED0B02fb`

## Yang sudah selesai (Batch 5 — kontrak)

- [x] Kontrak ditulis + dites (Foundry 50/50 lolos — lihat bawah)
- [x] Anvil dry-run sukses (beli + commit + resolve + sweep, split 70/30 terbukti dalam wei persis; detail angka di bawah)
- [x] Deploy nyata ke Sepolia oleh user
- [x] `owner()` / `sqk()` / `dataSigner()` / `seasonEnd()` / `sweepAvailableAt()` / `prizePool()` / `isSwept()` / `DOMAIN_SEPARATOR()` / `itemPrice(1..6)` cocok
- [ ] Source terverifikasi di Sourcify (full match) — job sedang dipolling
- [x] Source terverifikasi di Sourcify — **FULL MATCH** (creation + runtime, matchId 58821398, verifiedAt 2026-11-08T16:18:34Z)

## Hasil tes (final, `forge test` polos — 50/50 lolos, ~16 detik)

- Unit: **23** / 23 lolos (`SqueekPixelShopTest`)
- Fuzz: **6** / 6 lolos, 256 runs tiap fungsi (`SqueekPixelShopFuzzTest`)
- Invariant: **6** invariant lolos, runs 64, depth 64, 4.096 call (`SqueekPixelShopInvariantTest`)
- Batch 4 tetap lolos semua (9 unit + 8 fuzz + 4 invariant) — tidak diubah
- **Total: 50 / 50 lolos** (termasuk 2 tes Counter)

## Hasil Anvil dry-run (2026-11-08, key test publik Anvil — BUKAN key user)

- Mock SQK: `0x5FbDB2315678afecb367f032d93F642f64180aa3` (nama "Squeek", domain permit sama dengan token asli)
- Shop: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- Beli item 1 (5 SQK): owner +3.500.000.000.000.000.000 wei (3,5 SQK), pool +1.500.000.000.000.000.000 wei (1,5 SQK) — tx `0x75b8edebdb9460db42cd5848e6ba418b4e3c6fc7240f42cc37cfe63406452472`, gas 187.606
- Commit kapsul (2 SQK): owner total 4.900.000.000.000.000.000 wei (4,9 SQK), pool total 2.100.000.000.000.000.000 wei (2,1 SQK) — tx `0x76a97e9c96f08155c9be1f88cd0fc9a85e4810c1ca02f308cdad465acad3c969`, gas 122.041
- Resolve kapsul: pull 1 resolved, hasil common (item 101), pity 1 — tx `0xf77d26e7efd6f18248f8835369d4b380c429832854980fc8d920c5ef32a42a32`, gas 109.963
- Sweep (setelah warp ke seasonEnd + 7 hari + 1 detik, dipanggil akun lain bukan owner): pool 2,1 SQK terkirim ke owner, pool 0, isSwept true, saldo owner total 7 SQK — tx `0x1543531db8544605881928b5ea7593f12f7a07072da96c0d6b8a8897542e79ca`, gas 56.559; sweep kedua revert `AlreadySwept`
- Gas deploy shop: 1.796.574 (Foundry, optimizer on) / 2.780.383 (flat file, solc 0.8.34, optimizer OFF = pengaturan Remix — tx `0xf1edf414c4d59dde701130fa166028fef2b987b81dacaa49a1f82fc2d4a959bd`, kontrak `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`)

## Langkah berikut (setelah deploy)

- Sambungkan Worker ke alamat kontrak ini (endpoint gacha + kredit Keju
  duplikat, rilis Worker v7 — Worker menandatangani resolve dengan domain
  kontrak ini).
- Sambungkan client v42 ke alamat kontrak ini (katalog id 1..6 + kapsul,
  permit dengan domain token name "Squeek").
- Uji end-to-end di Sepolia: beli 1 item + 1 pull kapsul dengan wallet uji.
