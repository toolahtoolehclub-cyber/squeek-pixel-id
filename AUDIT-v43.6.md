# AUDIT-v43.6 — Equip terikat wallet: disconnect kembali ke tampilan default

Tanggal: 2026-11-09 ~23:50–00:10 WIB. Versi sebelumnya: v43.5 (head `23bec4d2`, kode `6db60738`).

## 1. Laporan user + akar masalah

User melaporkan (9 Nov 2026 ~23:47 WIB): setelah **disconnect** wallet, hasil equip dari sesi connect **masih berpengaruh saat main** — tampilan game tidak kembali ke default. User benar, dan ini inkonsisten dengan aturan v43.4 (semua yang terikat wallet hanya tampil/berlaku saat benar-benar terhubung).

Akar masalah (terverifikasi di kode v43.5):

- `shopSkin()` (`script.js` ~baris 3316) membaca equip dari localStorage (`sqk41:skin-keju` / `sqk41:skin-sqk` / `sqk41:skin-last`) **tanpa mengecek status koneksi**.
- Call site-nya: (a) `play()` menetapkan `G.noteSkin = shopSkin().note` → warna not selama lagu; (b) `applyResultFrame()` membaca `shopSkin().frame` → class frame di `#resultPanel` DAN `#gamePanel` (sejak v43.5); (c) `sqkIsEquipped()` memakai `shopSkin()` untuk label EQUIPPED di toko.
- `setConnected()` (v43.4) sudah menilai ulang avatar, toko, dan peringkat saat connect/disconnect — tapi **tidak** menerapkan ulang frame. Jadi frame yang menempel bertahan sampai lagu berikutnya (atau selamanya di panel hasil).

## 2. Perbaikan

- `script.js` — `shopSkin()`: baris pertama kini gate `if (!connectedWallet()) return { note: null, frame: null };` — diletakkan **sebelum** pembacaan localStorage pertama, jadi saat GUEST seluruh call site langsung mendapat default. Gate tunggal ini memperbaiki warna not, frame di kedua panel, dan cek EQUIPPED sekaligus.
- `script.js` — `setConnected()`: ditambah `try { applyResultFrame(); } catch (_) {}` setelah render avatar/toko/peringkat. Disconnect langsung menghapus frame dari `#gamePanel` + `#resultPanel` seketika (tanpa reload); connect langsung mengembalikannya. Semua jalur disconnect bermuara ke `setConnected(null)` (3 situs: handler `disconnect` WalletConnect, `accountsChanged` akun kosong, `disconnectWallet()`).
- **Equip yang tersimpan TIDAK dihapus.** Disconnect hanya menahan *penerapannya*; localStorage utuh, jadi reconnect wallet yang sama mengembalikan tampilan equip. Migrasi kunci legacy (`sqk41:skin` v42.4) juga tertunda sampai connect — tidak dihapus/dikonsumsi saat GUEST.
- TIDAK berubah: gating v43.4 (connected-only profile/shop/rank), perilaku frame v43.5 di dalam game saat connect, palet note skin, scoring, verifikasi, Worker, engine.js, alur beli toko.

## 3. Versi

- `gameVersion: 'v43.6'` di `script.js`; judul/header/footer/meta `index.html` → v43.6; judul `README.md` → v43.6.
- 11 file tes lama hanya asersi versi v43.5 → v43.6 (TEST-v34-neo, TEST-v42.5, TEST-v42.5.4-restore-ui, TEST-v43, TEST-v43.1, TEST-v43.2, TEST-v43.3, TEST-v43.3-submit, TEST-v43.4, TEST-v43.4-submit, TEST-v43.5).
- TEST-v43.5.js C5 diperbarui: `applyResultFrame()` kini 8 kemunculan di jsCode (7 call + definisi) karena `setConnected()` ikut memanggil; C6 versi → v43.6; C9 parent engine/worker → v43.5.

## 4. Tes — TOTAL 2442 passed, 0 failed

- **TEST-v43.6.js (baru): 27/27** — fungsi ASLI diekstrak ke mock-DOM sandbox (pola TEST-v43.5.js), termasuk `setConnected()` ASLI dengan stub render/fetch. A1: equip tersimpan + GUEST → `shopSkin()` = default. A2/A3: equip tersimpan + connected → equip yang tersimpan (last=sqk / last=keju). A4: store kosong + connected → default. A5: migrasi legacy hanya jalan saat connected; saat GUEST kunci lama tidak disentuh. A6: `sqkIsEquipped()` false saat GUEST, true saat connected. B1/B2: warna not default saat GUEST (jalur `play()`), palet SQK rare saat connected. C1: connected + frame-sqk → kedua panel dibungkus. C2: `setConnected(null)` ASLI → frame hilang dari kedua panel tanpa reload + localStorage TIDAK terhapus. C3: reconnect → frame kembali. C4: frame sisa yang menempel + GUEST → dibersihkan. C5: disconnect tanpa equip → tidak crash. D1: gate di awal `shopSkin()` sebelum baca localStorage. D2: `setConnected()` memanggil `applyResultFrame()` dan TIDAK menghapus kunci skin. D3: ≥3 situs `setConnected(null)`. D4: versi v43.6. D5: frame v43.5 utuh (shared CSS + `play()`). D6: engine/worker byte-identik v43.5. D7: 14 chart golden identik + judgement windows tidak berubah. D8: 2 bukti Genesis di file lokal (meta + README).
- Full suite: TEST-v43.6 27, TEST-v43.5 29, TEST-v43.4 66, TEST-v43.4-submit 34, TEST-v43.3 38, TEST-v43.3-submit 34, TEST-v34-neo 1813, TEST-v42.5 147, TEST-v42.5.4-capsule 30, TEST-v42.5.4-restore-ui 28, TEST-v42.5.3-ghost 27, TEST-v43 51, TEST-v43.1 36, TEST-v43.2 34, TEST-v13-capsule-fallback 28, TEST-motif 11, verify-icon-routes 9. **TOTAL 2442 passed, 0 failed.**
- Yang sempat gagal dan diperbaiki (jujur): 3 file crash saat run pertama — TEST-v43.5, TEST-v34-neo, TEST-v42.5 melempar `ReferenceError: connectedWallet is not defined`. Penyebabnya BUKAN kode game: harness lama mengekstrak `shopSkin()` ASLI ke sandbox mock-DOM tanpa menyediakan `connectedWallet()` (gate baru v43.6). Perbaikan: stub `connectedWallet` (kasus CONNECTED, mengembalikan alamat user) ditambahkan ke 5 harness lama — TEST-v43.5.js `mkFrameHarness`, TEST-v34-neo.js (3 harness: section 15c, `runEquipTests42`/`shopSkinH`, dan migrasi legacy `fns2`), TEST-v42.5.js (2 harness: `runBugFixTests4251` + `runBugFixTests4252`). Ini pola yang sama seperti v43.4 (stub `connectedWallet` di 8 harness lama). Kasus GUEST tetap diuji penuh di TEST-v43.6.js — tidak ada perilaku yang ditutup-tutupi oleh stub.

## 5. Deploy

- Repo `toolahtoolehclub-cyber/squeek-pixel-id`, branch `main`.
- Commit kode: `f841c21701dbc4e7502a5e7045b9a2b7999ae267` — "Squeekchain v43.6 — equipped skins/frames apply only while a wallet is connected (shopSkin gate + setConnected re-applies frame; stored equip kept, reconnect restores it; 2442 tests, 0 failed; engine/Worker v13 unchanged, 3 Genesis proofs intact)". Head sebelumnya `23bec4d2` (v43.5).
- File di-push: index.html, script.js, README.md, TEST-v43.6.js (baru), TEST-v43.5.js, TEST-v43.4.js, TEST-v43.4-submit.js, TEST-v43.3.js, TEST-v43.3-submit.js, TEST-v43.2.js, TEST-v43.1.js, TEST-v43.js, TEST-v42.5.js, TEST-v42.5.4-restore-ui.js, TEST-v34-neo.js.
- Commit docs: `docs: AUDIT-v43.6 — deploy + live verification (commit f841c217, site v43.6, script.js byte-identical, engine/Worker v13 unchanged, 3 Genesis proofs intact)` (menyusul setelah verifikasi live).

## 6. Verifikasi live (2026-11-10 ~00:10 WIB, setelah deploy + jeda 3 menit)

- Situs live https://squeekpixel.web.id/ menunjukkan **v43.6**: `<title>SQUEEKCHAIN // v43.6</title>`, header `PIXEL ID // v43.6`, footer `• v43.6 •`, `gameVersion: 'v43.6'` di script.js.
- **Live script.js byte-identik** dengan script.js lokal v43.6 (`cmp` IDENTICAL).
- **3 bukti Genesis utuh, tidak berubah:**
  1. DNS TXT `_squeekchain` = `squeekchain-verify=5a1592c9dc62c4ad09e9038ec8b41f67d1d137bfc3eda6f9` (dicek via Google DoH).
  2. Meta tag `<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">` ada di index.html live.
  3. README live: judul `# Squeekchain v43.6`, baris terakhir `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`.
- **engine.js dan worker.js live byte-identik dengan v43.5** — perubahan ini murni UI client; Worker tetap v13, tidak di-deploy ulang.

## 7. Yang akan dilihat user

- Disconnect wallet (tombol DISCONNECT / dari OKX): frame langsung hilang dari area main dan panel hasil, not kembali ke warna tema default — tanpa reload, tanpa main lagu dulu. Toko dan kartu profil tetap tersembunyi seperti v43.4.
- Connect lagi (wallet yang sama): skin not + frame yang tadi di-equip langsung kembali — tidak perlu equip ulang.
- Saat connect, semuanya persis seperti v43.5 (frame membungkus area main selama lagu).

## 8. Catatan untuk parent

- Verifikasi di HP user belum dilakukan; suruh refresh halaman, equip frame, disconnect, lalu main satu lagu (harus default), lalu connect lagi (equip kembali).
- Pola yang perlu diingat: setiap kali `shopSkin()` mendapat dependensi baru, SEMUA harness lama yang mengekstraknya akan crash dengan `ReferenceError` — perbaiki dengan stub di harness (kasus CONNECTED), dan uji kasus barunya di file TEST versi baru.
