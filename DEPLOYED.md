# DEPLOYED — SqueekPixelScores (Batch 4)

Kontrak skor on-chain Squeek Pixel ID, dideploy oleh user via Remix (WalletConnect + MetaMask, wallet Genesis) pada 2026-11-08 ~22:07 WIB.

## Alamat & transaksi

- **Kontrak:** `0x06be1517d7187ec1663c4f26d11a8f6cc217304f`
- **Chain:** Sepolia (chain ID 11155111)
- **Tx deploy:** `0x7598c03f9519ced27fcc5dd12aba50d5311c2fcee84a032506b8027c4be68bab`
- **Blok:** 12091337, txIndex 41, status 1 (sukses)
- **Deployer:** `0x88538a82143065664232422e2dec4309038fcf9a` (wallet Genesis user)
- **Gas dipakai:** 9.686.757 (lebih besar dari estimasi Foundry 1.076.764 karena Remix compile tanpa optimizer) — biaya ~0,00097 ETH. Saldo wallet sesudah deploy: 0,78533 ETH.
- **Compiler:** solc 0.8.34+commit.80d5c536 (Remix), optimizer OFF, source flat `SqueekPixelScores.flat.sol` (0 import).

## Verifikasi on-chain (dicek langsung via RPC publik, 2026-11-08 ~22:11 WIB)

- `signer()` → `0x69f24C0598C8e6b6b938527D84141dd04ec2b3E3` = signer Worker v3/v4/v5/v6 ✓
- `DOMAIN_SEPARATOR()` → `0x5f197d67434e38efd63cce43f63725371ed3ba8f454a0af338b38c86e19e2e8e` = separator Worker, sama persis ✓
- `eth_getCode` → 6.126 byte runtime code ✓
- Constructor arg (tail tx input) = alamat signer ✓

Artinya: signature EIP-712 yang selama ini dibuat Worker v6 untuk skor game **valid di kontrak ini tanpa perubahan apa pun**.

## Verifikasi source code

- **Sourcify: TERVERIFIKASI, full match** (creation + runtime match) — 2026-11-08 15:11:10Z, matchId 58819025. Dicek ulang: `match: "match"`.
- Blockscout Sepolia: diteruskan oleh Sourcify (verificationId `06be1517d7187ec1663c4f26d11a8f6cc217304f6af0910e`), status tampil belum ter-update saat dicek terakhir — cek ulang di https://eth-sepolia.blockscout.com/address/0x06be1517d7187ec1663c4f26d11a8f6cc217304f
- Etherscan: forwarding Sourcify gagal karena limit harian Etherscan (500 submit/hari) — bukan masalah kontrak; coba lagi besok atau verifikasi manual via Remix ("Verify Contract on Explorers" sudah ON saat deploy, tapi tampaknya tidak selesai).
- Link Sourcify: https://sourcify.dev/server/v2/contract/11155111/0x06be1517d7187ec1663c4f26d11a8f6cc217304f

## Yang sudah selesai (Batch 4)

- [x] Kontrak ditulis + dites (Foundry 20/20, Anvil dry-run sukses)
- [x] Deploy nyata ke Sepolia oleh user
- [x] `signer()` + `DOMAIN_SEPARATOR()` cocok dengan Worker
- [x] Source terverifikasi di Sourcify (full match)

## Langkah berikut (Batch 5)

- Sambungkan Worker ke alamat kontrak ini (tambahkan `CONTRACT_ADDRESS` ke `worker.js`, rilis Worker v7 — Worker tetap menandatangani seperti biasa; kontrak menerima signature yang sama).
- Bangun toko SQK + gacha (permit EIP-2612, split 0% burn / 70% owner / 30% prize pool + sweep akhir musim, gacha dataHash hamster) — kontrak toko baru, perlu deploy Remix lagi oleh user.
- Catatan: skor game saat ini masih tercatat off-chain (Worker + D1) seperti v41.1; penjangkaran on-chain (submitScore ke kontrak) masuk Batch 5.
