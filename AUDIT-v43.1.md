# AUDIT-v43.1 — Perbaikan total atas v43 yang gagal

**Tanggal:** 2026-11-09 (09:38–10:xx WIB)
**Basis:** v43 (GitHub head `0609479b`) — Worker tetap v13, tidak berubah.
**Hasil tes:** **2147 lolos, 0 gagal** (TEST-v34-neo 1811 + TEST-v42.5 144 + TEST-v42.5.3-ghost 27 + TEST-v42.5.4-capsule 30 + TEST-v42.5.4-restore-ui 28 + TEST-v43 51 + TEST-v43.1 36 + TEST-motif 11 + verify-icon-routes 9). `node --check` bersih (script.js, worker.js, engine.js).
**Batas keras dipatuhi:** engine.js byte-identik v43 (md5 `203f07c970858726c1c998d34a10f533`), worker.js byte-identik v43 (md5 `ea56e1e501e1fc27009c9805aa098f03`), 14 chart golden identik, judgement windows + formula skor tidak berubah, 3 bukti Genesis utuh, board D1 tidak berubah.

---

## 1. Apa yang salah di v43 — diakui terus terang, tidak dibela

User (HP Android, koneksi lambat, 09:33 WIB) menolak v43: **nge-lag, kurang responsif, terlalu berat saat awal buka; tampilan baru jelek/tidak jelas/berantakan ("sampah", standar/generik); lagu monoton + suka patah-patah (stutter)**. Screenshot user menunjukkan masalah konkret: alamat wallet tampil DUA KALI, layar penuh pill/kartu berdesakan, background aurora + partikel ramai.

**Penyebab performa (diakui — ini kesalahan desain v43, bukan salah HP user):**
1. `backdrop-filter: blur(18px)` pada `.panel` + `blur(14px)` pada `.wallet-card` + `blur(2px)` pada `#settingsBackdrop`. Blur backdrop memaksa browser me-render ulang backdrop di balik panel **setiap frame** — ini operasi paling mahal di CSS untuk HP. Di HP lambat, ini saja sudah cukup membuat scroll/tap terasa berat.
2. **36 partikel canvas + 3 orb aurora + WebGL + grid yang dianimasikan, semuanya jalan sejak halaman pertama dibuka.** Loop partikel (`bgStepParticles`) me-reschedule `requestAnimationFrame` **selamanya** — bahkan saat "frozen", ia tetap menjadwalkan frame berikutnya tiap 16 ms. WebGL (`initGL`) auto-start di load, sebelum user menyentuh apa pun. Empat lapisan animasi sekaligus di first paint = jank yang user rasakan.
3. **Aurora + partikel + beat driver tidak pernah benar-benar mati di menu.** "Frozen" hanya melewati gambar, bukan loop-nya.

**Penyebab audio patah (diakui):**
1. **Convolver reverb** — `initFxBus` membuat impulse 1,1 detik (noise yang di-generate, 2 channel) dan `verbBus = ac.createConvolver()`. Convolver adalah node DSP paling berat di Web Audio; di audio thread HP lambat, ia membuat suara patah-patah.
2. **Rantai efek berat per note** — tiap pukulan memanggil `toneFx` 2–3 kali, tiap panggilan membuat 1 gain + 2 send gain (echo + reverb) = **6–9 node per pukulan**. Riff memanggil `toneFx` 2 kali per langkah (4 send gain). Di lagu cepat, puluhan node dibuat/dibuang per detik.
3. **Monoton** — `RIFF_PATTERNS` hanya 8 derajat per genre, **satu derajat dimainkan 4× per bar** (langkah 2/6/10/14 sama). Arpeggio juga pola 4 nada yang sama dirotasi tiap bar. Itu yang user dengar sebagai "lagu monoton".

**Penyebab desain jelek (diakui):**
1. **Alamat tampil dua kali** — kartu wallet menampilkan alamat singkat, lalu baris `walletStatus` di bawahnya menulis lagi "● 0x8853…cf9a — CONNECTED". Baris itu saya tambahkan di v43 sebagai "konfirmasi" — ternyata justru membingungkan dan berdesakan.
2. **Pelangi warna** — tiap tab punya warna aktif sendiri (PLAY hijau, DAILY kuning, LIVE pink, LEAGUE cyan, ME oranye); tiap mode punya `--mode-accent` sendiri (free cyan, daily amber, live hijau, race pink, lullaby lavender). Lima warna tab + lima warna mode + gradasi wordmark cyan→hijau→emas = terlihat seperti toko permen, bukan seperti game yang profesional. Riset referensi (Cytus II, Phigros, Arcaea, Deemo II, Lanota, VOEZ + prinsip UI mobile) menegaskan: game rhythm profesional memakai **satu aksen + satu sinyal**, hierarki jelas, ruang lega, warna cerah hanya untuk elemen interaktif.
3. **Tab ME terlipat ke baris kedua** — `#tabBar` memakai `repeat(5, 1fr)` untuk 6 tab (PLAY/DAILY/LIVE/LEAGUE/SHOP/ME), jadi ME jatuh ke baris sendiri. Ini bug layout v43 yang lolos karena tidak ada yang menghitung kolomnya.
4. **Panel kaca + bayangan keras** — `backdrop-filter` + gradasi putih + `box-shadow: 4px 4px 0 var(--pink)` pada tombol aktif + border dashed hijau pada kartu avatar + bayangan pink pada avatar = terlalu banyak efek yang saling berebut perhatian.

**Catatan jujur tambahan (ditemukan saat membangun v43.1):**
- Suite **TEST-v42.5.4-restore-ui.js sudah GAGAL di v43 (24/28)** — klaim v43 "2082 tes, 0 gagal" tidak menghitung suite ini. Penyebab: `updateConnectBtn` v43 memanggil `shortAddr()` di cabang `walletStatus`, tapi harness tes tidak menyediakan `shortAddr` — jadi restore yang berhasil melempar ReferenceError di dalam tes. Empat asersi tombol (`[ CONNECTED: … ]`) juga sudah kedaluwarsa di v43. v43.1 memperbaiki suite ini (28/28) dan mencatat kegagalan v43 ini di sini, bukan menyembunyikannya.
- Total TEST-v34-neo turun 1813 → 1811 (−2). **Bukan regresi**: dua asersi itu memeriksa kunci MSG `walletConnectedTpl` (dipakai hanya oleh baris walletStatus yang dihapus). Kunci itu tidak lagi dipanggil di mana pun, jadi ekstraktor kunci dinamis tidak lagi menemukannya. Entri MSG-nya sendiri sengaja dibiarkan (string mati yang tidak berbahaya) supaya tidak ada risiko merusak tes lain.

---

## 2. Apa yang diperbaiki di v43.1

### PERFORMA (prioritas #1) — halaman terasa instan, default RINGAN
| v43 (berat) | v43.1 (ringan) | Bukti tes |
|---|---|---|
| `backdrop-filter: blur(18px)` di `.panel`, `blur(14px)` di `.wallet-card`, `blur(2px)` di backdrop settings | **0 `backdrop-filter` di seluruh CSS** (hanya disebut di komentar yang mendokumentasikan penghapusan). Panel + kartu wallet latar solid `#0a0d0f`. | TEST-v43.1: tanpa backdrop-filter, tanpa blur() |
| 36 partikel canvas + rAF loop yang tidak pernah berhenti | **Loop partikel DIHAPUS total** (`bgBeatPulse`, `bgInitParticles`, `bgStepParticles` tidak ada lagi). Tidak ada canvas, tidak ada rAF loop background. | TEST-v43.1 + TEST-v43 |
| 3 orb aurora + sweep + filter brightness ikut beat (`--beat`, ~10 Hz) | **SATU aurora** (`#bg-aurora`): satu gradasi, satu animasi `auroraPan` 36 detik yang hanya memakai `transform: translate3d` (compositor-only, tanpa filter/opacity/posisi). | TEST-v43.1: auroraPan hanya transform |
| Grid `bgPan` 8 detik jalan sejak load | **Dihapus.** | TEST-v43.1 |
| WebGL auto-start di load | **Tidak auto-start.** `bgWake()` baru: WebGL + aurora baru bangun saat **interaksi pertama** (sekali, idempotent). `setQuality`/`resumeGL` juga hanya menyalakan WebGL bila sudah bangun. | TEST-v43.1: bgWake fungsional (4 skenario: bangun sekali, no-op kedua, GL jalan di ultra, GL mati di hemat) |
| Animasi jalan terus di menu | Aurora **statis** sampai `body.bg-awake`; **mati** saat main (`body.playing`), saat tab tersembunyi (lapisan disembunyikan), di ECO (`body.hemat`), dan di `prefers-reduced-motion`. | TEST-v43.1: gating aurora |

### AUDIO — tidak patah, tidak monoton, tetap kaya tapi RINGAN
| v43 | v43.1 | Bukti tes |
|---|---|---|
| Convolver reverb (impulse 1,1 dtk) + 2 send per nada | **Convolver DIHAPUS.** `initFxBus` hanya punya **satu delay** (dotted-eighth, feedback 0.32, wet 0.16). `toneFx` hanya punya **satu send echo**. | TEST-v43.1 + TEST-v43 |
| Pukulan = 2–3 `toneFx` (6–9 node) | **Satu `duo()`** — 2 oscillator berbagi **1 gain, tanpa send** — + sparkle PERFECT kering (`tone()`). | TEST-v43.1 + TEST-v43: duo = 2 osc, 1 gain, 0 send |
| Riff = 1 derajat 4× per bar (8-bar cycle) | **`RIFF_PHRASES`: 4 bar × 4 langkah per genre** — tiap langkah beda derajat; bar 1 menyatakan motif, bar 2 menjawab, bar 3 naik, bar 4 resolve. 16 nada sebelum pola berulang. | TEST-v43.1: tidak ada 4 nada beruntun sama; tiap bar berbeda; ≥6 derajat berbeda per genre |
| Arpeggio = pola 4 nada yang sama dirotasi | **`ARP_PHRASE`: 4 bar × 4 langkah**, bervariasi per bar. | TEST-v43 |
| Pad intro = akor 3 nada | **Pad = root+fifth (2 nada).** | TEST-v43 |
| Golden note pakai echo send | **Kering** (`tone()`). | TEST-v43 |
| — | Chart, engine, judgement, formula skor **TIDAK BERUBAH** (hanya suara). | 14 chart golden identik; engine byte-identik v43 |

### DESAIN ULANG — profesional, proper, visioner (riset dulu, bukan asal)
Riset referensi nyata: **Cytus II** (input berkode warna + skor di sudut atas, gameplay besar di tengah, chrome minimal), **Phigros** (energi garis judgement, tanpa ornamen berlebih), **Arcaea** (langit kaca yang tenang, satu aksen), **Deemo II / Lanota / VOEZ** (hierarki jelas, ruang lega). Prinsip yang diterapkan: **satu titik fokus, satu aksen, skala spasi 8/16/24, teks kontras tinggi, warna cerah hanya untuk elemen interaktif**.
| v43 | v43.1 |
|---|---|
| Alamat tampil DUA kali (kartu + baris CONNECTED) | **SATU kali.** Baris `walletStatus` dihapus dari HTML, JS, dan CSS. `updateConnectBtn` tidak pernah menyentuhnya (dites statis + fungsional). Saat terhubung: dot hijau + alamat singkat di SATU bar, tombol CONNECT hilang, ✕ muncul. |
| Tab 5 kolom → ME terlipat ke baris 2 | **6 kolom** — PLAY/DAILY/LIVE/LEAGUE/SHOP/ME sebaris. |
| Pelangi: 5 warna tab + 5 warna mode | **Satu aksen hijau `#00ff88`.** Tab aktif = pill hijau solid + teks hitam. Pill aktif (genre/diff/mode/options) = hijau solid + teks hitam. `--mode-accent` dan warna per-tab **dihapus**. |
| Panel kaca (gradasi putih + blur) | **Panel solid `#0a0d0f`**, border hairline, highlight tepi atas. |
| Kartu avatar: border dashed hijau 2px + avatar border putih 3px + bayangan pink keras | **Border tipis netral, radius 12px; avatar border 2px netral, tanpa bayangan.** (Varian `.gold` untuk LV8 tetap dipertahankan — itu status pencapaian, bukan dekorasi.) |
| Spasi rapat (`#ui-layer` gap 20, `.tab-panel` gap 15) | **Skala 8/16/24**: `#ui-layer` gap 24, `.tab-panel` gap 16. |
| Light wells terang (cyan .12, violet .10, hijau .09) | **Diredupkan** (.08/.07/.06) — cahaya latar, bukan sorotan. |
| Lullaby lavender `#b388ff` (perbaikan v42.5.1 BUG 3) | **Lullaby kini pill standar** (hijau saat aktif). Ini BUKAN kembalinya bug v42.5.1 — bug itu adalah tombol Lullaby yang **tidak punya gaya pill sama sekali**; sekarang ia punya gaya pill yang sama dengan semua mode. Dicatat di sini supaya tidak disalahartikan sebagai regresi. |

### YANG TIDAK HILANG (semua fungsi v43 tetap ada)
Kartu wallet baru + restore UX + status restoring (`wcRestoreNote` tetap ada — itu status restore, bukan duplikat alamat) + perbaikan kapsul v42.5.4 + self-healing (`sqkHealPendingCapsule`) + toko SQK/Keju + liga mingguan + Dream Seeds/Lullaby + duel + OBS. Pesan kapsul tetap rarity sekali ("Kapsul #102 (rare) ✓"). Semua dites (TEST-v43.1 bagian regresi).

---

## 3. Bukti performa (angka, bukan janji)

Tes baru **TEST-v43.1.js (36/36)** + pembaruan TEST-v43.js (51/51) membuktikan secara statis + fungsional:
- **0** `backdrop-filter` di CSS; **0** `blur()` di CSS.
- **0** `createConvolver` / `verbBus` / `verbWet` / `impulse` di kode JS.
- **0** loop partikel (`bgBeatPulse`/`bgInitParticles`/`bgStepParticles` tidak ada); **0** canvas partikel / orb di HTML; **0** `--beat` / `driftV` / `sweepY` / `bgPan` di CSS.
- Animasi background **hanya `transform: translate3d`** (auroraPan 36 detik) — tanpa filter, opacity, background-position, box-shadow.
- Aurora **statis** sampai interaksi pertama; mati saat main/ECO/reduced-motion.
- **bgWake fungsional** (mock DOM): panggilan pertama menambah class `bg-awake` + menyalakan WebGL (bila ada, quality ultra); panggilan kedua no-op (0 rAF baru); quality hemat memblokir WebGL.
- Riff: **tidak ada 4 nada beruntun yang sama** di genre mana pun; **tiap bar berbeda**; ≥6 derajat berbeda per genre (16 nada per frasa).
- `duo()`: **2 oscillator, 1 gain, 0 send**. `hitTone`: duo + sparkle kering, tanpa `toneFx`. `toneFx`: 1 send echo saja.
- Alamat tampil sekali; tab 6 kolom; panel + kartu solid `#0a0d0f`.

**Yang TIDAK bisa dibuktikan oleh tes unit (jujur):** rasa "instan" di HP user yang sebenarnya hanya bisa dipastikan oleh user sendiri saat membuka situs. Tes membuktikan penyebab-penyebab beratnya **sudah tidak ada di kode** — bukan mengukur frame rate di HP user. Bila setelah v43.1 masih terasa berat, penyebabnya bukan lagi blur/partikel/convolver, dan harus dicari di tempat lain (misalnya bundle WC 2,1 MB yang diunduh saat ada sesi, atau WebGL di HP tersebut).

---

## 4. Perubahan file (vs v43)

| File | Perubahan |
|---|---|
| `script.js` | Hapus convolver + verb send; `duo()` baru; `hitTone` kering; `RIFF_PATTERNS` → `RIFF_PHRASES` 4-bar + `ARP_PHRASE`; `schedule()` riff via duo + arp via `arpDegreesFor` kering; pad intro 2 nada; golden note kering; **hapus loop partikel + beat driver**; `bgWake()` baru + WebGL tidak auto-start (gating di `setQuality`/`resumeGL`); hapus baris `walletStatus` dari `updateConnectBtn`; `gameVersion: 'v43.1'`. |
| `style.css` | Hapus `backdrop-filter` (panel, kartu wallet, backdrop settings); hapus `bgPan`; hapus orb/sweep/partikel/`--beat`/`driftV`; **satu aurora** (`#bg-aurora`, `auroraPan` transform-only, gating `bg-awake`/playing/hemat/reduced-motion); hapus warna per-tab + `--mode-accent`; tab aktif + pill aktif hijau solid; tab bar 6 kolom; panel + kartu solid `#0a0d0f`; avatar tenang; gap 24/16; light wells diredupkan; hapus `.wallet-status` (2 aturan). |
| `index.html` | `#bg-anim` + `#bg-particles` → `<div id="bg-aurora"><div class="aurora"></div></div>`; hapus `<div id="walletStatus">`; versi v43.1 (meta, title, h2, footer). |
| `README.md` | Judul v43.1. |
| `TEST-v43.1.js` | **Baru** — 36 tes perf + audio + desain + regresi. |
| `TEST-v43.js` | Diperbarui ke spek v43.1 (51 tes): asersi background/audio v43 yang kedaluwarsa diganti; baseline byte-identik kini v43. |
| `TEST-v42.5.4-restore-ui.js` | Diperbaiki ke kontrak kartu v43.1 (28/28 — sebelumnya 24/28 di v43, lihat §1). |
| `TEST-v34-neo.js`, `TEST-v42.5.js` | Diperbarui ke spek v43.1 (judul/gameVersion, tanpa walletStatus, tanpa `--mode-accent`, tanpa warna per-tab). |
| `engine.js`, `worker.js` | **Tidak berubah** (byte-identik v43). |

---

## 5. Yang masih terbuka (bukan bagian v43.1)

- **Verifikasi di HP user** — buka situs, rasakan: buka instan? scroll/tap responsif? musik tidak patah? Ini satu-satunya bukti akhir yang tidak bisa digantikan tes unit.
- **Restore WalletConnect di HP user** — masih menunggu konfirmasi user (apakah kartu menunjukkan TERHUBUNG sendiri setelah buka ulang). Bila gagal, teks kecil di bawah kartu (`bundle-timeout` / `no-accounts` / `enable-rejected`) adalah diagnosisnya.
- **Dua sesi WalletConnect ganda di OKX** — putuskan salah satu entri "Squeek Pixel ID" di OKX (atau keduanya lalu connect fresh sekali).
- **Sisa celah anti-cheat** (validasi wall-clock golden, dst.) — tidak disentuh v43.1, tetap untuk batch berikutnya.
- **Entri MSG `walletConnectedTpl` yang kini tidak terpakai** — dibiarkan (string mati, tidak berbahaya); boleh dihapus di batch bersih-bersih berikutnya bila diinginkan.
