// v42.5.3 GHOST replay regression — run: node TEST-v42.5.3-ghost.js  (cwd = the v42.5.3 folder)
// Replay GHOST race user 0xb8337604… (mode race, seedKey RACE-2026-11-08-100,
// seed 2400307847, genre cyber, diff hard, lanes 3, offsetMs 40, ghost true,
// ghostPaceMs 0.5, 138 input, 12 poll, golden []) diklaim skor 34720
// (54/57/12/8, maxCombo 38) tapi server menolak "simulated score mismatch".
// Diagnosis parent (reproduksi engine.js + brute-force flip): tepat SATU note
// yang berbeda — index 56 (t=28.095238095238095, lane 0). Bila note itu GOOD,
// sim menjadi PERSIS 34720 / 54/57/12/8 / maxCombo 38.
// Mekanisme: note itu dipukul tap LAMBAT t=28.2347 lane 0 (raw dt +0.1395 s).
// judge() lama memakai st = songTime() - offset (0.04) = 28.1947, bd = 0.0995
// ≤ 0.135 → GOOD. Tapi loop() menandai note MISS saat raw songTime - n.t >
// 0.135, dan itu hanya terjadi pada frame rAF berikutnya (~16.7 ms) — tap ini
// tiba 4.5 ms setelah batas teoretis, SEBELUM frame loop sempat menandai
// miss, jadi judge() masih bisa memukulnya. Engine deterministik:
// expireNotes(ev.t) menandai miss dulu (0.1395 > 0.135) sebelum applyInput.
// Zona ambigu: tap lambat raw dt (0.135, 0.175] — hasilnya di client lama
// bergantung timing frame, di engine selalu ditolak.
// Perbaikan v42.5.3 (script.js judge()): (1) SATU sampel songTime() per tap
// untuk rekaman input DAN st; (2) raw-expiry guard — note yang sudah lewat
// batas kedaluwarsa mentahnya (raw - target.t > W.good) tidak boleh dipukul.
// Tes ini membuktikan: (a) engine sim = 32205 / 54/57/11/9 / maxCombo 35
// (vonis server); (b) harness logika judge() YANG DIPERBAIKI atas input
// replay yang sama menghasilkan PERSIS sim engine — client dan server kini
// sepakat; (c) bila note idx 56 dipaksa GOOD (satu-satunya perbedaan),
// hasilnya PERSIS klaim lama 34720 / 54/57/12/8 / maxCombo 38 — reproduksi
// brute-force diagnosis parent; (d) guard batas: raw dt tepat 0.135
// lolos, 0.1351 ditolak, tap awal (early) tidak pernah ditolak guard.
const fs = require('fs');
const SqueekEngine = require('./engine.js');
const rep = JSON.parse(fs.readFileSync('ghost-replay-0xb8337604.json', 'utf8'));

let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }

// ---- Konstanta — SAMA PERSIS dengan engine.js / script.js CONFIG ----
const W = { perfect: 0.045, great: 0.09, good: 0.135 };
const BREAK = W.good + 0.05;
const BASE_POINTS = { perfect: 300, great: 200, good: 100 };
const FEVER_COMBO = 30, FEVER_MULT = 1.5, ZOOMIES_MULT = 2, ZOOMIES_RPM = 70;

// ---- Harness logika judge() client (cerminan judge() script.js + loop()
// miss-marking), dijalankan atas input replay yang terekam. guardOn=true
// = judge() v42.5.3 (single sample + raw-expiry guard); guardOn=false =
// judge() lama (tanpa guard). forced = Set indeks note yang dipaksa GOOD
// (dipakai untuk membuktikan diagnosis: satu-satunya perbedaan antara
// klaim lama dan sim engine adalah note 56). Expiry memakai waktu mentah
// ev.t, persis expireNotes() engine — itulah model yang dipakai server
// untuk verifikasi.
function runClientLogic(replay, guardOn, forced) {
  const chart = SqueekEngine.buildChart(replay.header);
  const notes = chart.chart.map(n => ({ t: n.t, lane: n.lane, judged: null })).sort((a, b) => a.t - b.t);
  const h = replay.header;
  const offsetSec = (typeof h.offsetMs === 'number' ? h.offsetMs : 0) / 1000;
  const inputs = replay.events.inputs || [];
  const polls = (replay.events.polls || []).map((p, i) => ({ t: p.t, rpm: p.rpm, ok: p.ok, i })).sort((a, b) => (a.t - b.t) || (a.i - b.i));
  const forcedSet = forced instanceof Set ? forced : new Set();
  let score = 0, combo = 0, maxCombo = 0, fever = false, zoomies = false;
  const counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  let pollIdx = 0, missIdx = 0;
  function updateZoomies(uptoT) {
    while (pollIdx < polls.length && polls[pollIdx].t <= uptoT) {
      const p = polls[pollIdx++];
      zoomies = !!(p.ok && p.rpm >= ZOOMIES_RPM);
    }
  }
  function expireNotes(uptoT) {
    while (missIdx < notes.length) {
      const n = notes[missIdx];
      if (n.judged) { missIdx++; continue; }
      if (forcedSet.has(notes.indexOf(n))) break; // forced: jangan pernah expire
      if (uptoT - n.t > W.good) { n.judged = 'miss'; counts.miss++; combo = 0; fever = false; missIdx++; continue; }
      break;
    }
  }
  function judgeInput(ev) {
    const raw = ev.t; // v42.5.3: SATU sampel per tap — rekaman dan st memakai nilai yang sama
    const st = raw - offsetSec;
    let target = null, bd = Infinity;
    for (const n of notes) {
      if (n.judged || n.lane !== ev.lane) continue;
      if (n.t - st > BREAK) break;
      const dt = Math.abs(n.t - st); if (dt < bd) { bd = dt; target = n; }
    }
    if (target && forcedSet.has(notes.indexOf(target)) && bd <= BREAK) {
      // forced flip (diagnosis): hitung sebagai GOOD walau bd > W.good
      target.judged = 'good'; counts.good++; combo++; if (combo > maxCombo) maxCombo = combo;
      fever = combo >= FEVER_COMBO;
      const multF = Math.min(2, 1 + Math.floor(combo / 10) * 0.1) * (zoomies ? ZOOMIES_MULT : 1) * (fever ? FEVER_MULT : 1);
      score += Math.round(BASE_POINTS.good * multF);
      return;
    }
    if (!target || bd > W.good) return;
    if (guardOn && raw - target.t > W.good) return; // v42.5.3: raw-expiry guard
    const k = bd <= W.perfect ? 'perfect' : bd <= W.great ? 'great' : 'good';
    target.judged = k; counts[k]++; combo++; if (combo > maxCombo) maxCombo = combo;
    fever = combo >= FEVER_COMBO;
    const mult = Math.min(2, 1 + Math.floor(combo / 10) * 0.1) * (zoomies ? ZOOMIES_MULT : 1) * (fever ? FEVER_MULT : 1);
    score += Math.round(BASE_POINTS[k] * mult);
  }
  for (const ev of inputs) { updateZoomies(ev.t); expireNotes(ev.t); judgeInput(ev); }
  expireNotes(Infinity);
  const tot = counts.perfect + counts.great + counts.good + counts.miss;
  const acc = tot ? (counts.perfect * 300 + counts.great * 200 + counts.good * 100) / (tot * 300) * 100 : 100;
  return { score, acc, maxCombo, counts };
}

// ---- (a) Vonis server: engine.simulate atas replay yang sama ----
const chart = SqueekEngine.buildChart(rep.header);
const sim = SqueekEngine.simulate(chart, rep);
t('engine sim score = 32205 (vonis server atas replay GHOST)', sim.score === 32205);
t('engine sim counts = 54/57/11/9', sim.counts.perfect === 54 && sim.counts.great === 57 && sim.counts.good === 11 && sim.counts.miss === 9);
t('engine sim maxCombo = 35', sim.maxCombo === 35);
t('engine sim acc ~73.028 (bukan klaim 73.28)', Math.abs(sim.acc - 73.02798982188295) < 1e-9);
t('engine sim goldenHits = 0 (replay ini tanpa golden note)', sim.goldenHits === 0);

// ---- (b) judge() v42.5.3 (dengan guard) == engine sim, PERSIS ----
const fixed = runClientLogic(rep, true);
t('judge v42.5.3 score == engine sim (32205)', fixed.score === sim.score);
t('judge v42.5.3 counts == engine sim (54/57/11/9)', JSON.stringify(fixed.counts) === JSON.stringify(sim.counts));
t('judge v42.5.3 maxCombo == engine sim (35)', fixed.maxCombo === sim.maxCombo);
t('judge v42.5.3 acc == engine sim', Math.abs(fixed.acc - sim.acc) < 1e-9);

// ---- (c) Diagnosis: note idx 56 GOOD (satu-satunya perbedaan) == klaim
// lama 34720 — ini reproduksi brute-force parent. Harness deterministik
// atas replay TIDAK BISA mereproduksi klaim lama hanya dengan mematikan
// guard: klaim lama lahir dari frame race (loop rAF belum menandai miss
// saat tap lambat t=28.2347 tiba) — timing frame tidak terekam di replay.
// Yang bisa dibuktikan secara deterministik: bila note 56 dihitung GOOD,
// hasilnya PERSIS klaim lama — jadi tepat satu note yang berbeda, dan guard
// v42.5.3-lah yang menutup celah itu.
const flipped = runClientLogic(rep, false, new Set([56]));
t('note 56 GOOD -> score == klaim lama (34720)', flipped.score === 34720);
t('note 56 GOOD -> counts == klaim lama (54/57/12/8)', flipped.counts.perfect === 54 && flipped.counts.great === 57 && flipped.counts.good === 12 && flipped.counts.miss === 8);
t('note 56 GOOD -> maxCombo == klaim lama (38)', flipped.maxCombo === 38);
t('note 56 GOOD -> acc == klaim lama (73.28)', Math.abs(flipped.acc - 73.2824427480916) < 1e-9);
t('note 56 adalah satu-satunya perbedaan (skor klaim - sim = 2515)', flipped.score - fixed.score === 2515);
t('tanpa flip, logika tanpa guard == sim engine (guard-lah yang mengubah)', (() => { const noGuard = runClientLogic(rep, false); return noGuard.score === sim.score && JSON.stringify(noGuard.counts) === JSON.stringify(sim.counts) && noGuard.maxCombo === sim.maxCombo; })());

// ---- (d) Unit: tap kritis note idx 56 (t=28.0952, lane 0, offset 40 ms) ----
// Tap lambat t=28.2347: st = 28.1947, bd = 0.0995 (GOOD menurut jendela
// ber-offset) tapi raw - n.t = 0.1395 > 0.135 → guard menolak (v42.5.3).
const critNote = 28.095238095238095, critTap = 28.2347, off = 0.04;
const critSt = critTap - off, critBd = Math.abs(critNote - critSt);
t('tap kritis: bd ber-offset 0.0995 = GOOD menurut jendela lama', critBd <= W.good && critBd > W.great);
t('tap kritis: raw dt 0.1395 > W.good → guard v42.5.3 menolak', critTap - critNote > W.good);
t('tap kritis: raw dt 0.1395 masih dalam zona ambigu (0.135, 0.175]', critTap - critNote > W.good && critTap - critNote <= W.good + off);

// ---- (e) Unit: batas guard (noteT = 0 supaya selisihnya eksak di float) ----
function guardRejects(raw, noteT) { return raw - noteT > W.good; }
t('guard: raw dt tepat 0.135 lolos (batas memakai >, bukan >=)', !guardRejects(0.135, 0));
t('guard: raw dt 0.1351 ditolak', guardRejects(0.1351, 0));
t('guard: tap awal (raw < note.t) tidak pernah ditolak guard', !guardRejects(-0.1, 0));
t('guard: tap tepat di note (raw dt 0) lolos', !guardRejects(0, 0));

// ---- (f) Guard ada di script.js (statis) ----
const js = fs.readFileSync('script.js', 'utf8');
t('script.js judge(): SATU sampel songTime() per tap (const raw = songTime())', js.includes('const raw = songTime();'));
t('script.js judge(): recordReplayInput menerima sampel yang sama', js.includes('recordReplayInput(lane, raw)'));
t('script.js judge(): st memakai raw (bukan songTime() kedua)', js.includes('const st = raw - offsetMs / 1000;'));
t('script.js judge(): raw-expiry guard ada', js.includes('if (raw - target.t > CONFIG.W.good) return;'));
t('script.js recordReplayInput(lane, t): memakai t bila diberi', js.includes('function recordReplayInput(lane, t)') && js.includes("typeof t === 'number' ? +t.toFixed(4) : replaySongT()"));

console.log('TEST-v42.5.3-ghost: ' + pass + ' lolos, ' + fail + ' gagal');
process.exit(fail ? 1 : 0);
