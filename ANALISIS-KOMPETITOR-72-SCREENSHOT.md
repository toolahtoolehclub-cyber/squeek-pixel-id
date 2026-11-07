# Analisis 72 Screenshot Discord #project-submissions — Upgrade Squeek Pixel ID

Tanggal analisis: 7 Nov 2026, 12:30 WIB.
Sumber: 72 screenshot channel Discord #project-submissions (kirim user bertahap, 8 batch).
Fokus: apa yang bisa kita kembangkan lagi untuk Squeek Pixel ID (v27 LIVE, squeekpixel.web.id).

## 1. Lapangan: ~40+ proyek unik

Kategori yang muncul berulang:

- **Ritme / balapan vs hamster**: Race Squeektoshi, Squeek Pixel ID (kita), Squeek Wheel Rush, Squeek Runner, Squeekrun.
- **Prediksi roda**: Wheel Call, Squeek Wheel Oracle, Wheel Odds, Squeek Pot (lotre Chainlink VRF), SqueekFun (papan mining 25 kotak), pheonixscribe (tebak jarak malam), Fantasy Hamster (fantasy harian).
- **Garden / idle**: Squeek Garden (3 varian), Squeek Sprouts, Squeek Den (idle + raid), Squeek Forest Seedkeeper.
- **Cerita / taktik harian**: Wheelbound (kartu taktik + boss mingguan), Squeek Colony / Wheelhold (pilih aksi per ronde), Squeek Survival (lawan Robo-Squeek).
- **Companion / diary**: Squeek Pet (desktop pet), Squeek Diary (diari harian hamster), Squeek Life (life sim + terrarium).
- **Generative art**: Wheelprints, Squeek Spin Art (lukisan tiap malam), Wheel Canvas (1.263 wallet ikut), Wheel-archive.
- **Dashboard / tools**: Squeek Radar, SqueekScope, Squeek Pulse, Squeek Explorer, Health Monitor, Analytics, Squeek Viewer, Squeek Appraiser, SqueekMatch, Squeekswap, squeekpad, quadConnect, Burrow, Avian vault.
- **Streamer tools**: Squeek Studio, WheelCam, SqueekPulse (overlay OBS 3D), Wheelbound + Fantasy Hamster (overlay OBS).
- **Lainnya**: Squeek Keeper (alert merge/claim), Turing Wheel (komputer yang clock-nya hamster), Squeek Hatchery (tetaskan hamster dari telur), Squeek Glide (RPM = kecepatan scroll), Squeek Dome (workbench Sepolia), Squeek's First Road Trip, Wheel Raid (boss raid co-op), Squeeky Market (prediction market), SqueekClicker.

## 2. Pola pemenang (yang dimiliki proyek-proyek terkuat)

1. **Data live menggerakkan gameplay inti, bukan hiasan.** Yang kuat: RPM mengatur tempo/kecepatan/kesulitan (Race Squeektoshi, Squeek Glide), ronde 10 menit yang sudah settle menentukan hasil (Wheelbound, Squeek Garden, Fantasy Hamster). Yang lemah: dashboard yang cuma menampilkan angka.
2. **Tanpa gesekan: no wallet, no token, no signup.** Diulang puluhan kali sebagai nilai jual ("no wallet, no token, no signup or backend, free to play"). Wallet hanya opsional (tampil di leaderboard, klaim).
3. **Ada alasan kembali tiap hari.** Ronde 10 menit, daily champion (Hamster Run tulis juara harian on-chain 00:00 UTC), diari harian (Squeek Diary), kartu taktik harian yang sama untuk semua orang (Wheelbound), streak + personal best di browser (Fantasy Hamster).
4. **Loop sosial / berbagi.** Share link (Fantasy Hamster: roster jalan lewat link; kita: duel link), leaderboard (tamu atau wallet), overlay OBS untuk streamer (5+ proyek punya ini — streamer adalah audiens nyata).
5. **Jujur soal batas.** Label demo/offline jelas (Squeek Studio: "clearly labelled demo modes"; Squeek Forest: offline practice dipisah dari data chain asli; Squeek Diary: kalau API mati, tampilkan data terakhir yang bagus, jangan blank). "Naps are normal and healthy, no pressure on the hamster" — hampir jadi semboyan komunitas.
6. **Kosakata bersama: Nap / Jog / Zoomies.** Klasifikasi ronde 10 menit ini dipakai Fantasy Hamster (kartu Beauty Sleep, Day Off), Squeek Garden (Moonmoss tumbuh saat nap, Zoomflowers mekar saat zoomies), Squeek Sprouts. Pemain sudah paham bahasa ini.

## 3. Posisi kita sekarang (v27 LIVE)

Sudah kuat:
- Ritme + LIVE (tempo dari roda asli, ZOOMIES ×2, tema siang/malam, HUD live) — sudah masuk pola #1, tapi baru di level tempo.
- Daily Anthem + streak, XP LV1–LV8, misi harian, duel link, ID Card, fallback OFFLINE yang jujur — sudah masuk pola #3 dan #5.
- Tanpa wallet wajib, tanpa transaksi — pola #2 terpenuhi.

Masih tipis dibanding lapangan:
- LIVE belum jadi "lawan" yang terasa (bandingkan Race Squeektoshi: hamster adalah lawan balapan dengan pace yang kelihatan).
- Belum ada lapisan prediksi (genre paling ramai di lapangan).
- Belum ada achievement bernama (Nap-or-Sprint punya Night Owl, Hat Trick, Ten Streak, Bracket Master, Beat the Professor).
- Belum ada leaderboard/kompetisi antar pemain di luar duel 1 lawan 1.
- Belum ada mode streamer (overlay OBS) dan belum ada toggle bahasa (SqueekPulse 8 bahasa, Squeek Garden 6 bahasa).
- Tiga utang lama belum lunas: Daily sama hanya jika genre+diff sama; LV5–LV8 tanpa unlock; tanpa kalibrasi offset PRECISION (Squeekrun v0.4 justru menonjolkan optimasi mobile + kontrol sentuh).

## 4. Saingan langsung: Race Squeektoshi

Satu-satunya proyek lain yang menggabungkan ritme + roda live. Konsepnya: kecepatan roda live menentukan pace lawan (Squeektoshi), pemain harus mengimbanginya. Tanpa wallet, bisa dimainkan di HP/desktop, semua angka data Squeekchain asli. Keunggulan kita atas dia: kita sudah punya Daily, XP, misi, duel link, dan ID Card — dia murni balapan. Kelemahan kita: mode LIVE kita belum memvisualkan hamster sebagai lawan.

## 5. Rencana upgrade (peringkat)

Semua di bawah ini bisa dikerjakan client-side (localStorage + API publik read-only), tanpa server, Rp0 — sesuai batas proyek ini.

### P0 — Lunasi utang lama (murah, terasa langsung)
- Kalibrasi offset PRECISION (pengaturan ms, disimpan per perangkat) — ini perbaikan "rasa" main di HP.
- Daily konsisten penuh: lagu harian sama untuk semua pemain di hari yang sama (genre+diff ikut di-seed).
- Unlock LV5–LV8: tiap level buka sesuatu nyata (mis. LV5: genre baru, LV6: lane ke-4, LV7: mode Mirror, LV8: skin avatar emas).

### P1 — v28: LIVE Race (yang paling besar)
- Ubah mode LIVE jadi balapan sungguhan vs Squeektoshi: dua bar jarak (kamu vs hamster), pace hamster dari RPM live, jarak hamster dari distanceMm live. Menang/kalah ditentukan di akhir lagu. Nama mode sudah "Race the Hamster" di kode — tinggal dibuat literal di layar.
- Golden Note: saat ronde/settled block baru tiba di tengah lagu, muncul note emas (double poin 8 detik — pola Squeek City / Squeek Glide).
- Pet menu: hamster pixel di menu yang berlari/tidur mengikuti roda live (pola Squeek Pet).

### P2 — Prediksi + Achievement
- "Wheel Call" di dalam game: sebelum lagu, tebak ronde 10 menit berikutnya (Nap/Jog/Zoomies). Hasil dibaca dari API saat ronde settle; tebakan benar = bonus XP/multiplier. Disimpan di localStorage, tanpa server.
- Galeri achievement bernama: Zoomies Hunter (menang lagu saat ZOOMIES), Night Owl (main 00:00–05:00), Perfect Run (akurasi 100%), Duel Master (menang 5 duel), Marathon (10 lagu sehari). Tampil di ID Card.

### P3 — Sosial
- Duel League: tabel rival lokal — hasil duel dari link duel tersimpan dan dibandingkan otomatis (tanpa server). Leaderboard global asli butuh server atau transaksi on-chain: JANGAN dijanjikan tanpa salah satunya.
- Kartu hasil PNG tiap lagu (skor, grade, statistik LIVE WHEEL) siap posting ke X — sekali ketuk, seperti ID Card.

### P4 — Jangkauan
- Mode overlay OBS (`?overlay=1`): tampilan transparan minimal (RPM, BPM, skor, siang/malam) untuk streamer.
- Toggle bahasa EN/ID.
- "While you were away": saat kembali, ringkasan apa yang dilakukan hamster sejak kunjungan terakhir (dari snapshot localStorage) + diari harian mini (pola Squeek Diary).

### P5 — Jangan dulu / jangan
- Leaderboard global, fitur on-chain (butuh server/gas) — di luar batas Rp0 + statis.
- Klon garden/idle — bukan identitas kita; ritme adalah identitas.
- Fitur taruhan uang asli / token reward — melawan norma komunitas (free, no wallet pressure).

## 6. Jebakan dari screenshot (catatan review)

- **Antrean review panjang itu normal.** Proyek yang disubmit 1 Nov masih "In Review" 5 Nov; ada yang terverifikasi tapi badge belum datang. Review kita yang masih menunggu bukan tanda ditolak.
- **Jangan edit listing Genesis.** Kasus Squeek Wheel Watch: mengedit listing membuat proyek kembali ke antrean review. Update situs/repo saja (URL submission tidak berubah) — aman.
- **Direct submissions kabarnya sedang paused** (info dari salah satu post). Submission kita sudah masuk sebelum itu — jangan diutak-atik, jangan submit ulang.
- **Auto-review bisa gagal karena repo tidak kebawa** (kasus Squeek Keeper v1: IMD tidak mengirim repo). Kita tidak pakai IMD, repo GitHub kita sudah publik dan tertaut — aman.
- **Jangan kejar fitur berbayar.** Semua yang di atas Rp0 dan tanpa server.
