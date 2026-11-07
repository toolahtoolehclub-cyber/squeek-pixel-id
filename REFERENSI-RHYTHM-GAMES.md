# Referensi Desain — Upgrade Menyeluruh Squeek Pixel ID (riset saja, tanpa build)

Riset oleh subagent, 2026-11-07 ~16:17 WIB, untuk v33. Ringkasan pola dari
game rhythm besar (Guitar Hero, Beat Saber, osu!, Phigros, Cytus II, DDR)
dan benchmark animasi web 2025–2026.

## 1. Layar Hasil — pola dari game besar

Struktur universal (Phigros, Cytus II, osu!, Beat Saber, DDR): hierarki
3 lapis — (a) GRADE raksasa di tengah/atas, (b) skor + akurasi, (c)
breakdown judgement. Grade adalah "piala"-nya, sisanya data pendukung.
- Phigros: grade huruf besar berwarna, skor 7 digit, "NEW BEST" + selisih
  skor lama, MAX COMBO, akurasi %, breakdown Perfect/Good/Bad/Miss, plus
  Early/Late count. Premium karena grade punya warna & bentuk khas per
  tier, dan skor lama vs baru ditampilkan berdampingan.
- Cytus II: lingkaran gauge besar berisi grade + TP %; BEST SCORE di kiri,
  badge FULL COMBO diamond di kanan; breakdown di bawah; tombol AGAIN /
  SHARE / NEXT di tepi. Pelajaran: satu elemen hero melingkar jauh lebih
  elegan daripada kotak tabel — badge pencapaian dipisah sebagai "medali".
- Beat Saber: rank dari akurasi, bukan skor mentah (SS ≥90%, S 80–89%) —
  lebih adil dan mudah dipahami.
- DDR: "NEW RECORD!!!!" yang berteriak + Groove Radar (grafik radar 5
  sumbu) membuat layar hasil terasa seperti sertifikat, bukan spreadsheet.
- osu!: hasil di atas background artwork lagu (bukan hitam polos).
- Yang membuat layak dibagikan: (1) skor count-up, (2) grade muncul
  dengan scale-pop + glow, (3) badge "NEW BEST", (4) satu tombol SHARE
  yang menghasilkan gambar, (5) karakter/avatar kecil di sudut.
- Kartu shareable: rasio vertikal 9:16 atau 1080×1080; isi minimal:
  header game, nama lagu + difficulty, grade BESAR berwarna, skor,
  akurasi, max combo, breakdown 1 baris, footer kecil (nama pemain +
  tanggal + URL). Branding cukup satu baris kecil di bawah.

## 2. ID Card Pemain — ringkas & elegan

Prinsip: kartu profil yang bagus itu padat, bukan besar (Steam profile
card, FIFA/FUT player card): avatar + nama + rank di atas; 3–4 stat kunci
grid 2×2; satu bar progres (XP/level); sisanya di balik "Details ▾".
Hindari kotak kosong besar (>30% kartu): isi dengan avatar besar, grid
stat 2 kolom, progress bar tipis, deretan badge kecil. Pola tutup:
tombol × di pojok + tap di luar menutup; atau bottom sheet yang bisa
di-swipe; setelah ditutup tersisa chip ringkas (avatar kecil + nama +
level). Wallet cukup truncated satu baris. "CREATOR:" tidak perlu ada di
kartu pemain sama sekali; cukup di footer situs sekali.

## 3. Efek Visual Saat Main — murah vs mahal (HP)

Aturan emas: yang murah = animasi properti transform dan opacity saja
(jalan di compositor thread, tetap mulus walau JS sibuk). Yang mahal =
animasi width/top/left/margin/box-shadow (layout+paint tiap frame) dan
tulis DOM per frame.
- Murah: hit burst (scale 1→1.6 + fade 150–250 ms), lane flash (opacity
  overlay), judgement popup (scale-pop + fade 300 ms, warna per
  judgement), combo pop tiap 10/25/50, background pulse (transform/
  opacity satu layer), Fever/Star Power (ganti class CSS), particle pool
  tetap ~30–96 partikel yang dipakai ulang.
- Mahal (hindari saat main): WebGL fullscreen shader jalan terus,
  blur/filter per frame, menulis style.height/width tiap frame.
- Guitar Hero saat note kena: note meledak (flame burst) di garis hit
  dan hilang, streak naik, multiplier naik tiap 10 streak, miss = note
  lewat utuh + kilat merah + streak reset. Feedback harus di garis hit,
  instan, dan berani.
- Tambahan murah yang terasa "mahal": hitstop mikro 30–50 ms saat
  PERFECT di combo tinggi, haptic 10–15 ms, lane "bernapas" ikut beat.

## 4. Variasi Lagu Prosedural

Skala = mood (9+ skala di game prosedural): major (ceria), natural
minor/aeolian (melankolis), dorian (misterius-hangat), mixolydian
(progresif), lydian (melayang/ajaib), harmonic minor (angker), major
pentatonic (riang), minor pentatonic (blues/rock), whole-tone
(aneh/mimpi). Identitas ritme: motif berulang (frasa 2 bar yang kembali
tiap 4 bar dengan variasi kecil) + struktur intro → build → verse →
chorus → break → outro, chorus lebih padat/keras. BPM sebagai genre:
84–100 chill, 100–120 pop/groove, 120–140 dance/energetik, 140–180
intense/boss. Chart mengikuti melodi (lane naik saat nada naik). Nama
lagu dari seed: kombinasi skala+mood ("Neon Dorian", "Void Waltz").

## 5. UX Mobile

Setting saat main: tombol pause selalu terlihat; pause membuka menu
overlay (volume, kualitas grafis, kalibrasi, mute, keluar) tanpa kembali
ke menu utama. Auto-fit: PLAY → scrollIntoView + kunci halaman (100dvh,
overflow hidden, touch-action none). Statistik tidak boleh terpotong:
font mengecil otomatis (clamp / tabular-nums) atau format ringkas
(58.4%, skor 53.380 dengan pemisah ribuan). Target sentuh minimal
44×44 px. Satu layar, satu tugas: saat main hanya HUD + highway + pause.

## Prioritas (single-file, tanpa server)

1. P0 — setting saat main, auto-scroll, HUD tidak terpotong.
2. P1 — layar hasil premium: grade raksasa + count-up + badge NEW BEST
   + breakdown 1 baris + SHARE menghasilkan gambar 1080×1350.
3. P2 — efek hit murah (sudah ada di v33).
4. P3 — ID Card ringkas (sudah ada di v33).
5. P4 — variasi lagu: skala (sudah ada di v33: 10 skala), motif
   berulang, struktur lagu, nama lagu dari skala+mood.
6. P5 — background artwork di layar hasil, Fever visual, karakter
   hamster kecil di sudut layar hasil.

## Status vs v33 (sudah live)

Tercakup di v33: P0, P2, P3, sebagian P1 (grade + breakdown + kartu
gambar), sebagian P4 (10 skala). Belum: count-up skor, badge NEW BEST
di kartu, motif berulang 2-bar, struktur intro→chorus→outro, nama lagu
dari skala+mood, background artwork di layar hasil, chibi hamster.
Kandidat v33.1 (setelah smoke test v33).
