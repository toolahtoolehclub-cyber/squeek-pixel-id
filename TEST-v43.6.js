// v43.6 — run: node TEST-v43.6.js  (cwd = the v43.6 folder)
// EQUIP TERIKAT WALLET: skin/frame yang di-equip hanya berlaku bila ada
// wallet yang benar-benar terhubung. User melaporkan (9 Nov 2026,
// ~23:47 WIB): setelah DISCONNECT, hasil equip dari sesi connect MASIH
// berpengaruh saat main — tampilannya tidak kembali ke default. Benar:
// shopSkin() v43.5 membaca equip dari localStorage tanpa mengecek
// koneksi, jadi setelah disconnect warna not + frame tetap menempel,
// padahal v43.4 sudah menetapkan semua yang terikat wallet hanya tampil
// saat terhubung. v43.6 memberi gate di shopSkin() (GUEST -> default)
// dan setConnected() menerapkan ulang frame seketika saat connect /
// disconnect. Equip yang tersimpan TIDAK dihapus — reconnect
// mengembalikannya.
// BATAS KERAS: engine.js + worker.js byte-identik v43.5, 14 chart golden
// identik, judgement windows + formula skor tidak berubah, Worker tetap
// v13, 3 bukti Genesis utuh, tanpa CDN/dependensi baru, gating v43.4
// (connected-only profile/shop/rank) TIDAK berubah, perilaku frame
// v43.5 di dalam game TIDAK berubah (saat connect), alur beli toko
// TIDAK disentuh.
const fs = require('fs');
const SqueekEngine = require('./engine.js');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const jsLines = js.split('\n');
const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const golden = JSON.parse(fs.readFileSync('TEST-v40-golden-charts.json', 'utf8'));

let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }

// --- extractors (same pattern as TEST-v42.5.4-restore-ui.js / TEST-v43.5.js) ---
function fnSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('function ' + name + '(') || l.startsWith('async function ' + name + '('));
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
function fnSrcJ(name) { return fnSrc(jsLines, name); }
function mockClassList() {
  const set = new Set();
  return {
    toggle(cls, force) { if (force === undefined) { if (set.has(cls)) set.delete(cls); else set.add(cls); } else if (force) set.add(cls); else set.delete(cls); },
    add(cls) { set.add(cls); }, remove(cls) { set.delete(cls); },
    contains(cls) { return set.has(cls); },
  };
}
function mockEl() { return { textContent: '', disabled: false, readOnly: false, value: '', classList: mockClassList(), addEventListener() {} }; }

// --- real consts, evaluated from source (pure literals) ---
const FRAME_SKINS = new Function('return ' + js.match(/const FRAME_SKINS = (\[[^\]]*\]);/)[1])();
const NOTE_SKINS = new Function('return ' + js.match(/const NOTE_SKINS = (\{[\s\S]*?\n\});/)[1])();
// isAddr is a const arrow (line 24), not a function declaration — eval the
// same literal from source so the harness uses the REAL validator.
const isAddr = new Function('return ' + js.match(/const isAddr = (s => .*?);/)[1])();
const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a'; // user Genesis wallet

// --- harness: REAL shopSkin + applyResultFrame + noteColor + connectedWallet
// + sqkIsEquipped + setConnected, mock DOM + mock localStorage store.
// connectedAddr lives as a `let` in the wrapper scope, so the REAL
// setConnected() drives it exactly like the live page (connect,
// disconnect, account-switch). Render/fetch collaborators are no-op
// stubs — setConnected() wraps them in try/catch anyway.
function mkHarness(storeInit, opts) {
  const store = new Map(Object.entries(storeInit || {}));
  const els = {};
  if (!(opts && opts.noGamePanel)) els.gamePanel = mockEl();
  if (!(opts && opts.noResultPanel)) els.resultPanel = mockEl();
  const localStorageStub = { getItem: () => null, setItem() {}, removeItem() {} };
  const src = [fnSrcJ('shopSkin'), fnSrcJ('applyResultFrame'), fnSrcJ('noteColor'), fnSrcJ('connectedWallet'), fnSrcJ('sqkIsEquipped'), fnSrcJ('setConnected')].join('\n');
  const noop = () => {};
  const api = new Function('$', 'loadJSON', 'saveJSON', 'localStorage', 'FRAME_SKINS', 'NOTE_SKINS', 'isAddr', 'updateConnectBtn', 'setWcRestoreNote', 'renderAvatarPreview', 'renderShop', 'renderSqkShop', 'renderLb', 'renderLeagueWeekly', 'fetchShop', 'fetchSqkShop', 'fetchLbRank', 'fetchLeagueWeekly',
    'let connectedAddr = null;\n' + src + '\nreturn { shopSkin, applyResultFrame, noteColor, connectedWallet, sqkIsEquipped, setConnected, getAddr(){ return connectedAddr; } };'
  )(
    id => els[id] || null,
    (k, fb) => store.has(k) ? store.get(k) : fb,
    (k, v) => { store.set(k, v); },
    localStorageStub,
    FRAME_SKINS, NOTE_SKINS, isAddr, noop, noop, noop, noop, noop, noop, noop, noop, noop, noop, noop
  );
  return { api, els, store };
}
function hasNoFrame(el) { return FRAME_SKINS.every(f => !el.classList.contains(f)); }
function hasOnlyFrame(el, f) { return el.classList.contains(f) && FRAME_SKINS.filter(x => x !== f).every(x => !el.classList.contains(x)); }

const EQUIPPED = {
  'sqk41:skin-keju': { note: 'note-mint', frame: 'frame-neon' },
  'sqk41:skin-sqk': { note: 'note-sqk-rare', frame: 'frame-sqk' },
  'sqk41:skin-last': { note: 'sqk', frame: 'sqk' },
};

(async () => {
  // ===== Part A — shopSkin() gate: GUEST -> default, connected -> stored =====
  // A1: equip tersimpan, TIDAK ada wallet terhubung -> default.
  {
    const h = mkHarness(EQUIPPED);
    const s = h.api.shopSkin();
    t('v43.6 A1: equip tersimpan + GUEST -> shopSkin() = {note:null, frame:null}', s.note === null && s.frame === null);
  }
  // A2: equip tersimpan + wallet terhubung -> equip yang tersimpan (last=sqk).
  {
    const h = mkHarness(EQUIPPED);
    h.api.setConnected(ADDR);
    const s = h.api.shopSkin();
    t('v43.6 A2: equip tersimpan + connected -> shopSkin() = equip SQK (note-sqk-rare, frame-sqk)', s.note === 'note-sqk-rare' && s.frame === 'frame-sqk');
  }
  // A3: last=keju + connected -> equip Keju yang menang.
  {
    const h = mkHarness({ 'sqk41:skin-keju': { note: 'note-gold', frame: 'frame-gold' }, 'sqk41:skin-sqk': { note: 'note-sqk-rare', frame: 'frame-sqk' }, 'sqk41:skin-last': { note: 'keju', frame: 'keju' } });
    h.api.setConnected(ADDR);
    const s = h.api.shopSkin();
    t('v43.6 A3: last=keju + connected -> shopSkin() = equip Keju (note-gold, frame-gold)', s.note === 'note-gold' && s.frame === 'frame-gold');
  }
  // A4: store kosong + connected -> default, tanpa crash.
  {
    const h = mkHarness({});
    h.api.setConnected(ADDR);
    const s = h.api.shopSkin();
    t('v43.6 A4: store kosong + connected -> shopSkin() = default', s.note === null && s.frame === null);
  }
  // A5: migrasi legacy (kunci lama sqk41:skin) hanya jalan saat connected;
  // saat GUEST kunci lama TIDAK disentuh (migrasi tertunda sampai connect).
  {
    const h = mkHarness({ 'sqk41:skin': { note: 'note-void', frame: 'frame-royal' } });
    const sGuest = h.api.shopSkin();
    const legacyKept = h.store.has('sqk41:skin') && h.store.get('sqk41:skin').frame === 'frame-royal';
    t('v43.6 A5: legacy key + GUEST -> default DAN kunci lama tidak disentuh', sGuest.note === null && sGuest.frame === null && legacyKept);
    h.api.setConnected(ADDR);
    const sConn = h.api.shopSkin();
    t('v43.6 A5: legacy key + connected -> migrasi jalan, equip legacy kembali', sConn.note === 'note-void' && sConn.frame === 'frame-royal');
  }
  // A6: cek EQUIPPED toko ikut gate (setuju dengan tampilan v43.4 yang
  // disembunyikan saat GUEST).
  {
    const h = mkHarness(EQUIPPED);
    const frameItem = { slot: 'frame', skin: 'frame-sqk' };
    const noteItem = { slot: 'note', skin: 'note-sqk-rare' };
    const guestEq = h.api.sqkIsEquipped(frameItem) === false && h.api.sqkIsEquipped(noteItem) === false;
    h.api.setConnected(ADDR);
    const connEq = h.api.sqkIsEquipped(frameItem) === true && h.api.sqkIsEquipped(noteItem) === true;
    t('v43.6 A6: sqkIsEquipped false saat GUEST, true saat connected', guestEq && connEq);
  }

  // ===== Part B — warna not di game (jalur play(): G.noteSkin = shopSkin().note) =====
  {
    const theme = ['#111111', '#222222', '#333333', '#444444'];
    const h = mkHarness(EQUIPPED);
    const guestCol = h.api.noteColor(0, theme, h.api.shopSkin().note);
    t('v43.6 B1: GUEST -> not pakai warna tema default (bukan palet skin)', guestCol === '#111111' && h.api.noteColor(2, theme, h.api.shopSkin().note) === '#333333');
    h.api.setConnected(ADDR);
    t('v43.6 B2: connected -> not pakai palet skin SQK rare (biru safir)', h.api.noteColor(0, theme, h.api.shopSkin().note) === '#3b82f6' && h.api.noteColor(1, theme, h.api.shopSkin().note) === '#60a5fa');
  }

  // ===== Part C — frame langsung hilang saat disconnect, kembali saat reconnect =====
  // C1: connected + frame equipped -> kedua panel dibungkus frame.
  {
    const h = mkHarness(EQUIPPED);
    h.api.setConnected(ADDR);
    t('v43.6 C1: connected + frame-sqk -> #gamePanel + #resultPanel dibungkus frame-sqk', hasOnlyFrame(h.els.gamePanel, 'frame-sqk') && hasOnlyFrame(h.els.resultPanel, 'frame-sqk'));
  }
  // C2+C3: disconnect (setConnected(null) ASLI) -> frame hilang seketika
  // dari kedua panel TANPA reload; equip di localStorage TIDAK terhapus;
  // reconnect -> frame kembali.
  {
    const h = mkHarness(EQUIPPED);
    h.api.setConnected(ADDR);
    const hadIt = hasOnlyFrame(h.els.gamePanel, 'frame-sqk');
    h.api.setConnected(null); // jalur disconnect yang sama dipakai semua handler
    const gone = hadIt && hasNoFrame(h.els.gamePanel) && hasNoFrame(h.els.resultPanel);
    const kept = h.store.has('sqk41:skin-sqk') && h.store.get('sqk41:skin-sqk').frame === 'frame-sqk' && h.store.has('sqk41:skin-keju');
    t('v43.6 C2: disconnect -> frame hilang dari kedua panel tanpa reload', gone);
    t('v43.6 C2: disconnect TIDAK menghapus equip di localStorage', kept);
    h.api.setConnected(ADDR); // reconnect wallet yang sama
    t('v43.6 C3: reconnect -> frame kembali membungkus kedua panel', hasOnlyFrame(h.els.gamePanel, 'frame-sqk') && hasOnlyFrame(h.els.resultPanel, 'frame-sqk'));
  }
  // C4: frame sisa dari sesi lama (class sudah menempel di panel) +
  // GUEST -> applyResultFrame() membersihkannya dari kedua panel.
  {
    const h = mkHarness(EQUIPPED);
    h.els.gamePanel.classList.add('frame-rainbow');
    h.els.resultPanel.classList.add('frame-rainbow');
    h.api.applyResultFrame();
    t('v43.6 C4: GUEST + frame sisa menempel -> applyResultFrame() membersihkan kedua panel', hasNoFrame(h.els.gamePanel) && hasNoFrame(h.els.resultPanel));
  }
  // C5: disconnect saat tidak ada equip -> tidak crash, panel tetap bersih.
  {
    const h = mkHarness({});
    let threw = false;
    try { h.api.setConnected(ADDR); h.api.setConnected(null); } catch (_) { threw = true; }
    t('v43.6 C5: disconnect tanpa equip -> tidak crash, panel bersih', !threw && hasNoFrame(h.els.gamePanel) && hasNoFrame(h.els.resultPanel));
  }

  // ===== Part D — static checks =====
  // D1: gate ada di shopSkin() (baris pertama, sebelum baca localStorage).
  {
    const src = fnSrcJ('shopSkin');
    t('v43.6 D1: shopSkin() diawali gate connectedWallet() -> default saat GUEST', src.includes('if (!connectedWallet()) return { note: null, frame: null };'));
    t('v43.6 D1: gate terletak SEBELUM pembacaan localStorage pertama', src.indexOf('if (!connectedWallet())') < src.indexOf("loadJSON('sqk41:skin-keju'"));
  }
  // D2: setConnected() menerapkan ulang frame (connect + disconnect).
  {
    const src = fnSrcJ('setConnected');
    t('v43.6 D2: setConnected() memanggil applyResultFrame() (terapkan/hapus seketika)', src.includes('applyResultFrame()'));
    t('v43.6 D2: setConnected() TIDAK menghapus kunci skin dari localStorage', !src.includes('removeItem') && !src.includes('sqk41:skin'));
  }
  // D3: semua jalur disconnect bermuara ke setConnected(null) (>= 3 situs).
  {
    const n = jsCode.split('setConnected(null)').length - 1;
    t('v43.6 D3: semua jalur disconnect memanggil setConnected(null) (>= 3 situs)', n >= 3);
  }
  // D4: versi v43.6 (title + header + footer + meta + gameVersion + README).
  t('v43.6 D4: version v43.6 (title + header + footer + meta + gameVersion + README)',
    html.includes('<title>SQUEEKCHAIN // v43.6</title>') && html.includes('PIXEL ID // v43.6') && html.includes('• v43.6 •') && html.includes('SQUEEKCHAIN v43.6 —') &&
    js.includes("gameVersion: 'v43.6'") && fs.readFileSync('README.md', 'utf8').startsWith('# Squeekchain v43.6'));
  // D5: perilaku frame v43.5 utuh saat connected (shared CSS + play() call).
  {
    const shared = '#resultPanel.frame-sqk, #gamePanel.frame-sqk, body[data-theme] #gamePanel.frame-sqk';
    t('v43.6 D5: frame v43.5 utuh (shared CSS rule + play() panggil applyResultFrame)', css.includes(shared) && js.includes("show('gamePanel'); applyResultFrame();"));
  }
  // D6: engine + worker byte-identik v43.5 (client UI only).
  {
    const eq = (a, b) => fs.readFileSync(a).equals(fs.readFileSync(b));
    t('v43.6 D6: engine.js + worker.js byte-identical to v43.5', eq('engine.js', '../squeekchain-v43.5/engine.js') && eq('worker.js', '../squeekchain-v43.5/worker.js'));
  }
  // D7: engine regression — golden charts + judgement windows unchanged.
  {
    let goldenOk = true;
    for (const g of golden) {
      if (JSON.stringify(SqueekEngine.buildChart(g.header)) !== JSON.stringify(g.anthem)) { goldenOk = false; console.log('  golden mismatch:', g.header && g.header.seedKey); break; }
    }
    t('v43.6 D7: 14 chart golden identik (buildChart == fixture v40)', goldenOk);
    const engineSrc = fs.readFileSync('engine.js', 'utf8');
    t('v43.6 D7: judgement windows TIDAK berubah (0.045/0.09/0.135, BREAK 0.185)',
      /perfect: 0\.045, great: 0\.09, good: 0\.135/.test(engineSrc) && /BREAK = W\.good \+ 0\.05/.test(engineSrc));
  }
  // D8: 3 bukti Genesis utuh (di file lokal; TXT DNS dicek lagi saat verifikasi live).
  t('v43.6 D8: bukti Genesis — meta tag di index.html', html.includes('<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">'));
  t('v43.6 D8: bukti Genesis — baris README', fs.readFileSync('README.md', 'utf8').includes('squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7'));

  console.log(`\nTEST-v43.6: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
