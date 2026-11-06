# Squeekchain v26 FIX

Rhythm game pixel cyberpunk — buat anthem dari wallet (read-only, tanpa koneksi wallet, tanpa transaksi), main 3 lane, kumpulkan XP, Daily Anthem, misi harian, dan ID Card.

Dibuat oleh [@xixaxxuxa](https://x.com/xixaxxuxa)

## Main

Buka `index.html` di browser (atau serve folder ini), ketuk **▶ SERU 128 BPM** atau **▶ SANTAI 100 BPM**, masukkan alamat wallet `0x...`, lalu **INITIALIZE RHYTHM**.

- **Daily Anthem** — lagu yang sama untuk semua orang di hari yang sama (genre + difficulty sama), streak harian
- **XP & level** — LV1–LV8, avatar berevolusi (kacamata, topi, mahkota emas)
- **Misi harian** — 3 misi acak per hari, +25 XP per misi
- **Mastery** — 10 game terakhir per wallet
- **Duel Link** — bagikan `?challenge=...` supaya teman main lagu yang sama
- **Musik pembuka 2 mode** — SERU 128 BPM / SANTAI 100 BPM, ganti dengan 1 ketuk di menu
- **Background bergerak** — grid + orb + sweep (tetap jalan walau WebGL mati), QLTY ULTRA/HEMAT

## File

- `index.html` — halaman utama
- `style.css` — gaya pixel / CRT
- `script.js` — game, musik, Daily, XP, misi, ID Card
- `AUDIT-v26-FIX.md` — catatan perbaikan v25 → v26
- `squeekchain-v26-single.html` — versi single-file (CSS + JS di-inline)

## Catatan

- UNOFFICIAL. Data on-chain dibaca read-only (token Sepolia, bukan BNB mainnet).
- Tidak ada transaksi, tidak ada koneksi wallet, tidak ada seed/private key — jangan pernah masukkan seed.
- Semua skor, XP, streak, dan misi tersimpan 100% di `localStorage` browser.
- Suara baru berbunyi setelah ketukan pertama (aturan autoplay browser).
