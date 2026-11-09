// v43 REVOLUTION — run: node TEST-v43.js  (cwd = the v43 folder)
// Scope: (1) kartu wallet baru — satu bar elegan, label pendek, alamat
// singkat 0x8853…cf9a + salin, dot hijau / restoring / gagal; (2) background
// hidup — aurora + partikel ikut beat, bereaksi saat hit/combo/ZOOMIES;
// (3) musik baru — synth lebih kaya (bass/drum/arpeggio/delay/reverb),
// melodi tiap genre baru, chart TIDAK berubah; (4) tampilan keseluruhan —
// kaca/gradasi/glow, transisi tab, efek pukulan, panel hasil lebih bersih.
// + Perbaikan kosmetik parent (09:01 WIB): pesan resolve kapsul tidak lagi
// menampilkan rarity dua kali — "Kapsul #102 (rare) (rare) ✓" -> sekali.
// BATAS KERAS yang dites di sini: engine.js byte-identik dengan v42.5.4,
// 14 chart golden identik, judgement windows + formula skor tidak berubah,
// worker.js byte-identik (Worker tetap v13), 3 bukti Genesis utuh.
const fs = require('fs');
const SqueekEngine = require('./engine.js');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const jsLines = js.split('\n');
const golden = JSON.parse(fs.readFileSync('TEST-v40-golden-charts.json', 'utf8'));

let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }

// --- extractors (same pattern as TEST-v42.5.4-restore-ui.js) ---
function fnSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('function ' + name + '(') || l.startsWith('async function ' + name + '('));
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
// Top-level const object: from "const NAME = {" to the first line that is exactly "};"
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
  };
}
function mockEl() { return { textContent: '', disabled: false, readOnly: false, value: '', classList: mockClassList() }; }

// --- Harness: real functions from script.js, run against mock DOM ---
const harnessSrc = [
  "let lang = 'id';",
  "let connectedAddr = null;",
  "let wcRestoreReason = null;",
  "let walletEl = { value: '', readOnly: false };",
  "let G = { score: 0, combo: 0, fever: false };",
  "const __byId = {};",
  "const __bySel = {};",
  "function __resetEls() { for (const k of Object.keys(__byId)) delete __byId[k]; for (const k of Object.keys(__bySel)) delete __bySel[k];",
  "  for (const id of ['walletDot','walletAddr','walletCopyBtn','connectBtn','disconnectBtn','walletStatus','wcRestoreNote','scoreVal','comboVal','accVal','gamePanel']) __byId[id] = mockEl();",
  "  __bySel['.stat'] = mockEl(); __bySel['.canvas-wrapper'] = mockEl();",
  "  __bySel['.stat2'] = mockEl();",
  "  __stats = [mockEl(), mockEl()];",
  "  document.querySelectorAll = () => __stats; }",
  "let __stats = [];",
  "function $(id) { return __byId[id] || null; }",
  "const document = { querySelector: sel => __bySel[sel] || null, querySelectorAll: () => [mockEl(), mockEl()], getElementById: id => __byId[id] || null, documentElement: { style: { setProperty() {} } }, body: { classList: { contains() { return false; }, add() {}, remove() {}, toggle() {} } }, hidden: false };",
  "function accuracy() { return 87.5; }",
  constObjSrc(jsLines, 'MSG'),
  constObjSrc(jsLines, 'I18N'),
  "function msg(k) { const d = MSG[lang] || MSG.en; return d[k] !== undefined ? d[k] : (MSG.en[k] !== undefined ? MSG.en[k] : k); }",
  "function msgf(k, vars) { let s = msg(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; }",
  "const isAddr = s => /^0x[a-fA-F0-9]{40}$/.test(s);",
  fnSrc(jsLines, 'shortAddr'),
  fnSrc(jsLines, 'updateConnectBtn'),
  fnSrc(jsLines, 'setWcRestoreNote'),
  fnSrc(jsLines, 'bgBeatPulse'),
  // RIFF_PATTERNS is a single-line const — take that line only (constObjSrc
  // would swallow code up to the next "};" line, incl. window.* calls).
  jsLines.find(l => l.startsWith('const RIFF_PATTERNS = {')),
  fnSrc(jsLines, 'riffDegreesFor'),
  fnSrc(jsLines, 'juiceHit'),
  fnSrc(jsLines, 'comboBurst'),
  fnSrc(jsLines, 'hud'),
  // Scenarios — results collected into __out.
  "__resetEls();",
  "__out.shortGen = shortAddr('0x88538a82143065664232422e2dec4309038fcf9a');",
  "__out.shortEmpty = shortAddr('');",
  "__out.shortBad = shortAddr('not-an-address');",
  "// (1) belum connect, tidak ada alamat ketik",
  "__resetEls(); updateConnectBtn();",
  "__out.s1_dotOn = __byId.walletDot.classList.contains('on');",
  "__out.s1_dotRest = __byId.walletDot.classList.contains('restoring');",
  "__out.s1_dotFail = __byId.walletDot.classList.contains('fail');",
  "__out.s1_addr = __byId.walletAddr.textContent;",
  "__out.s1_copyHidden = __byId.walletCopyBtn.classList.contains('hidden');",
  "__out.s1_connHidden = __byId.connectBtn.classList.contains('hidden');",
  "__out.s1_connDisabled = __byId.connectBtn.disabled;",
  "__out.s1_dcHidden = __byId.disconnectBtn.classList.contains('hidden');",
  "__out.s1_statusHidden = __byId.walletStatus.classList.contains('hidden');",
  "// (2) alamat manual diketik (bukan koneksi) — tampil singkat, CONNECT tetap ada",
  "__resetEls(); walletEl.value = '0x88538a82143065664232422e2dec4309038fcf9a'; updateConnectBtn();",
  "__out.s2_addr = __byId.walletAddr.textContent;",
  "__out.s2_copyHidden = __byId.walletCopyBtn.classList.contains('hidden');",
  "__out.s2_connHidden = __byId.connectBtn.classList.contains('hidden');",
  "__out.s2_dotOn = __byId.walletDot.classList.contains('on');",
  "__out.s2_readOnly = walletEl.readOnly;",
  "// (3) restoring — dot cyan berdenyut, CONNECT nonaktif",
  "__resetEls(); walletEl.value = ''; setWcRestoreNote('restoring');",
  "__out.s3_dotRest = __byId.walletDot.classList.contains('restoring');",
  "__out.s3_connDisabled = __byId.connectBtn.disabled;",
  "__out.s3_noteHidden = __byId.wcRestoreNote.classList.contains('hidden');",
  "__out.s3_note = __byId.wcRestoreNote.textContent;",
  "// (4) terhubung — dot hijau, alamat singkat, CONNECT hilang, PUTUSKAN muncul, status terlihat",
  "__resetEls(); walletEl.value = ''; connectedAddr = '0x88538a82143065664232422e2dec4309038fcf9a'; wcRestoreReason = null; updateConnectBtn();",
  "__out.s4_dotOn = __byId.walletDot.classList.contains('on');",
  "__out.s4_addr = __byId.walletAddr.textContent;",
  "__out.s4_connHidden = __byId.connectBtn.classList.contains('hidden');",
  "__out.s4_dcHidden = __byId.disconnectBtn.classList.contains('hidden');",
  "__out.s4_statusHidden = __byId.walletStatus.classList.contains('hidden');",
  "__out.s4_status = __byId.walletStatus.textContent;",
  "__out.s4_readOnly = walletEl.readOnly;",
  "// (5) gagal restore — dot amber, alasan jelas, CONNECT bisa ditekan lagi",
  "__resetEls(); connectedAddr = null; setWcRestoreNote('bundle-timeout');",
  "__out.s5_dotFail = __byId.walletDot.classList.contains('fail');",
  "__out.s5_noteHidden = __byId.wcRestoreNote.classList.contains('hidden');",
  "__out.s5_note = __byId.wcRestoreNote.textContent;",
  "__out.s5_connDisabled = __byId.connectBtn.disabled;",
  "// (6) kapsul: pesan resolve — rarity SEKALI saja (perbaikan kosmetik parent 09:01 WIB)",
  "__out.capEn = (() => { lang = 'en'; return msgf('sqkResolved', { item: 'Kapsul #102', rarity: 'rare' }); })();",
  "__out.capId = (() => { lang = 'id'; return msgf('sqkResolved', { item: 'Kapsul #102', rarity: 'rare' }); })();",
  "__out.capDup = (() => { lang = 'en'; return msgf('sqkDupKeju', { item: 'Kapsul #102', rarity: 'rare', n: 50 }); })();",
  "// (7) background pulse murni",
  "__out.p0 = bgBeatPulse(0, 0, false);",
  "__out.p1 = bgBeatPulse(0.5, 0, false);",
  "__out.p2 = bgBeatPulse(0, 30, false);",
  "__out.p3 = bgBeatPulse(0, 0, true);",
  "__out.p4 = bgBeatPulse(1, 100, true);",
  "__out.p5 = bgBeatPulse(0.9, 50, true);",
  "// (8) riff per genre",
  "__out.rCyber0 = riffDegreesFor('cyber', 0);",
  "__out.rCyber1 = riffDegreesFor('cyber', 1);",
  "__out.rSynth0 = riffDegreesFor('synth', 0);",
  "__out.rVoid4 = riffDegreesFor('void', 4);",
  "__out.rUnknown = riffDegreesFor('nope', 0);",
  "// (9) hit FX: PERFECT -> flash canvas; comboBurst -> burst panel; hud FEVER -> stat emas",
  "__resetEls(); juiceHit('perfect');",
  "__out.fxFlash = __bySel['.canvas-wrapper'].classList.contains('hit-flash');",
  "__resetEls(); comboBurst();",
  "__out.fxBurst = __byId.gamePanel.classList.contains('combo-burst');",
  "__resetEls(); G = { score: 12345, combo: 42, fever: true }; hud();",
  "__out.hudScore = __byId.scoreVal.textContent;",
  "__out.hudCombo = __byId.comboVal.textContent;",
  "__out.hudAcc = __byId.accVal.textContent;",
  "__out.hudFever = __stats[1].classList.contains('fever');",
].join('\n');
const __out = {};
new Function('__out', 'mockEl', harnessSrc)(__out, mockEl);

// ============ (a) KARTU WALLET ============
t('wallet: shortAddr Genesis = 0x8853...cf9a', __out.shortGen === '0x8853...cf9a');
t('wallet: shortAddr kosong/bukan-alamat = ""', __out.shortEmpty === '' && __out.shortBad === '');
t('wallet s1: belum connect — dot mati semua', !__out.s1_dotOn && !__out.s1_dotRest && !__out.s1_dotFail);
t('wallet s1: belum connect — alamat TAMU (ID)', __out.s1_addr === 'TAMU');
t('wallet s1: salin tersembunyi, CONNECT tampil + aktif, PUTUSKAN + status tersembunyi',
  __out.s1_copyHidden && !__out.s1_connHidden && !__out.s1_connDisabled && __out.s1_dcHidden && __out.s1_statusHidden);
t('wallet s2: alamat manual — tampil singkat, salin muncul, CONNECT tetap ada, dot mati, field bisa diedit',
  __out.s2_addr === '0x8853...cf9a' && !__out.s2_copyHidden && !__out.s2_connHidden && !__out.s2_dotOn && !__out.s2_readOnly);
t('wallet s3: restoring — dot restoring, CONNECT nonaktif, note terlihat + berisi MENGHUBUNGKAN KEMBALI',
  __out.s3_dotRest && __out.s3_connDisabled && !__out.s3_noteHidden && /MENGHUBUNGKAN KEMBALI/.test(__out.s3_note));
t('wallet s4: terhubung — dot hijau, alamat singkat, CONNECT hilang, PUTUSKAN muncul, status TERHUBUNG + alamat singkat',
  __out.s4_dotOn && __out.s4_addr === '0x8853...cf9a' && __out.s4_connHidden && !__out.s4_dcHidden &&
  !__out.s4_statusHidden && __out.s4_status === '● 0x8853...cf9a — TERHUBUNG' && __out.s4_readOnly);
t('wallet s5: gagal restore — dot fail, alasan terlihat + menyebut bundle-timeout, CONNECT bisa ditekan',
  __out.s5_dotFail && !__out.s5_noteHidden && /bundle-timeout/.test(__out.s5_note) && !__out.s5_connDisabled);
t('wallet HTML: kartu #walletCard berisi dot/addr/salin/connect/putuskan + baris manual ringkas',
  html.includes('id="walletCard"') && html.includes('id="walletDot"') && html.includes('id="walletAddr"') &&
  html.includes('id="walletCopyBtn"') && html.includes('id="connectBtn"') && html.includes('id="disconnectBtn"') &&
  html.includes('id="walletManualRow"') && html.includes('id="walletStatus"') && html.includes('id="wcRestoreNote"'));
t('wallet HTML: teks panjang MANUAL lama hilang (tidak ada "type an address to play")',
  !/type an address to play/i.test(html) && !/MANUAL — type/i.test(html));
t('wallet i18n: label PENDEK — CONNECT/HUBUNGKAN + ADDRESS/ALAMAT (bukan CONNECT WALLET)',
  js.includes("connect: 'CONNECT'") && js.includes("connect: 'HUBUNGKAN'") &&
  js.includes("addrBtn: 'ADDRESS'") && js.includes("addrBtn: 'ALAMAT'"));

// ============ (b) BACKGROUND HIDUP ============
t('bg pulse: sunyi = 0', __out.p0 === 0);
t('bg pulse: audio 0.5 saja ≈ 0.55', Math.abs(__out.p1 - 0.55) < 1e-9);
t('bg pulse: combo 30 = +0.25', __out.p2 === 0.25);
t('bg pulse: ZOOMIES = +0.25', __out.p3 === 0.25);
t('bg pulse: maksimal dijepit ke 1', __out.p4 === 1 && __out.p5 === 1);
t('bg HTML: canvas #bg-particles + orb violet ketiga ada',
  html.includes('<canvas id="bg-particles"') && html.includes('class="orb orb-v"'));
t('bg CSS: layer partikel + orb-v + --beat + animasi denyut ada',
  css.includes('#bg-particles') && css.includes('.orb-v') && css.includes('--beat') && css.includes('@keyframes driftV'));
t('bg CSS: partikel disembunyikan saat main (hemat performa) + ECO',
  css.includes('body.playing #bg-particles') && css.includes('body.hemat #bg-particles'));
t('bg CSS: transisi tab + tombol primary bergradasi',
  css.includes('@keyframes tabIn') && css.includes('.tab-panel { animation: tabIn') && css.includes('background-position: 100% 0'));
t('bg CSS: !important border-radius:0 pada * SUDAH DIHAPUS (NEO rounded kembali hidup)',
  !/\*\s*\{[^}]*border-radius:\s*0\s*!important/.test(css));
t('bg CSS: reduced-motion mematikan animasi v43', css.includes('@media (prefers-reduced-motion: reduce)'));
t('fx: PERFECT -> .canvas-wrapper dapat class hit-flash', __out.fxFlash === true);
t('fx: comboBurst -> #gamePanel dapat class combo-burst', __out.fxBurst === true);
t('fx: hud FEVER -> skor/kombo/akurat tampil + stat kombo ke-2 menyala emas (class fever)',
  __out.hudScore === 12345 && __out.hudCombo === 42 && __out.hudAcc === '88%' && __out.hudFever === true);

// ============ (c) MUSIK BARU + CHART IDENTIK ============
t('audio: suara baru ada — initFxBus/toneFx/bassNote/snareHit/hatHit/kick2/hitTone',
  js.includes('function initFxBus(') && js.includes('function toneFx(') && js.includes('function bassNote(') &&
  js.includes('function snareHit(') && js.includes('function hatHit(') && js.includes('function kick2(') &&
  js.includes('function hitTone('));
t('audio: delay + reverb sintetis di initFxBus (tanpa file/CDN)',
  js.includes('createDelay') && /feedback/.test(js) && /impulse|convolver/i.test(js));
t('audio: RIFF_PATTERNS 4 genre x 8 langkah', __out.rCyber0 === 7 && __out.rCyber1 === 5 && __out.rSynth0 === 0 && __out.rVoid4 === 6 && __out.rUnknown === 7);
t('audio: schedule() memakai suara baru (kick2/snare/hat/bass/riff) + jalur lembut Lullaby',
  /kick2\(/.test(js) && /snareHit\(/.test(js) && /bassNote\(/.test(js) && /riffDegreesFor\(/.test(js) && /soft/.test(js));
t('audio: judge() memakai hitTone (bukan tone lama)', /hitTone\(target\.midi/.test(js));
t('audio: jingle hasil lebih kaya (echo + bass + sparkle)', /playResultJingle/.test(js) && /toneFx\(/.test(js));
t('chart: engine.js v43 BYTE-IDENTIK dengan v42.5.4 (tidak disentuh)',
  fs.readFileSync('engine.js', 'utf8') === fs.readFileSync('../squeekchain-v42.5.4/engine.js', 'utf8'));
t('chart: worker.js v43 BYTE-IDENTIK dengan v42.5.4 (Worker tetap v13)',
  fs.readFileSync('worker.js', 'utf8') === fs.readFileSync('../squeekchain-v42.5.4/worker.js', 'utf8'));
let goldenOk = true;
for (const c of golden) { if (JSON.stringify(SqueekEngine.buildChart(c.header)) !== JSON.stringify(c.anthem)) { goldenOk = false; console.log('  golden mismatch:', c.header && c.header.seedKey); } }
t('chart: 14 chart golden identik (buildChart == fixture v40)', goldenOk);
let sweepOk = true;
for (const mode of ['free', 'daily', 'live', 'race', 'boss']) for (const diff of ['easy', 'normal', 'hard']) for (const seed of [1, 42, 1234567, 2400307847]) {
  const h1 = { mode, genre: 'cyber', diff, lanes: 3, mirror: false, seed, seedKey: mode + '-' + seed };
  const a = JSON.stringify(SqueekEngine.buildChart(h1)), b = JSON.stringify(SqueekEngine.buildChart(h1));
  if (a !== b || JSON.parse(a).length === 0) sweepOk = false;
}
t('chart: sapuan 60 kombinasi mode/diff/seed deterministik + berisi note', sweepOk);
t('chart: judgement windows TIDAK berubah (0.045/0.09/0.135, BREAK 0.185)',
  /perfect: 0\.045, great: 0\.09, good: 0\.135/.test(fs.readFileSync('engine.js', 'utf8')) &&
  /BREAK = W\.good \+ 0\.05/.test(fs.readFileSync('engine.js', 'utf8')));
t('versi: gameVersion v43 + judul v43', js.includes("gameVersion: 'v43'") && /v43/.test(html));

// ============ (d) PANEL HASIL + PESAN KAPSUL ============
t('kapsul EN: "CAPSULE: Kapsul #102 (rare) ✓" — rarity SEKALI', __out.capEn === 'CAPSULE: Kapsul #102 (rare) ✓');
t('kapsul ID: "KAPSUL: Kapsul #102 (rare) ✓" — rarity SEKALI', __out.capId === 'KAPSUL: Kapsul #102 (rare) ✓');
t('kapsul duplikat: rarity sekali + kompensasi', __out.capDup === 'CAPSULE: Kapsul #102 (rare, DUPLICATE) → +50 🧀');
t('kapsul sumber: baris itemLabel lama (rarity di dalam label) SUDAH HILANG',
  !/itemLabel = 'Kapsul #' \+ result\.itemId \+ ' \(' \+ result\.rarity/.test(js) &&
  js.includes("const itemLabel = 'Kapsul #' + result.itemId;"));
t('panel hasil CSS: animasi masuk + cincin glow grade + baris kv ber-garis halus',
  css.includes('#resultPanel { animation: resultIn') && css.includes('#resultPanel .grade::before') && css.includes('.kv span, .kv b'));
t('panel hasil JS: struktur kv tetap (skor/akurat/kombo/perfect-great/good-miss)',
  /resultKv.*score.*acc.*combo/s.test(js) || (js.includes("rl('score')") && js.includes("rl('acc')") && js.includes("rl('combo')")));

// ============ (e) BUKTI GENESIS + TIDAK ADA REGRESI ============
t('genesis: meta tag bukti ada di index.html', html.includes('name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7"'));
t('genesis: baris README ada', fs.readFileSync('README.md', 'utf8').includes('squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7'));
t('genesis: bundle WC tetap vendored lokal (tanpa CDN baru)', js.includes("s.src = 'wc-provider.bundle.js'") && !/unpkg\.com|cdn\.jsdelivr/.test(js));
t('genesis: tidak ada dependensi CDN baru di index.html', !/unpkg\.com|cdn\.jsdelivr|cdnjs/.test(html));

console.log(`\nTEST-v43: ${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail ? 1 : 0);
