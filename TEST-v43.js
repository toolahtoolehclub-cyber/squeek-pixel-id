// v43.1 — run: node TEST-v43.js  (cwd = the v43.1 folder)
// UPDATED from the v43 suite: the v43 background/audio assertions are
// OBSOLETE by design (v43.1 deletes the particles + convolver reverb +
// the duplicate walletStatus line). This file now tests the v43.1 spec:
// (1) kartu wallet — alamat tampil SATU kali (tanpa baris status ganda);
// (2) background TENANG — satu aurora, tanpa partikel/orb/beat;
// (3) audio RINGAN — delay saja (tanpa convolver), riff 4-bar bervariasi,
// hit tone via duo() kering; chart TIDAK berubah; (4) tampilan —
// satu aksen hijau, panel solid (tanpa backdrop-filter).
// BATAS KERAS yang dites di sini: engine.js byte-identik dengan v43,
// 14 chart golden identik, judgement windows + formula skor tidak berubah,
// worker.js byte-identik (Worker tetap v13), 3 bukti Genesis utuh.
const fs = require('fs');
const SqueekEngine = require('./engine.js');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
// v43.1: code without comments — the "deleted" assertions must not trip on
// the comments that DOCUMENT the deletion.
const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
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
  "  for (const id of ['walletDot','walletAddr','walletCopyBtn','connectBtn','disconnectBtn','wcRestoreNote','scoreVal','comboVal','accVal','gamePanel']) __byId[id] = mockEl();",
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
  // v43.1: bgBeatPulse is DELETED (no particle loop, no beat driver).
  // RIFF_PHRASES is a multi-line const (constObjSrc handles it);
  // ARP_PHRASE is a single line.
  constObjSrc(jsLines, 'RIFF_PHRASES'),
  jsLines.find(l => l.startsWith('const ARP_PHRASE = [')),
  fnSrc(jsLines, 'riffDegreesFor'),
  fnSrc(jsLines, 'arpDegreesFor'),
  fnSrc(jsLines, 'toneFx'),
  fnSrc(jsLines, 'duo'),
  fnSrc(jsLines, 'hitTone'),
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
  "// (2) alamat manual diketik (bukan koneksi) — v43.3: TIDAK tampil di kartu (TAMU), CONNECT tetap ada",
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
  "// (7) v43.1: bgBeatPulse SUDAH DIHAPUS — tidak ada skenario pulse lagi.",
  "// (8) riff per genre — frasa 4-bar, bervariasi per langkah (bukan 1 derajat per bar)",
  "__out.rCyber00 = riffDegreesFor('cyber', 0, 0);",
  "__out.rCyber01 = riffDegreesFor('cyber', 0, 1);",
  "__out.rCyber02 = riffDegreesFor('cyber', 0, 2);",
  "__out.rCyber03 = riffDegreesFor('cyber', 0, 3);",
  "__out.rCyber10 = riffDegreesFor('cyber', 1, 0);",
  "__out.rCyber20 = riffDegreesFor('cyber', 2, 0);",
  "__out.rCyber30 = riffDegreesFor('cyber', 3, 0);",
  "__out.rSynth00 = riffDegreesFor('synth', 0, 0);",
  "__out.rVoid40 = riffDegreesFor('void', 4, 0);",
  "__out.rUnknown = riffDegreesFor('nope', 0, 0);",
  "__out.a00 = arpDegreesFor(0, 0);",
  "__out.a01 = arpDegreesFor(0, 1);",
  "__out.a02 = arpDegreesFor(0, 2);",
  "__out.a10 = arpDegreesFor(1, 0);",
  "__out.a11 = arpDegreesFor(1, 1);",
  "// (10) audio ringan — sumber duo/hitTone/toneFx",
  "__out.duoSrc = duo.toString();",
  "__out.hitToneSrc = hitTone.toString();",
  "__out.toneFxSrc = toneFx.toString();",
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
t('wallet s1: salin tersembunyi, CONNECT tampil + aktif, PUTUSKAN tersembunyi',
  __out.s1_copyHidden && !__out.s1_connHidden && !__out.s1_connDisabled && __out.s1_dcHidden);
t('wallet s2: alamat manual — v43.3 TIDAK tampil di kartu (TAMU), salin tersembunyi, CONNECT tetap ada, dot mati, field bisa diedit',
  __out.s2_addr === 'TAMU' && __out.s2_copyHidden && !__out.s2_connHidden && !__out.s2_dotOn && !__out.s2_readOnly);
t('wallet s3: restoring — dot restoring, CONNECT nonaktif, note terlihat + berisi MENGHUBUNGKAN KEMBALI',
  __out.s3_dotRest && __out.s3_connDisabled && !__out.s3_noteHidden && /MENGHUBUNGKAN KEMBALI/.test(__out.s3_note));
t('wallet s4: terhubung — dot hijau, alamat singkat, CONNECT hilang, PUTUSKAN muncul, field read-only (tanpa baris status ganda)',
  __out.s4_dotOn && __out.s4_addr === '0x8853...cf9a' && __out.s4_connHidden && !__out.s4_dcHidden && __out.s4_readOnly);
t('wallet s5: gagal restore — dot fail, alasan terlihat + menyebut bundle-timeout, CONNECT bisa ditekan',
  __out.s5_dotFail && !__out.s5_noteHidden && /bundle-timeout/.test(__out.s5_note) && !__out.s5_connDisabled);
t('wallet HTML: kartu #walletCard berisi dot/addr/salin/connect/putuskan + baris manual ringkas, TANPA walletStatus',
  html.includes('id="walletCard"') && html.includes('id="walletDot"') && html.includes('id="walletAddr"') &&
  html.includes('id="walletCopyBtn"') && html.includes('id="connectBtn"') && html.includes('id="disconnectBtn"') &&
  html.includes('id="walletManualRow"') && !html.includes('id="walletStatus"') && html.includes('id="wcRestoreNote"'));
t('wallet JS: updateConnectBtn TIDAK PERNAH menyentuh walletStatus (alamat tampil sekali)',
  !js.includes("$('walletStatus')"));
t('wallet HTML: teks panjang MANUAL lama hilang (tidak ada "type an address to play")',
  !/type an address to play/i.test(html) && !/MANUAL — type/i.test(html));
t('wallet i18n: label PENDEK — CONNECT/HUBUNGKAN + ADDRESS/ALAMAT (bukan CONNECT WALLET)',
  js.includes("connect: 'CONNECT'") && js.includes("connect: 'HUBUNGKAN'") &&
  js.includes("addrBtn: 'ADDRESS'") && js.includes("addrBtn: 'ALAMAT'"));

// ============ (b) BACKGROUND TENANG (v43.1) ============
t('bg v43.1: bgBeatPulse + partikel SUDAH DIHAPUS dari script.js',
  !js.includes('function bgBeatPulse') && !js.includes('bgInitParticles') && !js.includes('bgStepParticles') && !js.includes("getElementById('bg-particles')"));
t('bg HTML: SATU aurora saja — tanpa canvas partikel, tanpa orb',
  html.includes('<div id="bg-aurora"') && !html.includes('bg-particles') && !html.includes('class="orb'));
t('bg CSS: tanpa partikel/orb/--beat/driftV — hanya auroraPan (transform saja)',
  !css.includes('#bg-particles') && !css.includes('.orb-v') && !css.includes('--beat') && !css.includes('@keyframes driftV') &&
  css.includes('#bg-aurora') && css.includes('@keyframes auroraPan') && /auroraPan \{ from \{ transform: translate3d/.test(css));
t('bg CSS: aurora diam saat buka (tanpa bg-awake), mati saat main + ECO',
  css.includes('#bg-aurora .aurora') && css.includes('animation: none') && css.includes('body.bg-awake:not(.playing):not(.hemat) #bg-aurora .aurora') &&
  css.includes('body.playing #bg-aurora') && css.includes('body.hemat #bg-aurora'));
t('bg JS: WebGL TIDAK auto-start — bgWake ada + dipanggil dari pointerdown pertama',
  js.includes('function bgWake()') && js.includes("window.addEventListener('pointerdown', () => { bgWake(); startMusicFromTap(); }, {once: true})") &&
  !js.includes("glRunning = true; requestAnimationFrame(renderGL); setText('glStatus'"));
t('bg CSS: transisi tab + tombol primary bergradasi',
  css.includes('@keyframes tabIn') && css.includes('.tab-panel { animation: tabIn') && css.includes('background-position: 100% 0'));
t('bg CSS: !important border-radius:0 pada * SUDAH DIHAPUS (NEO rounded kembali hidup)',
  !/\*\s*\{[^}]*border-radius:\s*0\s*!important/.test(css));
t('bg CSS: reduced-motion mematikan animasi v43.1 (termasuk aurora)', css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('#bg-aurora .aurora { animation: none !important; }'));
t('fx: PERFECT -> .canvas-wrapper dapat class hit-flash', __out.fxFlash === true);
t('fx: comboBurst -> #gamePanel dapat class combo-burst', __out.fxBurst === true);
t('fx: hud FEVER -> skor/kombo/akurat tampil + stat kombo ke-2 menyala emas (class fever)',
  __out.hudScore === 12345 && __out.hudCombo === 42 && __out.hudAcc === '88%' && __out.hudFever === true);

// ============ (c) MUSIK BARU + CHART IDENTIK ============
t('audio: suara baru ada — initFxBus/toneFx/bassNote/snareHit/hatHit/kick2/hitTone',
  js.includes('function initFxBus(') && js.includes('function toneFx(') && js.includes('function bassNote(') &&
  js.includes('function snareHit(') && js.includes('function hatHit(') && js.includes('function kick2(') &&
  js.includes('function hitTone('));
t('audio: delay SAJA di initFxBus — convolver/reverb SUDAH DIHAPUS (tanpa file/CDN)',
  jsCode.includes('createDelay') && !jsCode.includes('createConvolver') && !/verbBus|verbWet|impulse/i.test(jsCode));
t('audio: RIFF_PHRASES 4 genre x 4 bar x 4 langkah — bervariasi per langkah (bukan 1 derajat per bar)',
  __out.rCyber00 === 7 && __out.rCyber01 === 5 && __out.rCyber02 === 4 && __out.rCyber03 === 7 &&
  __out.rCyber10 === 5 && __out.rCyber20 === 7 && __out.rCyber30 === 4 &&
  __out.rSynth00 === 0 && __out.rVoid40 === 0 && __out.rUnknown === 7 &&
  __out.a00 === 0 && __out.a01 === 7 && __out.a02 === 12 && __out.a10 === 0 && __out.a11 === 5);
t('audio: duo() — 2 oscillator (forEach atas 2 frekuensi), 1 gain, TANPA send (echo/reverb)',
  (__out.duoSrc.match(/createOscillator/g) || []).length === 1 && /\[f, f \* 1\.005\]\.forEach/.test(__out.duoSrc) && (__out.duoSrc.match(/createGain/g) || []).length === 1 && !/echoBus|verbBus/.test(__out.duoSrc));
t('audio: hitTone — duo() + sparkle kering, tanpa toneFx (komentar diabaikan)',
  /duo\(f, t, 'sawtooth'/.test(__out.hitToneSrc) && !/toneFx/.test(__out.hitToneSrc.replace(/\/\/.*/g, '')));
t('audio: toneFx — SATU send echo saja, tanpa reverb (komentar diabaikan)',
  /echoBus/.test(__out.toneFxSrc) && !/verbBus|verbWet|createConvolver/.test(__out.toneFxSrc.replace(/\/\/.*/g, '')));
t('audio: schedule() riff via duo + arp via arpDegreesFor, kering (tanpa toneFx)',
  /riffDegreesFor\(G\.genre, barNo, \(stepInBar - 2\) \/ 4\)/.test(js) && /duo\(mtof\(riffMidi\)/.test(js) && /arpDegreesFor\(barNo, stepInBar \/ 4\)/.test(js) && !/toneFx\(mtof\(riffMidi\)/.test(js));
t('audio: scheduleIntro pad 2 nada (root+fifth) — bukan 3',
  /mtof\(60\), t, 'triangle', 0\.04, stepDur \* 8, 0\.6\); toneFx\(mtof\(67\)/.test(js) && !/toneFx\(mtof\(64\), t, 'triangle', 0\.04, stepDur \* 8/.test(js));
t('audio: schedule() memakai suara baru (kick2/snare/hat/bass/riff) + jalur lembut Lullaby',
  /kick2\(/.test(js) && /snareHit\(/.test(js) && /bassNote\(/.test(js) && /riffDegreesFor\(/.test(js) && /soft/.test(js));
t('audio: judge() memakai hitTone (bukan tone lama)', /hitTone\(target\.midi/.test(js));
t('audio: jingle hasil lebih kaya (echo + bass + sparkle)', /playResultJingle/.test(js) && /toneFx\(/.test(js));
t('chart: engine.js v43.1 BYTE-IDENTIK dengan v43 (tidak disentuh)',
  fs.readFileSync('engine.js', 'utf8') === fs.readFileSync('../squeekchain-v43/engine.js', 'utf8'));
t('chart: worker.js v43.1 BYTE-IDENTIK dengan v43 (Worker tetap v13)',
  fs.readFileSync('worker.js', 'utf8') === fs.readFileSync('../squeekchain-v43/worker.js', 'utf8'));
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
t('versi: gameVersion v43.3 + judul v43.3', js.includes("gameVersion: 'v43.3'") && html.includes('<title>SQUEEKCHAIN // v43.3</title>'));

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
