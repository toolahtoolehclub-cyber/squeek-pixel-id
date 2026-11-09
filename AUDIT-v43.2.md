# AUDIT v43.2 — Latar load pertama terlihat (bukan hitam kosong)

Tanggal: 2026-11-09 ~10:50 WIB. Basis: v43.1 (head af39a10f). Worker: tetap v13 (tidak disentuh).

## Masalah (laporan user, screenshot 10:42 WIB, v43.1)
Latar halaman terlihat HITAM KOSONG saat pertama dibuka. User bertanya:
"tampil memang di buat hitam bgini apa bagaimana?"

## Penyebab (diakui)
v43.1 membuat aurora STATIS sampai tap pertama (bgWake) + WebGL tidak
auto-start. Sebelum interaksi pertama, latarnya praktis hitam polos
(`--bg #000000` + aurora .10/.08 yang nyaris tak terlihat). Tema GELAP
sendiri memang disengaja (identitas NEO sejak v32: near-black), tapi latar
yang kosong total saat buka BUKAN tampilan yang dimaksud.

## Perubahan (SATU hal saja)
Latar load pertama harus TERLIHAT berwarna, dengan biaya NOL — gradasi
statis CSS, tanpa animasi, tanpa blur, tanpa partikel, tanpa WebGL
auto-start. Gradasi statis saat load (tidak bergerak = tidak ada biaya);
bgWake yang sudah ada tetap menghidupkan animasi lembutnya saat tap
pertama. Tidak ada fungsi yang diubah.

1. `style.css` — aturan `body`: `background-color: var(--bg)` (#000000)
   diganti gradasi statis:
   - radial hijau atas (50% 0%, rgba(0,255,136,.10))
   - radial cyan bawah (50% 100%, rgba(0,229,255,.08))
   - base `#050607` (NEO near-black, bukan #000 murni).
   `body.hemat` -> #181818 dan `body.overlay` -> transparan tetap
   menimpa gradasi ini, jadi mode ECO tetap datar dan OBS tetap
   transparan. Fallback gradasi `body.no-gl` (saat WebGL gagal) tidak
   berubah.
2. `style.css` — `#bg-aurora .aurora`: tint dinaikkan agar kasat mata
   saat load (tetap `animation: none` sampai `body.bg-awake`):
   - cyan .10 -> .22 (elips 60% 45% di 25% 15%)
   - hijau .08 -> .20 (elips 50% 40% di 78% 72%)
   - violet baru .12 (elips 40% 32% di 72% 8%)
3. Versi: `index.html` (meta, title, h2, footer), `script.js`
   (`gameVersion: 'v43.2'`), `README.md` -> v43.2. Komentar historis
   v43.1 dipertahankan.

## Bukti piksel (kompositor di TEST-v43.2.js, bukan perkiraan)
- Titik cyan (25%, 15%): v43.1 (0,18,20) -> v43.2 (4,63,66)
  — tint cyan jelas terlihat, naik 45 kanal di G dan 46 di B.
- Titik hijau (78%, 72%): v43.1 (0,18,10) -> v43.2 (4,56,33)
  — tint hijau jelas terlihat, naik 38 kanal di G.
- Titik tengah layar (50%, 50%) = base NEO #050607 persis (panel
  menutupinya, jadi tengah memang gelap — benar, bukan cacat).

## Yang TIDAK berubah (batas keras)
- `engine.js` + `worker.js` byte-identik dengan v43.1 (dicek hash di tes).
- 14 chart golden identik. Judgement windows utuh
  (PERFECT ±0.045 / GREAT ±0.09 / GOOD ±0.135).
- 0 `backdrop-filter`, 0 `blur()`, 0 `ConvolverNode`, 0 loop partikel,
  0 elemen bg-particles/orb, 0 variabel --beat/orb/drift.
- `auroraPan` transform-only; aurora statis sampai `bg-awake`.
- bgWake fungsional (mock-DOM: tap pertama bangun + tambah kelas
  bg-awake, tap kedua no-op, GL start di ultra, bukan di hemat).
- ECO sembunyikan aurora + datar #181818. OBS transparan.
- Semua fungsi v43.1 tetap ada (kartu wallet, restore UX, kapsul +
  self-healing, toko, liga, Dream Seeds/Lullaby, duel, OBS).
- 3 bukti Genesis utuh. Board D1 tidak berubah.
- Tanpa dependensi/CDN baru. Tanpa file biner.

## Tes — 2181 total, 0 gagal (node --check bersih)
| Suite | Hasil |
|---|---|
| TEST-v34-neo | 1811/1811 |
| TEST-v42.5 | 144/144 |
| TEST-v42.5.3-ghost | 27/27 |
| TEST-v42.5.4-capsule | 30/30 |
| TEST-v42.5.4-restore-ui | 28/28 |
| TEST-v43 | 51/51 |
| TEST-v43.1 | 36/36 |
| TEST-v43.2 (BARU) | 34/34 |
| TEST-motif | 11/11 |
| verify-icon-routes | 9/9 |

TEST-v43.2.js (baru) menegaskan: gradasi hadir di CSS/DOM (bukan hitam
polos), aurora cyan >= 0.18 / hijau >= 0.18 / violet >= 0.10, body >= 2
gradasi + base #050607, piksel komposit di titik tint lebih terang dari
baseline v43.1 >= 20 kanal, plus semua invarian biaya-nol di atas.

## Catatan jujur
1. **11 asersi tes lama awalnya gagal setelah bump versi** — semuanya
   version-pin (mengecek string "v43.1" di judul/gameVersion/README),
   bukan regresi. Pola yang sama seperti bump v43 -> v43.1: asersi
   version-pin diperbarui ke v43.2 (TEST-v34-neo 6, TEST-v42.5 3,
   TEST-v43 1, TEST-v43.1 1, TEST-v42.5.4-restore-ui 1). Referensi
   historis "v43.1" (label fitur, komentar) sengaja dipertahankan.
2. **2 bug di TEST-v43.2.js diperbaiki sebelum run pertama**: `lines[i]`
   -> `cssLines[i]` di keyframesBody, dan `set.remove(cls)` ->
   `set.delete(cls)` di mockClassList. Keduanya bug penulisan tes,
   bukan bug game.
3. **Bukti "terlihat" bersifat komputasi (kompositor piksel), bukan
   screenshot.** Rasa akhir di HP user hanya bisa dipastikan user
   sendiri saat membuka situs — sama seperti catatan performa v43.1.
4. TEST-v13-capsule-fallback.js TIDAK dihitung (butuh bundle Worker
   yang dibangun dulu; Worker tidak berubah di v43.2, jadi tidak
   relevan — sama seperti total v43.1).

## Verifikasi live (TERVERIFIKASI 2026-11-09 ~11:10 WIB, setelah push)
- Judul live: `SQUEEKCHAIN // v43.2` ✓ (squeekpixel.web.id).
- gameVersion live: `v43.2` ✓ (script.js).
- CSS live: gradasi body exact (elips 80% 55% hijau .10 + elips 70%
  50% cyan .08 + base #050607) ✓; aurora cyan .22 + hijau .20 +
  violet .12 ✓; komentar v43.2 di aturan body ✓.
- Worker GET / -> `{"service":"squeekchain-leaderboard","version":13}` ✓.
- 3 bukti Genesis utuh ✓: meta `05432539-b4e4-4f90-97b3-c258583905b7`,
  README `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`,
  DNS TXT `_squeekchain` =
  `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9`
  (via Google DoH).
- Board D1: **berubah karena main user sendiri, bukan karena deploy
  ini** — skor baru FREE 36115 verified=1 (replay `0x89cfa755…`,
  status verified) dari user; baris Genesis race 28280 verified=1
  UTUH; 3 baris audit-trail lama utuh (daily 34675 rejected, race
  28280 verified, GHOST race 34720 rejected); verify_queue kini 4
  baris. v43.2 tidak menyentuh board/Worker dan tidak submit apa pun.
- Catatan deploy: GitHub Pages butuh ~5 menit setelah push sebelum
  v43.2 tampil (cek pertama masih v43.1, cek ulang ~11:10 WIB sudah
  v43.2).
