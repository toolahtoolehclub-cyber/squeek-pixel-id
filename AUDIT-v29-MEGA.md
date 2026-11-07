# AUDIT — v29 MEGA (2026-11-07)

Basis: v28 FIX. Semua upgrade P1–P4 dari analisis 72 screenshot + 4 tambahan,
dibangun dalam satu pass. Semua client-side, localStorage saja, Rp0, tanpa server,
tanpa transaksi. Aturan kejujuran v27 tetap berlaku: roda hanya dari API,
fallback 128 BPM selalu dilabeli OFFLINE.

## Yang baru

### P1 — LIVE RACE vs Squeektoshi
- Mode RACE (tombol ke-4 di modeRow, deep link `?race=1`). Tempo lagu = tempo
  roda live, sama seperti LIVE (100 + RPM, maks 180; offline = fallback 128 BPM).
- Balapan nyata: jarak pemain tumbuh dari pukulan (PERFECT 1,0 m / GREAT 0,7 m /
  GOOD 0,4 m); jarak Squeektoshi = jarak roda live sejak lagu dimulai
  (`liveSnapshot.dist - startDistKm`, dalam meter). HUD balapan di panel game
  (dua bar + jarak meter), diperbarui tiap 500 ms. Menang = +50 XP.
  Kalau roda offline, jarak lawan 0 dan baris hasil menulis "(WHEEL OFFLINE)".
- Golden Note: saat batas ronde 10 menit terlewati di tengah lagu, not berikutnya
  yang belum dinilai berubah emas (digambar emas + garis putih), bernilai
  +1000 pts dan +5 m. Batas ronde dihitung dari jam dinding, deterministik.
- Menu pet: baris `petLine` di raceBox — RUNNING xx RPM / NAPPING (0 RPM) /
  WHEEL OFFLINE — diperbarui tiap poll. `raceLast` menampilkan hasil balapan
  terakhir dari localStorage.

### P2 — Wheel Call (Prediction) + Achievements
- Ronde 10 menit (`roundKeyFor` membulatkan ke :00/:10/:20…). Klasifikasi:
  NAP < 5 RPM, JOG 5–69 RPM, ZOOMIES 70+ RPM.
- Setiap fetch roda (poll menu 30 detik + poll live/race 5–10 detik) merekam
  satu sampel RPM untuk ronde berjalan (`sqk29:samples:<roundKey>`, maks 120).
- Pemain menebak ronde BERIKUTNYA (tombol NAP/JOG/ZOOMIES, tersimpan per wallet).
  Saat ronde berakhir, `settlePredictions()` menghitung rata-rata sampel:
  tebakan benar = +40 XP; tanpa sampel (halaman ditutup) = "NO DATA", tanpa
  XP yang hilang. Penyelesaian idempotent dan berjalan saat load + tiap poll.
- Achievements: 10 bernama (FIRST STEPS, PERFECT 30, COMBO 100, ZOOMIES RIDER,
  RACE WINNER, ORACLE, WEEK STREAK, GOLDEN, VOID WALKER, MIRROR MASTER),
  tersimpan per wallet, ditampilkan sebagai chip di menu dan satu baris di ID Card.

### P3 — Duel League + kartu hasil
- `duelLink()` sekarang membawa `&from=<wallet pendek/GUEST>&score=<skor>`.
  Saat penerima membuka link dan menyelesaikan lagu, hasilnya dicatat ke
  `sqk29:league:<wallet>` (maks 20, ditampilkan 8 teratas diurutkan skor).
  Catatan jujur: skor dibawa di dalam link itu sendiri (tabel lokal antar teman).
- Tombol SHARE RESULT CARD di panel hasil: menggambar kartu hasil ringkas
  (grade besar, pasangan label/nilai dari resultKv, creator, domain) ke
  canvas ID Card, lalu DOWNLOAD/SHARE yang sudah ada bekerja di atasnya.

### P4 — OBS overlay, EN/ID, While-You-Were-Away + diary
- `?overlay=1`: mode overlay — `ui-layer`, background, dan splash disembunyikan;
  `#overlayBox` transparan menampilkan RPM, jarak, klasifikasi ronde +
  hitung mundur, dan lagu terakhir; poll 5 detik. Tombol OBS OVERLAY LINK
  menyalin URL overlay (untuk OBS Browser Source).
- Toggle EN/ID (tombol EN di header): 19 label menu statis diterjemahkan
  (wallet, genre, difficulty, mode, tombol utama, judul kotak). Pesan dinamis
  di dalam game tetap Inggris — batas yang diketahui, bukan bug.
- While-You-Were-Away: sekali per pemuatan halaman — kunjungan terakhir,
  streak, skor terbaik, achievements baru sejak kunjungan lalu. Diary:
  setiap lagu (non-practice) tercatat (tanggal, lagu, skor, grade); 5 terakhir
  ditampilkan; input catatan menempel ke entri terakhir (maks 120 karakter,
  di-escape dari HTML).

### Tambahan tajam
- Weekly Boss: lagu mingguan deterministik (ISO week, `BOSS-<week>`), selalu
  HARD, genre dari hash minggu; tombol FIGHT WEEKLY BOSS langsung main;
  selesai = +100 XP + baris "WEEKLY BOSS — DEFEATED ✓".
- Fever: combo 30+ = skor ×1,5 (tag 🔥 FEVER di panel game), berakhir saat
  combo putus (miss).
- Streak Freeze: menyelesaikan 3/3 misi harian dalam satu hari = 1 freeze
  (maks 2, ditampilkan di dailyBox). Melewatkan tepat 1 hari memakai 1 freeze
  dan streak tetap naik; melewatkan 2+ hari tetap reset.
- Practice: toggle 60% tempo (semua waktu lagu diskalakan 1/0,6, kecepatan
  jatuh not ikut 60%), tanpa XP/streak/history/misi/liga/diary/achievement;
  panel hasil menulis "PRACTICE RUN — NO XP".

## Bug yang diperbaiki dalam pass ini
- **Bonus XP yang hilang sejak v26**: baris `xpGain` menaruh bonus akurasi /
  no-miss / misi di belakang `//` sehingga tidak pernah jalan (XP hanya
  score/30). Dipulihkan di v29 dengan divisor 30 tetap dipertahankan, plus
  bonus race (+50) dan boss (+100). Pemain akan naik level lebih cepat dari
  v26–v28 — itu yang dimaksud semula.
- `freezeLine` ditambahkan di HTML tanpa pengisi — sekarang `renderDailyBox()`
  mengisinya dengan jumlah freeze.

## Tes — 63/63 lolos (`/tmp/v29-mega-test.js`)
Fungsi asli diekstrak dari script.js dan dijalankan dengan stub localStorage /
document: flooring ronde 10 menit, ambang klasifikasi (4,9/5/69,9/70), ISO week
(2026-01-01 = W01, minggu yang sama = kunci sama), weeklySpec deterministik,
liveBpm (0→100, 71→171, cap 180), raceOppDist (2,6−2,5 km = 100 m; offline = 0),
duel link (from + score + lanes + mirror; GUEST), i18n (semua key data-i18n ada
di en dan id), 10 achievements (cek positif/negatif tiap kondisi), rumus XP
(3000 pts / acc 96 / 0 miss / 2 misi / race win = 280), fever ×1,95 di combo 30,
skala practice, regresi v28 (offset clamp, dailySpec 2026-11-07 = CHIP/HARD,
daily tidak pernah VOID dalam 100 hari, tabel UNLOCKS), wiring (semua target
bindClick ada di HTML; semua id dinamis v29 direferensikan JS).
`node --check script.js` OK.

## Batas yang diketahui
- Prediksi hanya bisa diselesaikan kalau halaman terbuka selama ronde itu
  (sampel direkam saat halaman terbuka). Ronde tanpa sampel = NO DATA.
- Liga duel mempercayai skor di dalam link (bisa diedit manual oleh pengirim).
- Toggle bahasa hanya label menu; pesan game dinamis tetap Inggris.
- Tidak ada leaderboard global / fitur on-chain / taruhan — sengaja tidak dibuat.
