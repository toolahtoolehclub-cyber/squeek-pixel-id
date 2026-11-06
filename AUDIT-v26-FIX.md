# AUDIT v26 FIX — dari v25 ULTIMATE + v24 RETENTION

Basis: file upload v25 (`index_9_4k4k.html` / `style_10_ypac.css` / `script_11_mjrr.js`), 2026-11-06.
Verifikasi: `node --check script.js` OK. Semua ID yang dipakai JS ada di HTML (0 missing).
Tes HP 2026-11-06 21:36 WIB (file tes tombol+audio): AudioContext `running`, WebGL OK, clipboard BERHASIL — jadi kegagalan v25 bukan kemampuan HP, melainkan pilihan kode v25.

## Yang diperbaiki (7 keluhan)

1. **Intro tidak bunyi** — v25: sawtooth 50 Hz, speaker HP tidak bisa bunyi di 50 Hz. v26: triangle 220 Hz (modulasi 220±60 Hz, filter 1200 Hz), plus indikator `INTRO: ON` di menu. `stopIntroMusic()` race-safe: instance lama ditangkap di variabel lokal, `setTimeout` tidak lagi membunuh intro baru. `toggleMute()`: unmute di tengah game tidak lagi menyalakan intro di atas lagu.
2. **Audio gameplay** — jalur `schedule`/`tone`/`kick` dipertahankan (tes 1-2 bunyi jelas). Ditambah status terlihat di game: `#gameAudioStatus` = `AUDIO: RUNNING • BPM • AC state`.
3. **Background diam** — shader: `normalize(uv)` di tengah layar (0,0) dijaga dari NaN. Ditambah `#glStatus` terlihat di menu: `WEBGL: OK/GAGAL • QLTY: … • BACKGROUND: …`. Kalau WebGL gagal, grid CSS tetap bergerak sebagai fallback yang terlihat.
4. **Avatar gepeng** — CSS `spin3D` di wrapper DIMATIKAN. Preview avatar diputar di DALAM canvas (`startPreviewSpin`: `scaleX = cos(angle)`, redraw `avatar()` yang deterministik). Kartu dikembalikan ke `.canvas-wrapper` biasa 400x600 — tidak muter, tidak gepeng, teks terbaca. CSS `#avatarLabel` dikembalikan.
5. **Daily tidak merespons** — logika `setMode`/`renderDailyBox` dipertahankan, ditambah: pesan besar `DAILY AKTIF — YYYY-MM-DD` + `dailyBox.scrollIntoView()` saat diklik.
6. **Duel Link mati** — akar masalah: `say()` menulis ke `#message` di mainPanel yang tersembunyi saat resultPanel tampil. v26: feedback ditulis ke `#duelMsg` + link selalu tampil di `#duelOut` (textarea, di dalam resultPanel), clipboard dicoba dulu, gagal pun link tetap bisa dicopy manual.
7. **QLTY tidak berguna** — `setQuality()` kini menambah class `body.hemat` (background berubah jelas walau WebGL mati), update `#glStatus`, dan pesan `QLTY: ULTRA/HEMAT` yang terlihat.

## Yang dipertahankan dari v24/v25

Daily Anthem + streak, XP + level avatar, 3 misi harian, mastery 10 game, duel link `?challenge=`, WebGL shockwave/glitch/combo, CRT, PRECISION meter, visualizer, hue anthem. BARS tetap 32 (v25).

## Satu penyesuaian sengaja

XP: `score/20` → `score/30`. BARS 32 bikin skor lebih besar dari BARS 20; tanpa ini leveling makin cepat dari v24 yang saja sudah cepat.

## Kredit pencipta (update 2026-11-06 22:34 WIB)

User: tambah kredit pencipta dengan kode xixaxxuxa di bagian bawah v26. Diterapkan: footer "CREATED BY @xixaxxuxa" (link ke https://x.com/xixaxxuxa, target _blank, rel noopener, gaya pixel cyan + garis bawah pink, hover kuning) dan di ID Card "CREATOR: @xixaxxuxa" di atas baris UNOFFICIAL DATA. Saran: jangan tambah alamat wallet di kredit, dan jangan klaim afiliasi resmi — cukup nama + link X.

## Musik pembuka — 2 mode (update 2026-11-06 22:28 WIB)

User: versi lembut "masih kurang seru". Solusi bukan tebak lagi: 2 mode musik pembuka, default SERU. SANTAI 100 BPM (triangle, pad, kick lembut — versi sebelumnya) dan SERU 128 BPM (square catchy, power chord, bass sawtooth, kick 0/4/8/12/14, snare, hat). Splash punya 2 tombol (SERU / SANTAI) dan menu punya tombol MUSIK: ... untuk ganti dengan 1 ketuk kapan saja. Gameplay tetap punk.

## Musik pembuka (update 2026-11-06 22:26 WIB)

User: musik awal buka kurang enak. Intro punk 152 BPM diganti HANYA di pembuka: 100 BPM, lead triangle arpeggio C major pentatonik nada panjang, bass triangle, pad chord C mayor mengambang, kick lembut tiap 8 langkah, hat sangat pelan, tanpa sawtooth/power chord/double-kick. Nyaman didengar terus di menu. Gameplay tetap punk seru, jingle hasil tetap.

## Musik semua bagian (update 2026-11-06 22:13 WIB)

Atas permintaan user: musik di SEMUA bagian diganti lebih seru/enak ala pixel cyberpunk punk. Intro 140 → 152 BPM, riff lead dengan nada diulang, power chord (kwint sawtooth di atas lead), bass sawtooth, double-kick di akhir bar, hat tiap ketukan ganjil. Gameplay (semua difficulty): lapisan punk di atas drum anthem — bass 8th-note sawtooth + riff lead dari scale anthem tiap 2/6/10/14 dengan power chord, hit note diganti sawtooth lebih keras. Hasil: jingle fanfare — SS/S naik penuh 6 nada, A/B 4 nada, C/D 3 nada turun.

## Background bergerak (update 2026-11-06 22:05 WIB)

Grid v25 hampir tidak terlihat (opacity 0.05, 20 detik) — itu sebabnya background terasa statis. v26: grid opacity 0.14, animasi 8 detik, plus lapisan baru `#bg-anim` murni CSS ala file tes: 2 orb cahaya (hijau + pink) melayang 12-14 detik dan 1 garis sweep cyan turun tiap 6 detik. Lapisan ini jalan walau WebGL mati — tidak bisa "gagal diam" seperti background 3D. Mode HEMAT (QLTY) menyembunyikannya, sesuai janji tombol itu.

## Musik intro (update 2026-11-06 22:03 WIB)

Drone triangle 220 Hz diganti loop chiptune cyberpunk 140 BPM: lead square A minor 16 langkah, bass triangle, kick/snare/hat, semua nada 220 Hz ke atas. Musik TIDAK bisa bunyi sebelum ketukan pertama — browser memblokir autoplay suara. Jadi saat dibuka muncul splash besar `[ ▶ TAP UNTUK MUSIK ]`; satu ketukan itu langsung menyalakan loop, dan loop bunyi terus di menu sampai game dimulai / mute. Selesai main atau keluar, loop nyala lagi.

## Yang TIDAK diperbaiki di v26 (jujur)

- Retensi masih 100% localStorage (hilang kalau clear cache/ganti browser, bisa diedit manual). Tidak ada server/leaderboard.
- Daily masih sama antar-user hanya bila genre + difficulty sama.
- XP LV5–LV8 masih tanpa unlock baru (mahkota mentok di LV4).
- Tidak ada kalibrasi offset untuk PRECISION meter.

## Cara tes di HP

1. Buka `index.html` (satu folder utuh, jangan campur dengan v25).
2. Ketuk wallet → Daily harus muncul banner + scroll. Main sampai selesai → hasil harus ada +XP, misi, dan Duel Link dengan link terlihat di kotak.
3. Ketuk QLTY → background + status di atas harus berubah jelas. Generate Card → kartu harus diam, terbaca, tidak muter.
