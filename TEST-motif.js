// Motif determinism test — run: node TEST-motif.js (cwd = the v40 folder)
// v40: the song engine now lives in engine.js (SqueekEngine.buildChart);
// script.js makeAnthem() is a thin wrapper delegating to it. This test
// checks the motif through the wrapper (the path the game actually uses)
// AND that the wrapper agrees with buildChart directly.
const fs = require('fs');
const src = fs.readFileSync('script.js', 'utf8');
const SqueekEngine = require('./engine.js');
const lines = src.split('\n');
function fnSrc(name) {
  const start = lines.findIndex(l => l.startsWith('function ' + name + '('));
  if (start < 0) throw new Error('fn not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
// The wrapper closes over SqueekEngine + currentGenre/currentDiff (+ cyrb53
// in the randomize branch, never taken here) — pass them as Function params.
const makeAnthem = new Function('SqueekEngine', 'currentGenre', 'currentDiff', 'cyrb53',
  fnSrc('makeAnthem') + '\nreturn makeAnthem;')(SqueekEngine, 'cyber', 'easy', SqueekEngine.cyrb53);
let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }

const W = '0x372D48abe5eDccCcDE9BD914a6dE30Dc53e3a1Db';
const a1 = makeAnthem(W, false, 'TEST-SEED-1');
const a2 = makeAnthem(W, false, 'TEST-SEED-1');
const a3 = makeAnthem(W, false, 'TEST-SEED-2');
t('same seed -> identical chart', JSON.stringify(a1.chart) === JSON.stringify(a2.chart));
t('same seed -> identical name', a1.name === a2.name);
t('same seed -> identical bpm', a1.bpm === a2.bpm);
t('different seed -> different chart', JSON.stringify(a1.chart) !== JSON.stringify(a3.chart));
t('song name format "Mood Scale"', /^(Void|Ember|Blues|Neon|Sunny|Sky|Groove|Dusk|Smoky|Bright) /.test(a1.name) && a1.name.endsWith(a1.scaleName));
t('easy chart length sane (40-200)', a1.chart.length >= 40 && a1.chart.length <= 200, console.log('  chart length:', a1.chart.length));
// LIVE seed: bpm comes from the seed, still deterministic
const l1 = makeAnthem(W, false, 'LIVE-2026-11-07-128');
const l2 = makeAnthem(W, false, 'LIVE-2026-11-07-128');
t('LIVE seed bpm = 128', l1.bpm === 128);
t('LIVE seed deterministic', JSON.stringify(l1.chart) === JSON.stringify(l2.chart));
// motif repetition: first note per (bar, step); compare bar 2 vs 4 and bar 3 vs 5
// (bars 0-1 are the sparse intro, so they cannot represent the motif)
function barNotes(a, bar) {
  const m = new Map();
  for (const n of a.chart) { const b = Math.floor(n.t / (a.step * 16)); if (b === bar && !m.has(Math.round((n.t / a.step) % 16))) m.set(Math.round((n.t / a.step) % 16), n.midi); }
  return m;
}
function matchRate(a, b1, b2) {
  const x = barNotes(a, b1), y = barNotes(a, b2);
  let same = 0, total = 0;
  for (const [s, midi] of x) { total++; if (y.get(s) === midi) same++; }
  return total ? same / total : 0;
}
const r04 = matchRate(a1, 2, 4), r15 = matchRate(a1, 3, 5);
t('motif repeats bar 2 -> bar 4 (>=50% same notes)', r04 >= 0.5, console.log('  bar2->4 match:', r04.toFixed(2)));
t('motif repeats bar 3 -> bar 5 (>=50% same notes)', r15 >= 0.5, console.log('  bar3->5 match:', r15.toFixed(2)));
// v40: the wrapper must agree with the engine directly.
const b1 = SqueekEngine.buildChart({ seedKey: 'TEST-SEED-1', genre: 'cyber', diff: 'easy', lanes: 3, mirror: false });
t('wrapper makeAnthem == engine.buildChart', JSON.stringify(a1) === JSON.stringify(b1));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
