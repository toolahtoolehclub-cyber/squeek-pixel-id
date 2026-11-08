# AUDIT-v38

Batch 1 v38 (dari v37.2). Semua 8 tugas dikerjakan. Tidak ada perubahan judgement
windows, tempo, atau rumus skor. `node --check script.js` lolos. Tidak ada deploy
yang dilakukan (di luar lingkup pekerja ini).

## 0. Genesis proofs — UTUH (verifikasi akhir)

- `index.html:8` — `<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">`
  byte-identical, tidak disentuh (tag OG/Twitter disisipkan SETELAH baris ini,
  baris 9–17).
- `README.md:99` (baris terakhir) — `squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7`,
  tetap jadi baris terakhir.
- TXT DNS bukan di file ini — tidak disentuh.

## 1. Ekonomi XP (`script.js:373-380`)

`XP_LEVELS` lama `[0, 100, 250, 500, 900, 1500, 2500, 4000]` → baru
`[0, 700, 2000, 4300, 8500, 16000, 29500, 54000]` — LV8 = **54.000 total XP**
(dalam rentang 50.000–60.000 yang diminta). Total XP pemain yang sudah ada TIDAK
direset; `levelFor()` yang sudah ada membaca ulang angka yang sama terhadap
ambang baru.

Kurva (kumulatif → level, kenaikan per level):

| Level | Ambang | Kenaikan |
|------:|-------:|---------:|
| LV1 | 0 | — |
| LV2 | 700 | 700 |
| LV3 | 2.000 | 1.300 |
| LV4 | 4.300 | 2.300 |
| LV5 | 8.500 | 4.200 |
| LV6 | 16.000 | 7.500 |
| LV7 | 29.500 | 13.500 |
| LV8 | 54.000 | 24.500 |

Alasan: kenaikan tumbuh ~×1,8 tiap level (geometris, bukan lompatan) — level
awal jatuh dalam 1–2 lagu, level akhir benar-benar grind. Angka dikalibrasi
dengan simulasi nyata generator lagu (20 seed, `makeAnthem` asli, dijalankan
di Node): lagu NORMAL sempurna rata-rata ~165 not / ~119.700 poin /
**~4.070 XP** (skor/30 + bonus akurasi/no-miss/misi); EASY sempurna ~112 not /
~72.300 poin / ~2.490 XP; HARD sempurna ~205 not / ~155.800 poin / ~5.270 XP.
Lagu biasa (akurasi ~70%, kombo sering putus) ≈ 1.200–1.600 XP. Maka LV8 ≈
**13–14 lagu NORMAL sempurna, ~22 lagu EASY sempurna, atau ~35–45 lagu biasa**
— sesuai target tugas (15–20 sempurna / 30–50 biasa, dengan "sempurna" pada
campuran EASY/NORMAL).

Konsekuensi yang disengaja: pemain LV8 lama (4.000 XP) kini jadi **LV3**
(4.000 < 4.300 = LV4) — itulah yang dikompensasi badge LEGACY LV8 (§2).
Semua tempat yang menampilkan level/unlock tetap konsisten karena semuanya
membaca `levelFor()`/`playerLevel()` — tidak ada angka ambang XP yang di-hardcode
di tempat lain. Grep `2500, 4000` / `1500, 2500` / `/10` / `0/10`: **nol hasil**
(kecuali penyebutan historis "v32 NEO" di komentar `script.js:1603` dan nama file
`AUDIT-v32-NEO.md` di README — bukan ambang). Satu-satunya angka hitungan yang
diubah: baris kartu ID `script.js:1427` `'/10'` → `'/11'` (lihat §2).

## 2. Badge LEGACY LV8 (`script.js:1901-1943`, `1919`)

- Entri baru di `ACHIEVEMENTS`: `{ id: 'legacy8', name: 'LEGACY LV8', check: () => false }`
  (selalu false — pemain baru TIDAK bisa mendapatkannya dengan mencapai 4.000 XP).
  Kunci i18n `achLegacy8` ditambahkan ke `MSG` en (`script.js`, blok en) dan id
  (blok id). `renderAchievements()` yang sudah ada menampilkannya otomatis
  (chip `🏆 LEGACY LV8` bila ada di `sqk29:ach:<wallet>`).
- Migrasi `maybeMigrateLegacy8(w)` (`script.js:1930`): dipanggil di dalam
  `preview()` (`script.js:1540`) — artinya berjalan di setiap boot DAN setiap
  kali wallet dimasukkan kembali. Logika: bila marker per-wallet
  `sqk38:migrated:<walletKey>` belum ada → set marker + set kunci global
  `sqk38:migrated` (kunci spec) → bila `totalXP(w) >= 4000`, push `'legacy8'`
  langsung ke `sqk29:ach:<wallet>` (TANPA XP — tidak lewat `checkAchievements()`,
  jadi tidak ada +25 XP).
- Penyimpangan dari spec yang disengaja (didokumentasikan): spec menulis flag
  tunggal `sqk38:migrated`. Flag itu tetap di-set, TAPI guard utama dibuat
  per-wallet (`sqk38:migrated:<key>`). Alasannya: di load pertama v38 kolom
  wallet biasanya masih kosong (GUEST) — flag global saja akan mengunci migrasi
  sebelum wallet asli sempat diketik. Dengan guard per-wallet, wallet yang
  diketik belakangan tetap dicek sekali. Wallet yang pertama kali terlihat di
  bawah 4.000 XP di-mark dan TIDAK akan dapat badge belakangan (mencapai 4.000
  di kurva baru hanya LV3, bukan LV8 lama).
- Kartu ID: `script.js:1427` `'/10'` → `'/11'` (11 achievement total);
  `README.md` "10 named achievements" → "11 named achievements (10 earnable +
  LEGACY LV8, migration-only)".

## 3. Wallet diingat (`script.js:1550-1562`, `1577`, `1589`, `793`)

- Key `sqk38:wallet`. Disimpan saat: connect sukses (`eth_requestAccounts`,
  `script.js:1577`), `accountsChanged` (`script.js:1589`), kolom wallet
  `change`/`blur` (`script.js:1562`), dan saat play dimulai (`script.js:793`).
  Hanya alamat `isAddr()` yang valid yang disimpan.
- Saat load: kolom wallet diisi kembali dari key itu (`script.js:1551-1552`,
  tepat setelah `const walletEl`) — autofill saja, TIDAK pernah
  auto-`eth_requestAccounts`. `?wallet=` di URL tetap menang (kode boot di
  akhir file menimpanya). Karena `currentWallet()` membaca kolom input, nilai
  tersimpan otomatis menjadi wallet aktif.
- Tombol lupakan: `#forgetWalletBtn` di tab ME (`index.html:234`,
  `data-i18n="forgetWallet"`), handler `forgetWallet38()` (`script.js:1555`):
  hapus key, kosongkan kolom, re-render (preview/unlock/mastery/achievements/
  league/champs), `say(msg('walletForgotten'))`. Kunci i18n baru:
  `forgetWallet` (I18N en/id) + `walletForgotten` (MSG en/id).

## 4. Meta OG/Twitter (`index.html:7-17`)

- `index.html:7` meta description diperbaiki: "SQUEEKCHAIN v32 NEO …" →
  deskripsi v38 yang akurat ("pixel rhythm game on Squeekchain … Daily, LIVE
  and RACE … earn XP across 8 levels … global leaderboard").
- Baris 9–17 (setelah baris Genesis yang tidak disentuh): `og:title`,
  `og:description`, `og:image https://squeekpixel.web.id/squeekchain-headline-simple.png`,
  `og:url https://squeekpixel.web.id/`, `og:type website`,
  `twitter:card summary_large_image`, `twitter:title`, `twitter:description`,
  `twitter:image` (URL absolut yang sama).
- Bonus konsistensi versi (kosmetik): `<title>` → v38, `h2` → `PIXEL ID // v38`,
  footer → `• v38 •`.

## 5. Daily reset 19:00 WIB (`script.js:34-41` dan call sites)

`squeekTodayStr()` (`script.js:39`): tanggal UTC dari (waktu − 12 jam) — bila
jam UTC < 12:00, pakai tanggal UTC kemarin. Terverifikasi di Node:
`11:59 UTC → hari kemarin`, `12:00 UTC → hari ini`, `00:30 UTC → kemarin`.
19:00 WIB = 12:00 UTC = batas hari baru. Helper turunan:
`squeekYesterdayStr()` / `squeekTwoDaysAgoStr()` (`script.js:40-41`).

Keputusan tiap call site `todayStr()` (grep akhir, `script.js`):

| Call site | Keputusan |
|---|---|
| `seedKeyFor` daily/live/race (`:43-45`) | → `squeekTodayStr()` — lagu harian/live/race ikut hari Squeek |
| `dailySpec` default (`:411`) | → `squeekTodayStr()` — genre/diff harian ikut hari Squeek |
| `missionsDoneKey` (`:462`) | → `squeekTodayStr()` — misi harian ikut hari Squeek |
| `finish()` `dailyMissions(...)` (`:993`) | → `squeekTodayStr()` |
| Streak `st.last` + `yesterday/twoDaysAgo` (`:1016-1023`) | → `squeekTodayStr()` / `squeekYesterdayStr()` / `squeekTwoDaysAgoStr()` (freeze tetap bekerja: lewat tepat 1 hari Squeek) |
| `preview()` label anthemDaily (`:1544`) | → `squeekTodayStr()` |
| `renderDailyBox` judul/info/misi (`:1620-1625`) | → `squeekTodayStr()` |
| `setMode('daily')` banner (`:1747`) | → `squeekTodayStr()` |
| `recordChampion` tanggal (`:1839`) | → `squeekTodayStr()` — juara harian per hari Squeek |
| `roundKeyFor` (`:1787`) | TETAP `todayStr()` (kalender lokal) — bucket ronde 10 menit adalah jam dinding, bukan hari Squeek; dipakai juga oleh Wheel Call, Round History, dan filter "while you were away" yang semuanya berbasis jam dinding |
| `recordLeagueResult` tanggal duel (`:1977`) | TETAP `todayStr()` (kalender lokal) — tanggal duel, sesuai pengecualian tugas |
| Diary (`recordDiary`/`renderDiaryList`, `toLocaleDateString`) + `renderAway` last-visit | TETAP lokal — catatan pribadi, sesuai pengecualian tugas |
| `weeklyKey()`/boss mingguan | Tidak disentuh — mingguan ISO, bukan harian |
| `yesterdayStr()` / `twoDaysAgoStr()` | DIHAPUS (hanya dipakai streak; kini digantikan helper Squeek). Komentar penanda ditinggalkan di `script.js:35` dan `:1785`. |

Dampak migrasi data yang diketahui: streak/misi/champion yang tersimpan di
bawah tanggal kalender lokal tetap terbaca sebagai "hari lain" oleh kunci
Squeek — pemain yang main Daily sebelum 19:00 WIB di hari pergantian bisa
melihat streak/misi dihitung terhadap hari Squeek yang baru (perilaku ini
benar menurut definisi hari Squeek; tidak ada migrasi kunci lama karena
kunci lama memakai tanggal lokal yang tidak bisa dipetakan andal ke hari
Squeek tanpa jam main).

## 6. Menu pause sungguhan (`index.html:251-266`, `script.js:1072-1112`, `style.css` akhir)

- Overlay DOM `#pauseOverlay` (di dalam `#gamePanel`, `position: fixed`,
  `z-index: 35` — di bawah settings sheet 40/41): volume slider
  (`#pauseVolSlider` + `#pauseVolVal`, tersinkron dua arah dengan slider
  settings lewat `applyVol()` yang diperluas), tombol `[ CALIBRATE ]`
  (`#pauseCalibBtn`), `[ RESUME ]` (`#pauseResumeBtn`), `[ EXIT ]`
  (`#pauseExitBtn`).
- `pauseGame()` membuka overlay; `resumeGame()` menutupnya. Pause lama tetap
  jalan: `ac.suspend()` + auto-pause saat tab hidden (`visibilitychange`) +
  pause saat settings dibuka — semuanya masuk lewat `pauseGame()`/`resumeGame()`,
  jadi overlay ikut muncul.
- `[ CALIBRATE ]` (`pauseCalibrate()`, `script.js:1103`): overlay ditutup,
  game TETAP paused (audio tetap suspended), tampilan pindah ke tab ME
  (tombol TAP kalibrasi memang tinggal di sana). Tombol baru
  `[ BACK TO GAME ]` (`#backToGameBtn`, `index.html:220`, di atas tab ME,
  terlihat hanya saat `G && G.paused && !G.ended`) mengembalikan ke gamePanel
  + overlay pause. Catatan: kalibrasi sendiri memanggil `initAudio()` yang
  me-resume AudioContext — itu perilaku kalibrasi yang sudah ada (juga di menu),
  dan `schedule()` tetap diam karena `G.paused`.
- `[ EXIT ]` dan `[ TERMINATE ]` (`#stopBtn`): two-step arming, TANPA
  `window.confirm` (grep: nol pemakaian `confirm()` di luar komentar).
  Tap pertama mengubah tombol jadi `[ SURE? TAP AGAIN ]` /
  `[ YAKIN? KETUK LAGI ]`; tap kedua mengeksekusi `stop()` (keluar ke menu
  TANPA panel hasil — itu perilaku `stop()` yang sudah ada). Arming kedaluwarsa
  otomatis setelah 3 detik. State armed direset saat lagu mulai, selesai, dan
  saat ganti bahasa (ganti bahasa menulis ulang label tombol).
- Kunci i18n baru (I18N en/id): `pauseTitle`, `pauseCalib`, `pauseResume`,
  `pauseExit`, `pauseSure`, `backToGame`.

## 7. Bersihkan kode mati (`style.css`, `script.js:679`)

Dihapus dari `style.css` (semua terbukti tidak ada di `index.html` maupun
`script.js` lewat grep):
- v31 arcade display:none: `.marquee` (+ `.marquee h1/h2/.header-row`),
  `.bulbs` + `@keyframes bulbChase`, `.cab-side` (+ `.cab-ham`, `.cab-vert`,
  `.cab-stars`, `@keyframes hamBob`, media query `min-width: 1000px`),
  `.btn-arcade`, `.splash-coin`, footer emas v31 (`.footer` emas), dan
  bagian terkait di media query `min-width: 900px`, `max-width: 360px`,
  `max-width: 480px` (v31.1 — hanya bagian marquee; `#qualityBtn` dan
  `#tabBar` yang masih hidup dipertahankan), `prefers-reduced-motion`
  (hanya `.bulbs i/.splash-coin/.cab-ham`; `.btn-start` dipertahankan),
  plus kill-rule v32 `.marquee, .bulbs, .cab-side, .splash-coin { display: none !important; }`.
- Selector mati lain: `.header-row` (+ `> div`), `h1.flicker` +
  `@keyframes neonFlicker` (class flicker tidak pernah dipasang),
  `.avatar-container` / `.avatar-wrapper` / `@keyframes spin3D` (spin sudah
  di dalam canvas lewat JS sejak v26 FIX #4) + `.avatar-wrapper` di blok
  `prefers-reduced-motion` pertama.
- Grep akhir `marquee|bulbs|cab-side|btn-arcade|splash-coin|spin3D|neonFlicker|avatar-container|avatar-wrapper|header-row`
  di `style.css`: hanya tersisa satu komentar prose v32 ("no marquee, no
  bulbs, no side art") — itu deskripsi desain, dibiarkan.
- YANG SENGAJA DIBIARKAN: aturan v31 yang selektornya MASIH ada di HTML
  (`#mainPanel` outline, `#tabBar` grid, `.tab-btn[data-tab]` warna,
  `.tab-panel`, `.btn-start` + `@keyframes startPulse`) — sebagian di-override
  v32, tapi selektornya hidup, jadi di luar definisi "kode mati" tugas ini.
  `.footer` dasar (baris ~114) juga dibiarkan — footer ada di HTML; yang
  dihapus hanya varian emas v31.
- `introOsc`/`introGain`: DIHAPUS. Grep membuktikan hanya muncul di deklarasi
  (`script.js` lama baris 658) dan reset di `stopIntroMusic()` (baris 716) —
  tidak pernah diberi node. Kini `let introInterval = null;` saja
  (`script.js:679`); `introInterval` dipakai (play/stop/setIntroMode) dan
  dibiarkan.

## 8. Integrasi session (`script.js:810-815`, `828`, `873`, `1045`, `2056-2060`)

Kontrak koordinasi dipakai apa adanya (tidak diubah): POST `/session` →
`{sessionId, seed, nonce, expiresAt}`; POST `/scores` menerima
`{wallet, name, score, acc, mode, sessionId?, notes?, taps?, durationMs?}`.

- `play()` (`script.js:810`): sebelum lagu dibangun, `POST /session` ke
  `CONFIG.LB_URL` dengan body `{wallet, mode}` (timeout 5 detik via `tfetch`).
  Mode FREE memakai seed server (`'FREE-' + String(session.seed)`) sebagai
  `seedKey`; mode lain mempertahankan seed deterministiknya (Daily/Live/Race/
  duel replay) dan hanya membawa `sessionId`. `sessionId` disimpan di
  `G.sessionId` (`script.js:828`).
- Gagal/offline: fallback ke seed acak lokal (`seedKeyFor('free')`) dan
  `sessionId: null` — game tetap jalan, skor tetap bisa submit sebagai
  unverified. Catatan: karena endpoint `/session` dikerjakan pekerja Worker,
  bila Worker mengharapkan body lain (atau tanpa body), penyesuaian satu baris
  di `script.js:812` sudah cukup — response shape yang dipakai hanya
  `sessionId` dan `seed`.
- Penghitung tap: `G.taps++` di `judge()` (`script.js:873`), tepat setelah
  kedua guard (game berjalan + lane valid) — menghitung SEMUA tap yang mencapai
  game (hit, tap kosong, maupun miss yang lolos guard).
- `finish()` (`script.js:1045`): `lastResult` kini membawa `sessionId`,
  `taps: G.taps`, `notes: anthem.chart.length`, `durationMs:
  Math.round(anthem.duration*1000)`.
- `submitLb()` (`script.js:2054`): mengirim
  `{wallet, name, score, acc, mode, sessionId, notes, taps, durationMs}`
  (`sessionId: undefined` bila tidak ada — `JSON.stringify` menghilangkannya,
  jadi submit tanpa session tetap seperti perilaku lama). Guard lama tidak
  berubah: tidak ada `lastResult`/skor → tidak kirim; practice → tidak kirim.

## Perubahan per file (ringkas)

- `script.js` (2.273 → 2.387 baris): XP_LEVELS `:380`; `squeekTodayStr*`
  `:39-41`; seed/daily/misi/streak/champion `:43-45, :411, :462, :993,
  :1016-1023, :1544, :1620-1625, :1747, :1839`; LEGACY LV8 `:1901-1943`
  + pemanggilan `:1540` + `/11` `:1427`; wallet `:1550-1562, :1577, :1589,
  :793` + `forgetWallet38()` `:1555`; session `:810-815, :828, :873, :1045,
  submit `:2056-2060`; pause `:1072-1112` + binding `:1595-1598` +
  `applyVol()` + slider `:pvs` di boot; `introOsc/introGain` dihapus `:679`;
  `yesterdayStr`/`twoDaysAgoStr` dihapus; i18n/MSG baru `achLegacy8`,
  `walletForgotten`, `forgetWallet`, `pauseTitle`, `pauseCalib`,
  `pauseResume`, `pauseExit`, `pauseSure`, `backToGame` (en+id).
- `index.html` (343 → 367 baris): deskripsi `:7`, OG/Twitter `:9-17`,
  title/h2/footer v38, `#pauseOverlay` `:251-266`, `#backToGameBtn` `:220`,
  `#forgetWalletBtn` `:234`.
- `style.css` (607 → 572 baris): hapus CSS mati (§7) + gaya pause overlay di
  akhir file (`#pauseOverlay`, `.pause-box`, `.pause-title`,
  `#pauseVolVal`).
- `README.md` (97 → 99 baris): judul v38, bullet XP + Daily reset 19:00 WIB,
  achievements 11, bullet v38, entri `AUDIT-v38.md`. Baris terakhir proof
  tidak berubah.
- `AUDIT-v38.md` (baru): file ini.

## Verifikasi yang dijalankan

- `node --check script.js` — OK (setelah semua editan).
- Simulasi Node atas fungsi asli: `levelFor` (0→LV1 … 54.000→LV8, 100.000→LV8);
  `squeekTodayStr` (11:59 UTC→kemarin, 12:00 UTC→hari ini, 00:30 UTC→kemarin).
- Simulasi Node atas `makeAnthem` asli (20 seed): EASY ~112 not / ~2.490 XP
  sempurna; NORMAL ~165 not / ~4.070 XP; HARD ~205 not / ~5.270 XP.
- Grep: proofs utuh (di atas); ambang XP lama nol sisa; `window.confirm` nol;
  semua 8 id baru ada tepat 1× di `index.html`; semua kunci `msg()`/
  `data-i18n`/achievement ada di en+id (MSG 124=124, I18N seimbang — dicek
  lewat grep langsung, bukan checker kasar).
- TIDAK sempat diuji di browser nyata (tidak ada live browser di subagent ini):
  tampilan pause overlay, alur CALIBRATE → BACK TO GAME, dan round-trip
  POST /session → POST /scores terhadap Worker asli belum diuji end-to-end.
  Yang bisa diuji tanpa browser sudah diuji (syntax + logika murni di atas).

## Yang TIDAK sempat dilakukan + alasannya

- **Uji browser langsung** (klik PLAY, pause overlay, kalibrasi dari pause,
  submit skor dengan sessionId): subagent ini tidak punya live browser.
  Perlu smoke test oleh koordinator/pekerja browser sebelum deploy.
- **Penyesuaian body POST /session**: dikirim `{wallet, mode}`; bila Worker
  (pekerja lain) mengharapkan bentuk lain, hanya `script.js:812` yang perlu
  diubah. Response shape yang dipakai (`sessionId`, `seed`) sesuai kontrak.
- **Migrasi kunci Daily lama** (streak/misi/champion berkunci tanggal lokal):
  sengaja tidak dimigrasi — tanggal lokal tidak bisa dipetakan andal ke hari
  Squeek tanpa jam main; perilaku baru sudah benar menurut definisi hari
  Squeek (lihat §5).
- **Hapus `worker.js` / `TEST-*.js`**: di luar daftar file yang boleh diubah;
  tidak disentuh. Tidak ada test yang mengunci XP_LEVELS/jumlah achievement
  (dicek via grep — hanya ada assert timeout fetch di `TEST-v34-neo.js`).
