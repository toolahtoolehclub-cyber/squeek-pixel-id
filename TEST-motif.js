// Motif determinism test — run: node TEST-motif.js (cwd = the v34 folder)
// Extracts the pure song engine (CONFIG..makeAnthem) from script.js and runs it in Node.
// The motif must be deterministic: same seed -> same chart, same name, same BPM.
// It must also actually repeat: bars 2/4 and 3/5 share most of their notes.
const fs = require('fs');
const src = fs.readFileSync('script.js', 'utf8');
const lines = src.split('\n');
function oneLine(marker) { const i = lines.findIndex(l => l.startsWith(marker)); if (i < 0) throw new Error('marker not found: ' + marker); return lines[i]; }
const head = [
  oneLine('const CONFIG ='),
  oneLine('const DIFFICULTIES ='),
  oneLine('const GENRES ='),
  oneLine('let currentDiff ='),
  oneLine('function cyrb53('),
  oneLine('function rng('),
  oneLine('const seedOf ='),
  oneLine('const NOTE_NAMES ='),
  oneLine('const SCALES ='),
  oneLine('const SONG_MOODS ='),
].join('\n');
const start = lines.findIndex(l => l.startsWith('function makeAnthem('));
let depth = 0, end = start;
for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
const engine = head + '\n' + lines.slice(start, end + 1).join('\n');
eval(engine);
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
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
