/* SQUEEKCHAIN v40 — ENGINE (satu sumber kebenaran)
 *
 * Logika MURNI game, dipakai BERSAMA oleh client (script.js, lewat
 * <script src="engine.js">) dan — mulai Batch 3 — oleh Cloudflare Worker
 * untuk verifikasi replay. SATU sumber kebenaran: chart yang dibangun di
 * sini harus identik byte-per-byte dengan chart yang dimainkan client, dan
 * simulate() harus mereproduksi EXACT skor client untuk replay yang sama.
 *
 * MURNI: tanpa DOM, tanpa network, tanpa Date / wall-clock, tanpa
 * Math.random. Semua yang tidak deterministik (waktu dinding, snapshot
 * roda) masuk lewat replay, bukan lewat fungsi ini.
 *
 * FORMAT MODUL: UMD — classic script di browser (window.SqueekEngine),
 * require() di Node (module.exports), dan `import './engine.js'` di
 * Cloudflare Worker (efek samping: mengisi globalThis.SqueekEngine).
 * Tidak ada `export` statement supaya file ini tetap bisa di-load sebagai
 * classic <script> (defer, sebelum script.js).
 *
 * ASAL ALGORITMA (disalin verbatim dari script.js v39, lalu dipindah ke
 * sini tanpa perubahan perilaku):
 * - cyrb53 / mulberry32 ......... script.js v39 baris 615-616
 * - buildChart .................. script.js v39 makeAnthem() baris 635-677
 *   (+ penskalaan practice 60% dari play() baris 892)
 * - simulate .................... script.js v39 judge() baris 954-991,
 *   loop() miss-marking baris 1015-1023, finish() baris 1068-1150
 *   (guard MISS, rumus accuracy/grade, claim)
 *
 * ATURAN DETERMINISME (yang dijamin file ini + replay v1):
 * 1. CHART: seed chart = cyrb53(header.seedKey). header.seed (uint32)
 *    adalah seed SESI (untuk mengikat replay ke session Worker), BUKAN
 *    seed chart — jangan tertukar. LIVE: bpm diambil dari seedKey
 *    (regex /^LIVE-YYYY-MM-DD-<bpm>$/); RACE/DAILY/BOSS/FREE: bpm dari
 *    rng seperti biasa. Practice (header.practice): semua nilai waktu
 *    dikali 1/0.6, bpm dibulatkan Math.round(bpm*0.6) — persis play() v39.
 * 2. INPUT: tiap tap direkam sebagai song-time (detik, 4 desimal,
 *    BOLEH NEGATIF — LEAD_IN 2 detik: tap sebelum lagu mulai punya
 *    song-time negatif, dan judge memakai st = t - offsetMs/1000
 *    (offset dari header, jepit +-150 ms). v42.4: client merekam
 *    songTime MENTAH (dulu dijepit >= 0 — bug yang membuat replay
 *    user 0xcafb… ditolak: tap lead-in terekam t=0). Worker v9
 *    menerima t >= -2,5 (LEAD_IN + 0,5 margin). Jendela: PERFECT
 *    0,045 / GREAT 0,09 / GOOD 0,135 detik; pencarian note terdekat
 *    BERHENTI bila n.t - st > 0,185 (= GOOD+0,05).
 * 3. ZOOMIES x2: HANYA dari log poll replay (events.polls) — poll terakhir
 *    dengan poll.t <= waktu tap; sebelum poll pertama, header.initialZoomies.
 *    Poll GAGAL (ok:false) = zoomies MATI. Di luar mode live/race, zoomies
 *    SELALU false: client tidak pernah menyalakannya di mode lain (tidak
 *    ada poll selama lagu, snapZoom hanya untuk live/race) — simulate()
 *    mengabaikan initialZoomies/poll di mode lain, supaya replay hasil
 *    fabrikasi tidak bisa mengklaim x2 di mode free/daily/boss/challenge.
 *    Di client, sejak v40, flag liveZoomies di mode RACE ikut flip tepat
 *    saat poll mendarat di refreshLive() (sebelumnya hanya lewat tick
 *    500 ms — selisih 0-500 ms itu tidak terekam di replay, jadi tidak
 *    bisa direproduksi).
 * 4. FEVER x1.5: combo >= 30 (dihitung ulang tiap hit; miss meresetnya).
 *    Pengali kombo: min(2, 1 + floor(combo/10)*0,1) — kombo SETELAH
 *    increment. Skor per hit = Math.round(base * mult), base
 *    PERFECT 300 / GREAT 200 / GOOD 100. Golden TIDAK dikali (flat +1000).
 * 5. GOLDEN NOTE: saat batas ronde 10 menit terlewati di tengah lagu race,
 *    note pertama yang belum di-judge dengan n.t > song-time saat itu
 *    berubah emas. Replay merekam {t, index} saat pick terjadi. simulate()
 *    memakai index TEREKAM untuk bonus (+1000 poin, +5 m, hanya bila note
 *    itu akhirnya kena) dan MELAPORKAN di checks.golden apakah pick itu
 *    cocok dengan aturan (note pertama yang belum di-judge dengan n.t > t,
 *    dinilai dari input-input dengan t <= waktu event). Bila pick tidak
 *    cocok, skor tetap direproduksi apa adanya — ketidakcocokan hanya
 *    dilaporkan, supaya Worker (Batch 3) yang memutuskan.
 *    Tie-break yang didokumentasikan: input dan golden event dengan t yang
 *    SAMA diproses input dulu (di client, handler tap jalan sebelum rAF
 *    yang mem-pick golden berikutnya). Batas kuantisasi: semua waktu replay
 *    dibulatkan ke 0,1 ms (v42.4: dulu 1 ms) — kasus yang jatuh dalam
 *    0,05 ms dari tepi jendela judgement atau dari tepi pick golden
 *    secara teori bisa berbeda antara client dan simulasi (lihat
 *    AUDIT-v40 §3.4).
 * 6. RACE: playerDist HANYA dari note yang di-judge (PERFECT 1,0 m /
 *    GREAT 0,7 m / GOOD 0,4 m) + golden 5 m. oppDistM yang dipakai untuk
 *    menang/kalah adalah nilai TEREKAM di replay.events.finish.oppDistM
 *    (dibulatkan 0,1 m oleh client; keputusan live client memakai float
 *    mentah — keduanya hanya bisa berbeda bila selisihnya < 0,05 m).
 *    deriveOppDistM() menghitung ulang oppDist dari log poll (poll ok
 *    terakhir - header.initialDistKm); selisih vs nilai terekam yang
 *    wajar adalah <= 1,05 m (pembulatan poll 3 desimal + finish 0,1 m).
 *    PENGECUALIAN: bila balapan dimulai saat roda OFFLINE, client selalu
 *    mencatat oppDistM 0 walau poll belakangan ok — nilai terekam tetap
 *    yang benar; derive akan berbeda dan itu BUKAN inkonsistensi.
 * 7. MISS: note jadi miss saat songTime - n.t > 0,135 (tanpa offset,
 *    mengikuti loop() client). Di akhir, semua note yang belum di-judge
 *    adalah miss. Invarian: PERFECT+GREAT+GOOD+MISS = NOTES (guard
 *    finish() v39 dipertahankan sebagai pengaman, walau tidak pernah
 *    terpicu bila tiap note di-judge tepat sekali).
 * 8. AKURASI: (perfect*300 + great*200 + good*100) / (total*300) * 100,
 *    total = semua judgement, dihitung SEBELUM guard MISS (persis
 *    finish(): accuracy() dipanggil sebelum guard). total 0 -> 100.
 */

(function (root, factory) {
  const api = factory();
  root.SqueekEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---- Konstanta — NILAI SAMA PERSIS dengan script.js v39 (CONFIG dkk) ----
  const BARS = 32; // CONFIG.BARS
  const ZOOMIES_RPM = 70;
  const W = { perfect: 0.045, great: 0.09, good: 0.135 }; // CONFIG.W
  const BREAK = W.good + 0.05; // 0,185 — batas berhenti pencarian note terdekat
  const BASE_POINTS = { perfect: 300, great: 200, good: 100 };
  const RACE_DIST_M = { perfect: 1.0, great: 0.7, good: 0.4 };
  const GOLDEN_POINTS = 1000;
  const GOLDEN_DIST_M = 5;
  const FEVER_COMBO = 30;
  const FEVER_MULT = 1.5;
  const ZOOMIES_MULT = 2;
  const PRACTICE_TEMPO = 0.6;

  const DIFFICULTIES = { easy: { speed: 350, density: 0.4, chord: 0.0 }, normal: { speed: 480, density: 0.7, chord: 0.1 }, hard: { speed: 600, density: 0.9, chord: 0.25 } };
  const GENRES = { cyber: { scales: ['Phrygian', 'Harmonic Minor', 'Minor Pentatonic', 'Aeolian', 'Blues'], bpm: 120 }, synth: { scales: ['Dorian', 'Major Pentatonic', 'Lydian', 'Major'], bpm: 100 }, chip: { scales: ['Major Pentatonic', 'Dorian', 'Mixolydian', 'Blues'], bpm: 140 }, void: { scales: ['Phrygian', 'Harmonic Minor', 'Aeolian', 'Blues'], bpm: 150 } };
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SCALES = { 'Minor Pentatonic': [0, 3, 5, 7, 10], 'Dorian': [0, 2, 3, 5, 7, 9, 10], 'Phrygian': [0, 1, 3, 5, 7, 8, 10], 'Major Pentatonic': [0, 2, 4, 7, 9], 'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11], 'Lydian': [0, 2, 4, 6, 7, 9, 11], 'Mixolydian': [0, 2, 4, 5, 7, 9, 10], 'Aeolian': [0, 2, 3, 5, 7, 8, 10], 'Blues': [0, 3, 5, 6, 7, 10], 'Major': [0, 2, 4, 5, 7, 9, 11] };
  const SONG_MOODS = { 'Phrygian': 'Void', 'Harmonic Minor': 'Ember', 'Minor Pentatonic': 'Blues', 'Dorian': 'Neon', 'Major Pentatonic': 'Sunny', 'Lydian': 'Sky', 'Mixolydian': 'Groove', 'Aeolian': 'Dusk', 'Blues': 'Smoky', 'Major': 'Bright' };

  // ---- Hash + RNG — verbatim script.js v39 baris 615-616 ----
  function cyrb53(str, seed = 0) { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677) } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return 4294967296 * (2097151 & h2) + (h1 >>> 0) }
  function mulberry32(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

  // ---- Chart — verbatim script.js v39 makeAnthem() baris 635-677 ----
  // header: { seedKey, genre, diff, lanes, mirror, practice?, seedNum? }
  // - seedKey: string sumber seed chart (seed sesi TIDAK dipakai di sini —
  //   lihat aturan 1 di atas). Bila seedKey kosong dan seedNum tidak ada:
  //   throw (chart tanpa seed tidak punya arti).
  // - seedNum (opsional): seed numerik langsung — hanya untuk jalur
  //   randomize lama makeAnthem (seed wallet + Math.random() * 999999),
  //   yang tidak pernah dipakai gameplay (randomize tidak pernah true).
  // - practice: true = terapkan penskalaan tempo 60% dari play() v39.
  // Mengembalikan objek anthem lengkap (bpm, step, scaleName, name, key,
  // root, scale, chart, drums, duration, hue, lanes, mirror) — drums adalah
  // DATA (dipakai schedule() untuk audio di script.js), bukan audio.
  function buildChart(header) {
    if (!header || typeof header !== 'object') throw new Error('buildChart: header is required');
    if (!GENRES[header.genre]) throw new Error('buildChart: unknown genre ' + header.genre);
    if (!DIFFICULTIES[header.diff]) throw new Error('buildChart: unknown diff ' + header.diff);
    const lanes = header.lanes === 4 ? 4 : 3;
    const mirror = !!header.mirror;
    let seed;
    if (typeof header.seedNum === 'number' && Number.isFinite(header.seedNum)) seed = header.seedNum;
    else if (header.seedKey !== undefined && header.seedKey !== null && String(header.seedKey).length) seed = cyrb53(String(header.seedKey));
    else throw new Error('buildChart: seedKey (or seedNum) is required');
    const r = mulberry32(seed), genreInfo = GENRES[header.genre];
    const scaleName = genreInfo.scales[Math.floor(r() * genreInfo.scales.length)];
    const scale = SCALES[scaleName], root = Math.floor(r() * 12);
    // v27 LIVE: seed LIVE mengodekan BPM hamster — tempo dari roda, bukan
    // genre. Melewatkan draw bpm di sini menjaga lagu tetap identik saat
    // duel link memutar ulang seed yang sama. (RACE tidak cocok regex ini —
    // bpm race tetap dari rng, seperti di v39.)
    const liveBpmMatch = header.seedKey ? String(header.seedKey).match(/^LIVE-\d{4}-\d{2}-\d{2}-(\d{2,3})$/) : null;
    const bpm = liveBpmMatch ? parseInt(liveBpmMatch[1], 10) : genreInfo.bpm + Math.floor(r() * 20) - 10;
    const step = 60 / bpm / 4, span = scale.length * 2;
    const chart = [], drums = [], diff = DIFFICULTIES[header.diff]; let lastT = -1;
    // v33.1 MOTIF: frasa 2 bar berulang tiap 2 bar (dengan variasi kecil).
    // Semua draw dari r() dalam urutan tetap, jadi seed yang sama memutar
    // lagu yang sama (duel link, daily anthem).
    const motif = [[], []];
    for (let mb = 0; mb < 2; mb++) for (let s = 0; s < 16; s++) {
      const onBeat = s % 4 === 0, onEighth = s % 2 === 0;
      const on = (onEighth && r() < diff.density) || (onBeat && r() < diff.density * 1.2);
      motif[mb][s] = { on, deg: Math.floor(r() * span) };
    }
    for (let bar = 0; bar < BARS; bar++) {
      for (let s = 0; s < 16; s++) {
        const t = (bar * 16 + s) * step;
        drums.push({ t, kick: s % 4 === 0 || (s === 10 && r() < .3), hat: s % 2 === 0, snare: s === 4 || s === 12, bass: s % 8 === 0 ? [0, 3, 4, 5, 2][Math.floor(r() * 5)] % scale.length : null });
        const m = motif[bar % 2][s];
        let want = m.on, deg = m.deg;
        if (bar < 2) want = s % 8 === 0; // intro tetap jarang (2 bar pertama)
        else { if (want && r() < 0.15) want = false; else if (want && r() < 0.15) deg = Math.max(0, Math.min(span - 1, deg + (r() < 0.5 ? -1 : 1))); } // variasi saat pengulangan
        if (want && (t - lastT > 0.25)) {
          const midi = 60 + root + scale[deg % scale.length] + 12 * Math.floor(deg / scale.length);
          const lane = Math.min(lanes - 1, Math.floor(deg / span * lanes));
          chart.push({ t, lane, midi, judged: null }); lastT = t;
          if (s % 4 === 0 && r() < diff.chord) chart.push({ t, lane: (lane + 1 + Math.floor(r() * 2)) % lanes, midi: midi - 12, judged: null });
        }
      }
    }
    chart.sort((a, b) => a.t - b.t);
    if (mirror) chart.forEach(n => { n.lane = lanes - 1 - n.lane; }); // v28: Mirror mode (LV7) — balik chart
    const anthem = { bpm, step, scaleName, name: (SONG_MOODS[scaleName] || scaleName) + ' ' + scaleName, key: NOTE_NAMES[root], root, scale, chart, drums, duration: BARS * 16 * step, hue: Math.floor(r() * 360), lanes, mirror };
    if (header.practice) {
      // v29 PRACTICE (dulu di play() v39, kini di sini supaya Worker cukup
      // membaca header.practice): tempo 60% — semua nilai waktu dikali
      // 1/0.6, bpm dibulatkan Math.round(bpm*0.6).
      const k = 1 / PRACTICE_TEMPO;
      anthem.bpm = Math.round(anthem.bpm * PRACTICE_TEMPO);
      anthem.step *= k; anthem.duration *= k;
      anthem.chart.forEach(n => { n.t *= k; });
      anthem.drums.forEach(d => { d.t *= k; });
    }
    return anthem;
  }

  // ---- Akurasi + grade — verbatim script.js v39 accuracy()/grade() ----
  function accuracyOf(counts) {
    const tot = counts.perfect + counts.great + counts.good + counts.miss;
    return tot ? (counts.perfect * 300 + counts.great * 200 + counts.good * 100) / (tot * 300) * 100 : 100;
  }
  function gradeOf(acc, miss) {
    return acc >= 95 && miss === 0 ? 'SS' : acc >= 95 ? 'S' : acc >= 88 ? 'A' : acc >= 75 ? 'B' : acc >= 60 ? 'C' : 'D';
  }

  // ---- Jarak lawan dari log poll (diagnostik, lihat aturan 6) ----
  function deriveOppDistM(header, polls, finishT) {
    // v42.5 GHOST: jarak lawan = pace hantu × waktu lagu saat finish
    // (bukan dari poll — poll saat ghost menunjukkan RPM 0 / gagal).
    if (header && header.ghost) {
      const pace = (typeof header.ghostPaceMs === 'number') ? header.ghostPaceMs : 0;
      const t = (typeof finishT === 'number') ? finishT : ((header && typeof header.duration === 'number') ? header.duration : 0);
      return +Math.max(0, pace * t).toFixed(1);
    }
    const list = Array.isArray(polls) ? polls : [];
    let last = null;
    for (const p of list) if (p && p.ok && typeof p.dist === 'number') last = p;
    if (!last) return 0;
    const startKm = (header && typeof header.initialDistKm === 'number') ? header.initialDistKm : 0;
    return +Math.max(0, (last.dist - startKm) * 1000).toFixed(1);
  }

  // ---- Simulasi — verbatim judge()/loop()/finish() v39 ----
  // chart: hasil buildChart(header) (atau array note {t, lane} mentah).
  // replay: replay v1 lengkap { header, events: { inputs, polls, golden,
  // finish }, claim }. Input chart TIDAK dimutasi (disalin dulu).
  // Mengembalikan { score, acc, maxCombo, counts, grade, playerDistM,
  // oppDistM, win, goldenHits, goldenChecks, oppDistMDerived,
  // oppDistMMatch } — empat field pertama adalah klaim yang harus sama
  // persis dengan replay.claim.
  function simulate(chart, replay) {
    const srcNotes = Array.isArray(chart) ? chart : (chart && chart.chart);
    if (!Array.isArray(srcNotes)) throw new Error('simulate: chart notes missing');
    if (!replay || !replay.header || !replay.events) throw new Error('simulate: replay v1 required');
    const h = replay.header;
    const isRace = h.mode === 'race';
    const offsetSec = (typeof h.offsetMs === 'number' ? h.offsetMs : 0) / 1000;
    // Salinan kerja (judged hanya hidup di sini) — chart pemanggil utuh.
    const notes = srcNotes.map(n => ({ t: n.t, lane: n.lane, judged: null }));
    notes.sort((a, b) => a.t - b.t); // buildChart sudah mengurutkan; ini pengaman
    const inputs = Array.isArray(replay.events.inputs) ? replay.events.inputs : [];
    const polls = Array.isArray(replay.events.polls) ? replay.events.polls : [];
    const goldens = Array.isArray(replay.events.golden) ? replay.events.golden : [];

    let score = 0, combo = 0, maxCombo = 0, playerDist = 0, goldenHits = 0;
    const counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    let fever = false;
    // Zoomies hanya ada di live/race (lihat aturan 3): di mode lain flag
    // client tidak pernah menyala, jadi initialZoomies/poll diabaikan.
    const zoomiesApplies = h.mode === 'live' || h.mode === 'race';
    let zoomies = zoomiesApplies && !!h.initialZoomies;
    let goldenNote = null, goldenPending = false;
    const goldenChecks = [];

    // Poll diurutkan waktu; pointer maju seiring timeline (poll hanya
    // berlaku sejak waktu tercatatnya — tidak berlaku surut).
    const sortedPolls = polls.map((p, i) => ({ t: p.t, rpm: p.rpm, ok: p.ok, i })).sort((a, b) => (a.t - b.t) || (a.i - b.i));
    let pollIdx = 0;
    function updateZoomies(uptoT) {
      if (!zoomiesApplies) return;
      while (pollIdx < sortedPolls.length && sortedPolls[pollIdx].t <= uptoT) {
        const p = sortedPolls[pollIdx++];
        zoomies = !!(p.ok && p.rpm >= ZOOMIES_RPM); // poll gagal = zoomies mati
      }
    }
    // Miss-marking ala loop(): chartIdx monoton naik, tiap note di-judge
    // tepat sekali; note jadi miss saat songTime - n.t > W.good (TANPA
    // offset — loop memakai songTime mentah, judge memakai st ber-offset).
    let missIdx = 0;
    function expireNotes(uptoT) {
      while (missIdx < notes.length) {
        const n = notes[missIdx];
        if (n.judged) { missIdx++; continue; }
        if (uptoT - n.t > W.good) {
          n.judged = 'miss'; counts.miss++; combo = 0; fever = false;
          if (goldenNote === n) { goldenNote = null; goldenPending = false; }
          missIdx++; continue;
        }
        break; // note-note berikut t-nya >= note ini, jadi belum kedaluwarsa
      }
    }
    // Aturan pick golden (loop()): note pertama yang belum di-judge dengan
    // n.t > t event. Dipakai untuk checks — bonus mengikuti index terekam.
    function expectedGoldenIndex(t) {
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        if (!n.judged && n.t > t) return i;
      }
      return -1;
    }
    function applyGolden(ev) {
      const expected = expectedGoldenIndex(ev.t);
      const ok = expected !== -1 && expected === ev.index && !goldenPending;
      goldenChecks.push({ t: ev.t, index: ev.index, expected, ok });
      const note = notes[ev.index];
      if (note && !note.judged) { goldenNote = note; goldenPending = true; }
      // Bila note sudah di-judge / index di luar chart: tidak ada golden
      // aktif — bonus tidak akan jatuh (sama seperti client yang pick-nya
      // melewatkan note yang sudah di-judge).
    }
    function applyInput(ev) {
      const st = ev.t - offsetSec; // songTime() - offsetMs/1000
      let target = null, bd = Infinity;
      for (const n of notes) {
        if (n.judged || n.lane !== ev.lane) continue;
        if (n.t - st > BREAK) break;
        const dt = Math.abs(n.t - st); if (dt < bd) { bd = dt; target = n; }
      }
      if (!target || bd > W.good) return; // tap kosong / di luar jendela
      const k = bd <= W.perfect ? 'perfect' : bd <= W.great ? 'great' : 'good';
      target.judged = k; counts[k]++; combo++; if (combo > maxCombo) maxCombo = combo;
      fever = combo >= FEVER_COMBO; // v29 FEVER: combo 30+ = x1.5 sampai kombo putus
      const mult = Math.min(2, 1 + Math.floor(combo / 10) * .1) * (zoomies ? ZOOMIES_MULT : 1) * (fever ? FEVER_MULT : 1);
      score += Math.round(BASE_POINTS[k] * mult);
      if (isRace) playerDist += RACE_DIST_M[k];
      if (isRace && goldenNote === target) { score += GOLDEN_POINTS; playerDist += GOLDEN_DIST_M; goldenNote = null; goldenPending = false; goldenHits++; }
    }

    // Timeline gabungan, urut waktu; input sebelum golden bila t sama.
    const timeline = [];
    inputs.forEach((e, i) => timeline.push({ kind: 'input', t: e.t, lane: e.lane, i }));
    goldens.forEach((e, i) => timeline.push({ kind: 'golden', t: e.t, index: e.index, i }));
    timeline.sort((a, b) => (a.t - b.t) || (a.kind === b.kind ? a.i - b.i : (a.kind === 'input' ? -1 : 1)));
    for (const ev of timeline) {
      updateZoomies(ev.t);
      expireNotes(ev.t);
      if (ev.kind === 'input') applyInput(ev); else applyGolden(ev);
    }
    expireNotes(Infinity); // sisa note yang belum di-judge = miss

    // accuracy + grade dihitung SEBELUM guard MISS (persis finish() v39:
    // accuracy() dipanggil sebelum guard).
    const acc = accuracyOf(counts);
    const grade = gradeOf(acc, counts.miss);
    const totalNotes = notes.length;
    if (totalNotes > 0 && counts.perfect + counts.great + counts.good + counts.miss > totalNotes) {
      counts.miss = Math.max(0, totalNotes - (counts.perfect + counts.great + counts.good));
    }
    const finishEv = replay.events.finish || null;
    const oppDistM = (finishEv && typeof finishEv.oppDistM === 'number') ? finishEv.oppDistM : null;
    const win = oppDistM === null ? null : playerDist > oppDistM;
    const oppDistMDerived = isRace ? deriveOppDistM(h, polls, finishEv ? finishEv.t : null) : null;
    return {
      score, acc, maxCombo, counts, grade,
      playerDistM: playerDist,
      oppDistM, win,
      goldenHits, goldenChecks,
      oppDistMDerived,
      oppDistMMatch: oppDistMDerived === null ? null : Math.abs(oppDistMDerived - (oppDistM === null ? 0 : oppDistM)) <= 1.05
    };
  }

  return {
    cyrb53, mulberry32, buildChart, simulate,
    accuracyOf, gradeOf, deriveOppDistM,
    ZOOMIES_RPM, W, BREAK
  };
});
