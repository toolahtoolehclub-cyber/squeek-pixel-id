// v43.1 — PERF + DESAIN — run: node TEST-v43.1.js  (cwd = the v43.1 folder)
// Scope: (1) PERFORMA — tanpa backdrop-filter, tanpa partikel, tanpa
// convolver, background statis sampai interaksi pertama, WebGL tidak
// auto-start; (2) AUDIO — riff 4-bar bervariasi (bukan 1 derajat per bar),
// rantai efek ringan; (3) DESAIN — satu aksen hijau, alamat tampil sekali,
// tab 6 kolom, ruang lega; (4) TIDAK ADA REGRESI — engine/worker
// byte-identik v43, chart golden identik, Genesis utuh, Worker v13.
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

// --- extractors (same pattern as TEST-v43.js) ---
function fnSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('function ' + name + '(') || l.startsWith('async function ' + name + '('));
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
function constObjSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('const ' + name + ' = {'));
  if (start < 0) throw new Error('const not found: ' + name);
  let end = start;
  for (let i = start + 1; i < lines.length; i++) { if (lines[i] === '};') { end = i; break; } }
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

// --- Harness: real functions from script.js, run against mock DOM ---
const harnessSrc = [
  "let lang = 'id';",
  "let bgAwake = false;",
  "let gl = null;",
  "let quality = 'ultra';",
  "let glRunning = false;",
  "let __rafCalls = 0;",
  "function requestAnimationFrame(fn) { __rafCalls++; return 1; }",
  "function renderGL() { __glStarted = true; }",
  "let __glStarted = false;",
  "const __bodyCls = mockClassList();",
  "const document = { body: { classList: __bodyCls }, hidden: false };",
  constObjSrc(jsLines, 'RIFF_PHRASES'),
  jsLines.find(l => l.startsWith('const ARP_PHRASE = [')),
  fnSrc(jsLines, 'riffDegreesFor'),
  fnSrc(jsLines, 'arpDegreesFor'),
  fnSrc(jsLines, 'bgWake'),
  "// bgWake #1: pertama kali — bangun + tambah class",
  "__out.w1_awakeBefore = bgAwake;",
  "bgWake();",
  "__out.w1_awakeAfter = bgAwake;",
  "__out.w1_hasClass = __bodyCls.contains('bg-awake');",
  "__out.w1_raf = __rafCalls;",
  "// bgWake #2: kedua kali — no-op (tidak ada rAF lagi)",
  "bgWake();",
  "__out.w2_raf = __rafCalls;",
  "// bgWake #3: dengan WebGL tersedia + quality ultra — GL jalan",
  "bgAwake = false; __glStarted = false; __rafCalls = 0; gl = {}; glRunning = false; quality = 'ultra';",
  "bgWake();",
  "__out.w3_glRunning = glRunning;",
  "__out.w3_raf = __rafCalls;",
  "// bgWake #4: quality hemat — GL TIDAK jalan",
  "bgAwake = false; __glStarted = false; __rafCalls = 0; gl = {}; glRunning = false; quality = 'hemat';",
  "bgWake();",
  "__out.w4_glRunning = glRunning;",
  "__out.w4_raf = __rafCalls;",
  "// riff: urutan 16 nada per genre (4 bar x 4 langkah)",
  "__out.seqCyber = [0,1,2,3].map(b => [0,1,2,3].map(s => riffDegreesFor('cyber', b, s))).flat();",
  "__out.seqSynth = [0,1,2,3].map(b => [0,1,2,3].map(s => riffDegreesFor('synth', b, s))).flat();",
  "__out.seqChip = [0,1,2,3].map(b => [0,1,2,3].map(s => riffDegreesFor('chip', b, s))).flat();",
  "__out.seqVoid = [0,1,2,3].map(b => [0,1,2,3].map(s => riffDegreesFor('void', b, s))).flat();",
  "__out.barCyber0 = [0,1,2,3].map(s => riffDegreesFor('cyber', 0, s));",
  "__out.barCyber1 = [0,1,2,3].map(s => riffDegreesFor('cyber', 1, s));",
  "__out.barCyber2 = [0,1,2,3].map(s => riffDegreesFor('cyber', 2, s));",
  "__out.barCyber3 = [0,1,2,3].map(s => riffDegreesFor('cyber', 3, s));",
].join('\n');
const __out = {};
new Function('__out', 'mockClassList', harnessSrc)(__out, mockClassList);
function noRunOf4(seq) { for (let i = 0; i + 3 < seq.length; i++) if (seq[i] === seq[i + 1] && seq[i] === seq[i + 2] && seq[i] === seq[i + 3]) return false; return true; }
function barsDiffer(a, b) { return JSON.stringify(a) !== JSON.stringify(b); }

// ============ (A) PERFORMA ============
t('perf: TANPA backdrop-filter di CSS (kode, bukan komentar)', !/backdrop-filter\s*:/.test(cssCode));
t('perf: TANPA blur() di CSS (kode, bukan komentar)', !/blur\(/.test(cssCode));
t('perf: TANPA ConvolverNode / reverb di JS (kode, bukan komentar)', !jsCode.includes('createConvolver') && !/verbBus|verbWet|impulse/i.test(jsCode));
t('perf: TANPA loop partikel di JS (bgBeatPulse/bgInitParticles/bgStepParticles)',
  !jsCode.includes('function bgBeatPulse') && !jsCode.includes('bgInitParticles') && !jsCode.includes('bgStepParticles'));
t('perf: TANPA canvas partikel / orb di HTML', !html.includes('bg-particles') && !html.includes('class="orb'));
t('perf: TANPA --beat / orb / drift di CSS', !cssCode.includes('--beat') && !cssCode.includes('.orb') && !/drift[GVP]/.test(cssCode) && !cssCode.includes('sweepY') && !cssCode.includes('@keyframes bgPan'));
const auroraKf = keyframesBody('auroraPan');
t('perf: animasi background HANYA transform/opacity (auroraPan = translate3d saja)',
  auroraKf !== null && /transform: translate3d/.test(auroraKf) && !/opacity|filter|background-position|box-shadow|width|height/.test(auroraKf));
t('perf: aurora STATIS saat buka — animation:none, baru jalan setelah bg-awake',
  /#bg-aurora \.aurora \{[^}]*animation: none;/.test(cssCode) && cssCode.includes('body.bg-awake:not(.playing):not(.hemat) #bg-aurora .aurora'));
t('perf: aurora MATI saat main + ECO + reduced-motion',
  cssCode.includes('body.playing #bg-aurora') && cssCode.includes('body.hemat #bg-aurora') && cssCode.includes('#bg-aurora .aurora { animation: none !important; }'));
t('perf: WebGL TIDAK auto-start — bgWake ada + dipanggil dari pointerdown pertama',
  jsCode.includes('function bgWake()') && jsCode.includes("window.addEventListener('pointerdown', () => { bgWake(); startMusicFromTap(); }, {once: true})"));
t('perf: bgWake fungsional — panggilan pertama bangun + tambah class bg-awake',
  __out.w1_awakeBefore === false && __out.w1_awakeAfter === true && __out.w1_hasClass === true);
t('perf: bgWake idempotent — panggilan kedua no-op (tidak ada rAF baru)',
  __out.w1_raf === 0 && __out.w2_raf === 0);
t('perf: bgWake + WebGL + ultra — GL jalan (rAF dipanggil)',
  __out.w3_glRunning === true && __out.w3_raf === 1);
t('perf: bgWake + quality hemat — GL TIDAK jalan',
  __out.w4_glRunning === false && __out.w4_raf === 0);

// ============ (B) AUDIO — RIFF BERVARIASI, RANTAI RINGAN ============
t('audio: riff TIDAK monoton — tidak ada 4 nada beruntun yang sama (tiap genre)',
  noRunOf4(__out.seqCyber) && noRunOf4(__out.seqSynth) && noRunOf4(__out.seqChip) && noRunOf4(__out.seqVoid));
t('audio: tiap bar riff BERBEDA — bar 1 != bar 2 != bar 3 != bar 4 (cyber)',
  barsDiffer(__out.barCyber0, __out.barCyber1) && barsDiffer(__out.barCyber1, __out.barCyber2) && barsDiffer(__out.barCyber2, __out.barCyber3) && barsDiffer(__out.barCyber0, __out.barCyber3));
t('audio: frasa riff 16 nada punya variasi (≥6 derajat berbeda per genre)',
  new Set(__out.seqCyber).size >= 6 && new Set(__out.seqSynth).size >= 6 && new Set(__out.seqChip).size >= 6 && new Set(__out.seqVoid).size >= 6);
t('audio: hitTone + duo + toneFx ringan (tanpa reverb, tanpa send ganda)',
  jsCode.includes('function duo(') && /duo\(f, t, 'sawtooth'/.test(jsCode) && !/toneFx\(f, t, 'sawtooth'/.test(jsCode));

// ============ (C) DESAIN — SATU AKSEN, ALAMAT SEKALI, RUANG LEGA ============
t('desain: TANPA warna per-tab di CSS (tidak ada [data-tab=])', !/\[data-tab=/.test(cssCode));
t('desain: TANPA warna per-mode di CSS (tidak ada --mode-accent)', !/--mode-accent/.test(cssCode));
t('desain: tab aktif = hijau solid (#00ff88 + teks hitam)', /\.tab-btn\.active \{\s*background: #00ff88; color: #000;/.test(cssCode));
t('desain: pill aktif = hijau solid (#00ff88 + teks hitam)', /\.btn-diff\.active \{\s*background: #00ff88; color: #000;/.test(cssCode));
t('desain: tab bar 6 kolom — PLAY/DAILY/LIVE/LEAGUE/SHOP/ME sebaris',
  (cssCode.match(/repeat\(6, 1fr\)/g) || []).length >= 2 && html.includes('data-tab="shop"') && html.includes('data-tab="me"'));
t('desain: panel + kartu wallet SOLID (#0a0d0f), bukan gradasi kaca',
  /\.panel \{\s*background: #0a0d0f;/.test(cssCode) && /\.wallet-card \{[^}]*background: #0a0d0f;/.test(cssCode));
t('desain: kartu avatar tenang — tanpa border dashed, tanpa bayangan pink',
  !/#avatarPreviewWrap \{[^}]*dashed/.test(cssCode) && !/#avatar-preview \{[^}]*var\(--pink\)/.test(cssCode));
t('desain: ruang lega — ui-layer gap 24, tab-panel gap 16',
  /#ui-layer \{[^}]*gap: 24px;/.test(cssCode) && /\.tab-panel \{[^}]*gap: 16px;/.test(cssCode));
t('desain: alamat tampil SEKALI — tanpa walletStatus di HTML maupun JS',
  !html.includes('id="walletStatus"') && !jsCode.includes("$('walletStatus')") && !/\.wallet-status \{/.test(cssCode));

// ============ (D) TIDAK ADA REGRESI ============
t('regresi: engine.js v43.1 BYTE-IDENTIK dengan v43 (tidak disentuh)',
  fs.readFileSync('engine.js', 'utf8') === fs.readFileSync('../squeekchain-v43/engine.js', 'utf8'));
t('regresi: worker.js v43.1 BYTE-IDENTIK dengan v43 (Worker tetap v13)',
  fs.readFileSync('worker.js', 'utf8') === fs.readFileSync('../squeekchain-v43/worker.js', 'utf8'));
t('regresi: Worker v13 (GET / -> version 13)',
  fs.readFileSync('worker.js', 'utf8').includes('version: 13'));
let goldenOk = true;
for (const c of golden) { if (JSON.stringify(SqueekEngine.buildChart(c.header)) !== JSON.stringify(c.anthem)) { goldenOk = false; console.log('  golden mismatch:', c.header && c.header.seedKey); } }
t('regresi: 14 chart golden identik (buildChart == fixture v40)', goldenOk);
t('regresi: judgement windows TIDAK berubah (0.045/0.09/0.135, BREAK 0.185)',
  /perfect: 0\.045, great: 0\.09, good: 0\.135/.test(fs.readFileSync('engine.js', 'utf8')) &&
  /BREAK = W\.good \+ 0\.05/.test(fs.readFileSync('engine.js', 'utf8')));
t('regresi: gameVersion v43.6 + judul v43.6',
  js.includes("gameVersion: 'v43.6'") && html.includes('<title>SQUEEKCHAIN // v43.6</title>'));
t('regresi: 3 bukti Genesis utuh — meta tag + baris README',
  html.includes('name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7"') &&
  fs.readFileSync('README.md', 'utf8').includes('squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7'));
t('regresi: fungsi v43 tetap ada — wallet card, restore UX, kapsul self-healing, toko, liga, Lullaby, duel, OBS',
  js.includes('function updateConnectBtn(') && js.includes('function setWcRestoreNote(') && js.includes('sqkHealPendingCapsule') &&
  js.includes('function renderSqkShop(') && js.includes('function renderLeague(') && js.includes('lullaby') &&
  js.includes('?challenge=') && js.includes('?overlay=1'));
t('regresi: pesan kapsul tetap rarity sekali',
  js.includes("const itemLabel = 'Kapsul #' + result.itemId;") && !/itemLabel = 'Kapsul #' \+ result\.itemId \+ ' \(' \+ result\.rarity/.test(js));

console.log(`\nTEST-v43.1: ${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail ? 1 : 0);
