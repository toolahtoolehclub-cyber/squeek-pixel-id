# AUDIT v43 REVOLUTION — Squeek Pixel ID

Tanggal: 2026-11-09 ~09:30 WIB. Basis: v42.5.4 (head `accbdb3d`). Worker TETAP v13.
Permintaan user 2026-11-09 ~08:48 WIB: kebebasan penuh ("lakukan yang kamu suka") —
kartu wallet rapi, background hidup, musik baru, tampilan keseluruhan lebih elegan.
Tambahan parent 09:01 WIB: pesan resolve kapsul menampilkan rarity dua kali
("Kapsul #102 (rare) (rare) ✓") — diperbaiki di rilis ini.

## Yang berubah (4 bagian)

### 1. Kartu wallet baru (index.html + script.js `updateConnectBtn` + style.css `.wallet-card`)
- SATU bar kaca ringkas: dot status + alamat singkat + [ CONNECT ] + [ ALAMAT ] + salin + ✕ putuskan.
- Label PENDEK: CONNECT/HUBUNGKAN, ADDRESS/ALAMAT (bukan "CONNECT WALLET").
- Alamat tampil `0x8853…cf9a` (fungsi `shortAddr()`), tombol salin (clipboard + fallback execCommand, feedback ✓ 1,2 dtk).
- Status: dot abu = tamu/manual, hijau berdenyut = terhubung, cyan berdenyut = restoring, amber = gagal restore.
- Saat terhubung tombol CONNECT HILANG (bukan berubah teks), baris status ramping "● 0x8853…cf9a — TERHUBUNG".
- Teks panjang MANUAL HILANG — baris isi alamat kini tersembunyi by default, dibuka lewat [ ALAMAT ] saja, hint super singkat ("0x saja — jangan seed phrase." / "Manual — bukan koneksi.").
- Perilaku yang DIPERTAHANKAN (bukan dihapus): connect injected / WalletConnect modal, isi alamat manual,
  restore otomatis (enable() + preload bundle + watchdog 60 dtk), disconnect, lupa wallet (ME).
  Setelah disconnect, alamat tetap di field sebagai alamat manual yang diingat (dot mati, CONNECT tampil) —
  itu state yang disengaja, bukan bug (sama seperti v42.5.2, kini dengan semantik visual yang jelas).
- `setWcRestoreNote()` kini memanggil `updateConnectBtn()` supaya dot mencerminkan state restore.

### 2. Background hidup (script.js `bgBeatPulse`/`bgInitParticles`/`bgStepParticles` + CSS)
- Canvas `#bg-particles` (36 partikel, setengah resolusi, ~30 fps, drift ke atas, twinkle sinus).
- Denyut beat: `bgBeatPulse(level, combo, zoomies)` = audio×1,1 + 0,25 (combo ≥30) + 0,25 (ZOOMIES), dijepit 0..1,
  dihaluskan (lerp 0,85/0,15) → CSS var `--beat` mencerahkan aurora `#bg-anim` (brightness/saturasi) + mempercepat partikel.
- Orb ketiga violet (`.orb-v`, drift 16 dtk) bergabung dengan hijau + pink; dua light-well radial baru di `body`.
- WebGL blob ikut berdenyut di menu (`glAudio = max(glAudio, level)` saat intro berbunyi).
- Hemat performa: partikel dibekukan saat main (`body.playing` menyembunyikan layer — sama seperti freeze GL),
  saat tab tersembunyi, kualitas ECO, dan `prefers-reduced-motion`. Tidak ada layout thrash (transform/opacity saja).
- Efek pukulan: PERFECT → flash cincin hijau di `.canvas-wrapper` (`.hit-flash`, 0,18 dtk);
  combo 25/50/100 → burst emas di `#gamePanel` (`.combo-burst`); FEVER → chip COMBO menyala emas (`.stat.fever`).
  Pengecualian eksplisit: v32 membekukan SEMUA animasi saat main — `animation-play-state: running !important`
  untuk `.hit-flash` dan `.combo-burst` supaya efek tetap jalan.

### 3. Musik baru (hanya presentasi — chart & skor TIDAK berubah)
- Bus FX baru `initFxBus()`: delay dotted-eighth (0,27 dtk, feedback 0,32, wet 0,16) + reverb impuls sintetis
  (noise 1,1 dtk decaying, wet 0,12). Tanpa file, tanpa CDN.
- Suara baru: `toneFx` (lead + echo/reverb), `bassNote` (saw + sub-square via lowpass menyapu),
  `snareHit` (noise + body 180 Hz), `hatHit` (closed/open), `kick2` (drop 160→38 Hz + click),
  `hitTone` (saw pair detuned + echo, PERFECT dapat sparkle oktaf).
- Melodi baru per genre: `RIFF_PATTERNS` (cyber [7,5,4,7,5,3,2,4], synth [0,2,4,7,4,2,5,3],
  chip [0,4,7,4,2,5,7,4], void [0,1,3,5,6,5,3,1]) + `riffDegreesFor(genre, barNo)`.
- `schedule()` baru: kick2/snare/hat mengikuti beat, open hat langkah 14, bassNote, riff genre + echo,
  arp 16th pelan tiap langkah %4==0; jalur `soft` Lullaby: bass triangle, tanpa kick/riff/arp.
- Jingle menu baru (`scheduleIntro` + `INTRO_MODES`): santai — lead melengkung ke 84, bass berjalan 48-43-45-48
  + arp 8th pelan; seru — lead menanjak ke 86, bass 48-48-50-48/45-48-50-43.
- `playResultJingle` lebih kaya (lead echo + bassNote + kick2 + sparkle arp [93,96,100,105] untuk SS).
- `judge()` memakai `hitTone(target.midi, k)`; golden note memakai `toneFx(..., .7)`.
- BUKTI chart tidak berubah: engine.js BYTE-IDENTIK dengan v42.5.4; 14 chart golden identik;
  sapuan 60 kombinasi mode/diff/seed deterministik; judgement windows 0.045/0.09/0.135 + BREAK 0.185 tidak berubah.

### 4. Tampilan keseluruhan (style.css)
- `border-radius: 0 !important` pada `*` DIHAPUS — aturan itu diam-diam membunuh semua sudut membulat
  lapisan NEO v32 (panel, pill, tab). Desain kaca kini benar-benar membulat.
- Header: wordmark gradasi cyan→hijau→emas + drop-shadow; `h2` jadi pill; tagline gradasi.
- Panel kaca ditingkatkan: blur 18px saturate 160%, highlight atas 1px, bayangan 12px/40px.
- Transisi tab `tabIn` (fade + naik 6px, 0,22 dtk, replay tiap pindah tab).
- `.btn-primary`: gradasi bergerak saat hover (background-position).
- Panel hasil: animasi masuk `resultIn`, cincin glow radial di belakang grade, baris `.kv` ber-garis halus + radius 12px.
- Referensi (tanpa menyalin aset): Cytus II (input berkode warna, skor di sudut atas), Phigros (energi garis judgement),
  Arcaea (langit kaca), glassmorphism (light wells + frosted panel), Neon Arcade (ungu dalam / pink panas / cyan).

### Perbaikan kosmetik kapsul (parent, 09:01 WIB)
- `itemLabel` di resolve SQK tidak lagi mengandung rarity — template `sqkResolved`/`sqkDupKeju` sudah menambahkannya.
  Sebelum: "CAPSULE: Kapsul #102 (rare) (rare) ✓". Sesudah: "CAPSULE: Kapsul #102 (rare) ✓".
  Duplikat: "CAPSULE: Kapsul #102 (rare, DUPLICATE) → +50 🧀". Kapsul Keju sudah benar (nama tanpa rarity).

## Batas keras — dipatuhi
- engine.js / buildChart / simulate() / judgement windows / formula skor / format replay / Worker v13 TIDAK BERUBAH.
  engine.js dan worker.js byte-identik dengan v42.5.4 (dites).
- Tanpa dependensi/CDN baru (bundle WC tetap vendored lokal; 0 tag CDN).
- Tanpa file biner di push repo (PNG tetap di luar repo; Worker menyajikan /icon.png + /og.png).
- 3 bukti Genesis utuh (meta + README + DNS TXT — dicek di tes + verifikasi live).
- Board D1 tidak berubah (Genesis scores tetap 1 baris race 28280 verified).
- Semua fungsi lama tetap jalan: toko SQK + Keju, kapsul + self-healing v42.5.4, liga, Dream Seeds/Lullaby,
  duel, OBS, dsb. (suite lama hijau — lihat Tes).

## Tes — 2082 tes, 0 gagal
- TEST-v43.js BARU — 48/48: kartu wallet 5 state (belum connect / manual / restoring / terhubung / gagal),
  pulse background (0 / 0,55 / +0,25 combo / +0,25 ZOOMIES / jepit 1), riff 4 genre, suara baru ada,
  chart identik (byte + 14 golden + sapuan 60), pesan kapsul rarity sekali, panel hasil, bukti Genesis, tanpa CDN.
- TEST-v34-neo.js — 1813/1813 (diperbarui: pin versi → v43, README v43, stub audio baru hitTone/toneFx/comboBurst
  di harness judge, asersi connect → kartu v43, build-worker.sh → v43).
- TEST-v42.5.js — 144/144 (diperbarui: pin versi → v43, harness wallet + elemen kartu baru,
  asersi wallet → perilaku v43; disconnect meninggalkan alamat sebagai manual — by design).
- TEST-v42.5.3-ghost.js — 27/27. TEST-v42.5.4-capsule.js — 30/30. TEST-motif.js — 11/11.
- verify-icon-routes.js — 9/9 (path bundle diperbarui ke /tmp/v43-build; bundle di-rebuild).
- `node --check` bersih (script.js, engine.js, worker.js).
- README judul → v43 (bukti Genesis baris terakhir TIDAK disentuh).

## Catatan / sisa
- `build-worker.sh` diperbarui ke folder v43 + /tmp/v43-build (Worker v13 tidak berubah — hanya path).
- Verifikasi live independen oleh parent setelah push (judul v43, gameVersion, Worker GET / → version 13,
  3 bukti Genesis, board D1) + update artifact preview `squeekchain-v26-fix` → v43 (tugas parent).
- Yang TIDAK berubah dan tetap terbuka dari audit lama: validasi golden wall-clock belum lengkap;
  session binding belum anti-cheat absolut; jendela kecil di /dream/harvest; bonus Keju +500 grade S/SS
  belum pernah teramati live; minify sengaja dilewati; tap layar sentuh HP user belum terverifikasi.
