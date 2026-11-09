// v43.2 — LATAR LOAD PERTAMA TERLIHAT — run: node TEST-v43.2.js  (cwd = the v43.2 folder)
// Scope: (1) background pertama-terbuka BERWARNA (bukan hitam polos) —
// gradasi statis CSS (tint hijau/cyan dalam di atas hitam NEO #050607),
// dibuktikan dengan KOMPOSIT PIKSEL sebelum (v43.1) vs sesudah (v43.2);
// (2) tetap NOL BIAYA — tanpa backdrop-filter, tanpa blur, tanpa partikel,
// tanpa ConvolverNode, aurora tetap statis sampai bgWake; (3) TIDAK ADA
// REGRESI — engine/worker byte-identik v43.1, chart golden identik,
// Genesis utuh, Worker v13.
// Semua asersi "SUDAH DIHAPUS" memakai kode tanpa komentar, supaya komentar
// yang MENDOKUMENTASIKAN penghapusan tidak memicu tes.
const fs = require('fs');
const SqueekEngine = require('./engine.js');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const jsLines = js.split('\n');
const cssLines = css.split('\n');
const golden = JSON.parse(fs.readFileSync('TEST-v40-golden-charts.json', 'utf8'));
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }

// --- extractors (same pattern as TEST-v43.1.js) ---
function fnSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('function ' + name + '(') || l.startsWith('async function ' + name + '('));
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
function mockClassList() {
  const set = new Set();
  return {
    toggle(cls, force) { if (force === undefined) { if (set.has(cls)) set.delete(cls); else set.add(cls); } else if (force) set.add(cls); else set.delete(cls); },
    add(cls) { set.add(cls); }, remove(cls) { set.delete(cls); },
    contains(cls) { return set.has(cls); },
    _set: set,
  };
}
function keyframesBody(name) {
  const start = cssLines.findIndex(l => l.includes('@keyframes ' + name));
  if (start < 0) return null;
  let depth = 0, end = start;
  for (let i = start; i < cssLines.length; i++) { for (const ch of cssLines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return cssLines.slice(start, end + 1).join('\n');
}

// --- gradient parser + pixel compositor (the v43.2 proof) ---
// Parses `radial-gradient(ellipse RX% RY% at CX% CY%, rgba(R,G,B,A), transparent STOP%)`
// layers from a CSS background value, in shorthand order (first = topmost).
function parseGradients(bgValue) {
  const re = /radial-gradient\(\s*ellipse\s+([\d.]+)%\s+([\d.]+)%\s+at\s+([\d.]+)%\s+([\d.]+)%,\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*,\s*transparent\s+([\d.]+)%\s*\)/g;
  const out = [];
  let m;
  while ((m = re.exec(bgValue)) !== null) {
    out.push({ rx: +m[1], ry: +m[2], cx: +m[3], cy: +m[4], r: +m[5], g: +m[6], b: +m[7], a: +m[8], stop: +m[9] / 100 });
  }
  return out;
}
function extractRule(cssText, selector) {
  const lines = cssText.split('\n');
  const start = lines.findIndex(l => l.trim() === selector + ' {');
  if (start < 0) return null;
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
function baseColorOf(bgValue) {
  // the base colour is the last layer of a background shorthand value
  const m = bgValue.match(/,\s*(#[0-9a-fA-F]{6})\s*$/);
  return m ? m[1].toLowerCase() : null;
}
function backgroundValue(ruleText) {
  if (!ruleText) return null;
  const m = ruleText.match(/background:\s*([\s\S]*?);/);
  return m ? m[1] : null;
}
function hexToRgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
// Composite a point (x,y in % of viewport) over `base` [r,g,b], applying
// `layersBottomToTop` (BOTTOM layer first) with source-over blending.
// Radial falloff: alpha fades linearly from the tint alpha at the centre
// to 0 at the transparent stop (CSS radial-gradient linear interpolation).
function compositeAt(x, y, layersBottomToTop, base) {
  let col = base.slice();
  for (const L of layersBottomToTop) {
    const dx = (x - L.cx) / L.rx, dy = (y - L.cy) / L.ry;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= L.stop) continue;
    const a = L.a * (1 - d / L.stop);
    col = [L.r * a + col[0] * (1 - a), L.g * a + col[1] * (1 - a), L.b * a + col[2] * (1 - a)];
  }
  return col;
}
function findLayer(layers, r, g, b) { return layers.find(l => l.r === r && l.g === g && l.b === b) || null; }

// --- Harness: real bgWake from script.js, run against mock DOM ---
const harnessSrc = [
  "let bgAwake = false;",
  "let gl = null;",
  "let quality = 'ultra';",
  "let glRunning = false;",
  "let __rafCalls = 0;",
  "function requestAnimationFrame(fn) { __rafCalls++; return 1; }",
  "function renderGL() {}",
  "const __bodyCls = mockClassList();",
  "const document = { body: { classList: __bodyCls }, hidden: false };",
  fnSrc(jsLines, 'bgWake'),
  "__out.w1_awakeBefore = bgAwake;",
  "bgWake();",
  "__out.w1_awakeAfter = bgAwake;",
  "__out.w1_hasClass = __bodyCls.contains('bg-awake');",
  "__out.w1_raf = __rafCalls;",
  "bgWake();",
  "__out.w2_raf = __rafCalls;",
  "bgAwake = false; __rafCalls = 0; gl = {}; glRunning = false; quality = 'ultra';",
  "bgWake();",
  "__out.w3_glRunning = glRunning;",
  "__out.w3_raf = __rafCalls;",
  "bgAwake = false; __rafCalls = 0; gl = {}; glRunning = false; quality = 'hemat';",
  "bgWake();",
  "__out.w4_glRunning = glRunning;",
  "__out.w4_raf = __rafCalls;",
].join('\n');
const __out = {};
new Function('__out', 'mockClassList', harnessSrc)(__out, mockClassList);

// ============ (A) LATAR LOAD PERTAMA — BERWARNA, BUKAN HITAM POLOS ============
// v43.1 (the "before" baseline, hardcoded from the v43.1 source):
// body = pure #000; aurora = cyan .10 at (30%,20%) + green .08 at (75%,70%).
const OLD_AURORA = [
  { rx: 55, ry: 40, cx: 30, cy: 20, r: 0, g: 229, b: 255, a: 0.10, stop: 0.70 },
  { rx: 45, ry: 35, cx: 75, cy: 70, r: 0, g: 255, b: 136, a: 0.08, stop: 0.70 },
];
const OLD_BASE = [0, 0, 0];
const bodyRule = extractRule(cssCode, 'body');
const auroraRule = extractRule(cssCode, '#bg-aurora .aurora');
const bodyBg = backgroundValue(bodyRule);
const auroraBg = backgroundValue(auroraRule);
const bodyLayers = bodyBg ? parseGradients(bodyBg) : [];
const auroraLayers = auroraBg ? parseGradients(auroraBg) : [];
const bodyBase = bodyBg && baseColorOf(bodyBg) ? hexToRgb(baseColorOf(bodyBg)) : null;
const cyanLayer = findLayer(auroraLayers, 0, 229, 255);
const greenLayer = findLayer(auroraLayers, 0, 255, 136);
const violetLayer = findLayer(auroraLayers, 139, 92, 246);
// Paint stack, bottom to top: body base -> body gradients (reversed) -> aurora (reversed).
const stack = bodyLayers.slice().reverse().concat(auroraLayers.slice().reverse());
const oldStack = OLD_AURORA.slice().reverse();
const cyanPt = compositeAt(25, 15, stack, bodyBase || [0, 0, 0]);
const greenPt = compositeAt(78, 72, stack, bodyBase || [0, 0, 0]);
const oldCyanPt = compositeAt(25, 15, oldStack, OLD_BASE);
const oldGreenPt = compositeAt(78, 72, oldStack, OLD_BASE);

t('latar: aturan body ditemukan + aturan #bg-aurora .aurora ditemukan', bodyRule !== null && auroraRule !== null);
t('latar: body pakai gradasi statis (bukan background-color polos)', bodyLayers.length >= 2);
t('latar: base body = NEO #050607 (bukan #000 murni)', bodyBg !== null && baseColorOf(bodyBg) === '#050607');
t('latar: aurora punya tint cyan alpha >= 0.18 (v43.1 cuma 0.10)', cyanLayer !== null && cyanLayer.a >= 0.18);
t('latar: aurora punya tint hijau alpha >= 0.18 (v43.1 cuma 0.08)', greenLayer !== null && greenLayer.a >= 0.18);
t('latar: aurora punya aksen ketiga (violet) alpha >= 0.10', violetLayer !== null && violetLayer.a >= 0.10);
t('latar: titik cyan (25%,15%) jelas berwarna — kanal maks >= 50 (v43.1: ' + Math.round(Math.max(...oldCyanPt)) + ')',
  Math.max(...cyanPt) >= 50);
t('latar: titik hijau (78%,72%) jelas berwarna — kanal maks >= 40 (v43.1: ' + Math.round(Math.max(...oldGreenPt)) + ')',
  Math.max(...greenPt) >= 40);
t('latar: titik cyan LEBIH TERANG dari v43.1 (>= +20 kanal)',
  Math.max(...cyanPt) - Math.max(...oldCyanPt) >= 20);
t('latar: titik hijau LEBIH TERANG dari v43.1 (>= +20 kanal)',
  Math.max(...greenPt) - Math.max(...oldGreenPt) >= 20);
const centerPt = compositeAt(50, 50, stack, bodyBase || [0, 0, 0]);
t('latar: titik tengah = base NEO #050607 (bukan #000 murni — panel menutupinya, jadi tengah memang gelap)',
  bodyBase !== null && centerPt.every((v, i) => Math.abs(v - bodyBase[i]) < 1));

// ============ (B) TETAP NOL BIAYA ============
t('biaya: TANPA backdrop-filter di CSS (kode, bukan komentar)', !/backdrop-filter\s*:/.test(cssCode));
t('biaya: TANPA blur() di CSS (kode, bukan komentar)', !/blur\(/.test(cssCode));
t('biaya: TANPA ConvolverNode / reverb di JS (kode, bukan komentar)', !jsCode.includes('createConvolver') && !/verbBus|verbWet|impulse/i.test(jsCode));
t('biaya: TANPA loop partikel di JS (bgBeatPulse/bgInitParticles/bgStepParticles)',
  !jsCode.includes('function bgBeatPulse') && !jsCode.includes('bgInitParticles') && !jsCode.includes('bgStepParticles'));
t('biaya: TANPA canvas partikel / orb di HTML', !html.includes('bg-particles') && !html.includes('class="orb'));
t('biaya: TANPA --beat / orb / drift di CSS', !cssCode.includes('--beat') && !cssCode.includes('.orb') && !/drift[GVP]/.test(cssCode) && !cssCode.includes('sweepY') && !cssCode.includes('@keyframes bgPan'));
const auroraKf = keyframesBody('auroraPan');
t('biaya: animasi background HANYA transform (auroraPan = translate3d saja)',
  auroraKf !== null && /transform: translate3d/.test(auroraKf) && !/opacity|filter|background-position|box-shadow|width|height/.test(auroraKf));
t('biaya: aurora STATIS saat buka — animation:none, baru jalan setelah bg-awake',
  /#bg-aurora \.aurora \{[^}]*animation: none;/.test(cssCode) && cssCode.includes('body.bg-awake:not(.playing):not(.hemat) #bg-aurora .aurora'));
t('biaya: bgWake fungsional — panggilan pertama bangun + tambah class bg-awake',
  __out.w1_awakeBefore === false && __out.w1_awakeAfter === true && __out.w1_hasClass === true);
t('biaya: bgWake idempotent — panggilan kedua no-op (tidak ada rAF baru)',
  __out.w1_raf === 0 && __out.w2_raf === 0);
t('biaya: bgWake + WebGL + ultra — GL jalan (rAF dipanggil)',
  __out.w3_glRunning === true && __out.w3_raf === 1);
t('biaya: bgWake + quality hemat — GL TIDAK jalan',
  __out.w4_glRunning === false && __out.w4_raf === 0);
t('biaya: ECO tetap diam — body.hemat sembunyikan aurora + background datar',
  cssCode.includes('body.hemat #bg-aurora { display: none; }') && /body\.hemat \{[^}]*background: #181818;/.test(cssCode));
t('biaya: overlay OBS tetap transparan (background: transparent)',
  /body\.overlay \{[^}]*background: transparent;/.test(cssCode));

// ============ (C) VERSI + GENESIS + TIDAK ADA REGRESI ============
t('versi: gameVersion v43.6 + judul v43.6', js.includes("gameVersion: 'v43.6'") && html.includes('<title>SQUEEKCHAIN // v43.6</title>'));
t('versi: h2 + footer + meta + README v43.6',
  html.includes('PIXEL ID // v43.6') && html.includes('• v43.6 •') && html.includes('SQUEEKCHAIN v43.6 —') &&
  fs.readFileSync('README.md', 'utf8').startsWith('# Squeekchain v43.6'));
t('genesis: 3 bukti utuh — meta tag + baris README',
  html.includes('name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7"') &&
  fs.readFileSync('README.md', 'utf8').includes('squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7'));
t('regresi: engine.js byte-identik v43.1',
  fs.readFileSync('engine.js').equals(fs.readFileSync('../squeekchain-v43.1/engine.js')));
t('regresi: worker.js byte-identik v43.1',
  fs.readFileSync('worker.js').equals(fs.readFileSync('../squeekchain-v43.1/worker.js')));
let goldenOk = true;
for (const c of golden) { if (JSON.stringify(SqueekEngine.buildChart(c.header)) !== JSON.stringify(c.anthem)) { goldenOk = false; console.log('  golden mismatch:', c.header && c.header.seedKey); } }
t('regresi: 14 chart golden identik (buildChart == fixture v40)', goldenOk);
t('regresi: judgement windows TIDAK berubah (0.045/0.09/0.135, BREAK 0.185)',
  /perfect: 0\.045, great: 0\.09, good: 0\.135/.test(fs.readFileSync('engine.js', 'utf8')) &&
  /BREAK = W\.good \+ 0\.05/.test(fs.readFileSync('engine.js', 'utf8')));
t('regresi: fungsi v43.1 tetap ada — wallet card, restore UX, kapsul self-healing, toko, liga, Lullaby, duel, OBS',
  js.includes('function updateConnectBtn(') && js.includes('function setWcRestoreNote(') && js.includes('sqkHealPendingCapsule') &&
  js.includes('function renderSqkShop(') && js.includes('function renderLeague(') && js.includes('lullaby') &&
  js.includes('?challenge=') && js.includes('?overlay=1'));
t('regresi: pesan kapsul tetap rarity sekali',
  js.includes("const itemLabel = 'Kapsul #' + result.itemId;") && !/itemLabel = 'Kapsul #' \+ result\.itemId \+ ' \(' \+ result\.rarity/.test(js));

console.log(`\nTEST-v43.2: ${pass} passed, ${fail} failed, ${pass + fail} total`);
console.log('  sample piksel — cyan (25%,15%) v43.1 vs v43.2:', oldCyanPt.map(v => Math.round(v)).join(','), '->', cyanPt.map(v => Math.round(v)).join(','));
console.log('  sample piksel — hijau (78%,72%) v43.1 vs v43.2:', oldGreenPt.map(v => Math.round(v)).join(','), '->', greenPt.map(v => Math.round(v)).join(','));
process.exit(fail ? 1 : 0);
