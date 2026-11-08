# DEPLOYED — SqueekPixelShop (Batch 5) — DRAFT

Kontrak toko SQK + Kapsul Emas (gacha) Squeek Pixel ID.
Status: **BELUM DI-DEPLOY** — file ini draft, diisi setelah user deploy via
Remix (lihat `PANDUAN-DEPLOY-REMIX-SHOP.md`).

## Alamat & transaksi

- **Kontrak:** `<ALAMAT_KONTRAK_SEPOLIA — isi setelah deploy>`
- **Chain:** Sepolia (chain ID 11155111)
- **Tx deploy:** `<TX_HASH — isi setelah deploy>`
- **Blok:** `<NOMOR_BLOK — isi setelah deploy>`
- **Deployer:** `0x88538a82143065664232422e2dec4309038fcf9a` (wallet Genesis user)
- **Gas dipakai:** `<GAS — isi setelah deploy>` (dry-run Anvil: shop deploy 1.796.574 gas dengan optimizer Foundry; 2.780.383 gas TANPA optimizer — setara Remix 0.8.34)
- **Compiler:** solc 0.8.34 (Remix), optimizer OFF, source flat `SqueekPixelShop.flat.sol` (0 import).

## Constructor args (yang di-deploy)

- **SQK:** `0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e`
- **Owner:** `0x88538a82143065664232422e2dec4309038fcf9a`
- **Data signer:** `0x69f24c0598c8e6b6b938527d84141dd04ec2b3e3`
- **Season end:** `1801915200` (= Sabtu, 2027-02-06 19:00 WIB; 90 hari setelah 2026-11-08)
- **Sweep tersedia mulai:** `1802520000` (= Sabtu, 2027-02-13 19:00 WIB; seasonEnd + 7 hari)

## Verifikasi on-chain (diisi setelah deploy — dicek langsung via RPC publik)

- `owner()` → `0x88538A82143065664232422E2DEc4309038Fcf9A` ☐
- `sqk()` → `0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e` ☐
- `dataSigner()` → `0x69f24C0598C8e6b6b938527D84141dd04ec2b3E3` ☐
- `seasonEnd()` → `1801915200` ☐
- `sweepAvailableAt()` → `1802520000` ☐
- `domainSeparator()` → `<NILAI — isi setelah deploy>` ☐
- `itemPrice(1..6)` → 5 / 10 / 15 / 20 / 50 / 100 SQK ☐

## Verifikasi source code (diisi setelah deploy)

- **Sourcify:** `<status — isi setelah deploy>`
- **Blockscout Sepolia:** `<status — isi setelah deploy>`
- Link Sourcify: `https://sourcify.dev/server/v2/contract/11155111/<ALAMAT_KONTRAK_SEPOLIA>`

## Yang sudah selesai (Batch 5 — kontrak)

- [x] Kontrak ditulis + dites (Foundry 50/50 lolos — lihat bawah)
- [x] Anvil dry-run sukses (beli + commit + resolve + sweep, split 70/30 terbukti dalam wei persis; detail angka di bawah)
- [ ] Deploy nyata ke Sepolia oleh user
- [ ] `owner()` / `sqk()` / `dataSigner()` / `seasonEnd()` / `domainSeparator()` cocok
- [ ] Source terverifikasi di Sourcify (full match)

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
