// v43.5 — run: node TEST-v43.5.js  (cwd = the v43.5 folder)
// FRAMES VISIBLE IN-GAME: the equipped frame (slot 'frame': Neon, Gold,
// Royal, Rainbow, SQK/Bingkai Animasi) now wraps the PLAY area
// (#gamePanel) while the song runs, not only the result panel
// (#resultPanel). The user reported (9 Nov 2026, 23:15 WIB) that shop
// frames "do not function INSIDE the game" — v43.4 and earlier only
// styled #resultPanel via applyResultFrame(), so an equipped frame was
// invisible during gameplay. v43.5 shares one frame rule set across both
// panels (CSS) and applies the equipped frame to both panels from the
// same function, called at game start (play()), on equip/unequip, and on
// the result screen.
// BATAS KERAS: engine.js + worker.js byte-identik v43.4, 14 chart golden
// identik, judgement windows + formula skor tidak berubah, Worker tetap
// v13, 3 bukti Genesis utuh, tanpa CDN/dependensi baru, gating v43.4
// (connected-only profile/shop/rank) TIDAK berubah, perilaku note skin
// di game TIDAK berubah.
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

// --- extractors (same pattern as TEST-v42.5.4-restore-ui.js / TEST-v43.4.js) ---
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

// --- frame harness: REAL shopSkin + applyResultFrame + noteColor, mock DOM ---
function mkFrameHarness(storeInit, opts) {
  const store = new Map(Object.entries(storeInit || {}));
  const els = {};
  if (!(opts && opts.noGamePanel)) els.gamePanel = mockEl();
  if (!(opts && opts.noResultPanel)) els.resultPanel = mockEl();
  const localStorageStub = { getItem: () => null, setItem() {}, removeItem() {} };
  const src = [fnSrcJ('shopSkin'), fnSrcJ('applyResultFrame'), fnSrcJ('noteColor')].join('\n');
  // v43.6: shopSkin() gates on connectedWallet() — this harness tests the
  // CONNECTED case (frame applies when equipped); the disconnected case
  // (GUEST -> default) is covered by TEST-v43.6.js.
  const api = new Function('$', 'loadJSON', 'saveJSON', 'localStorage', 'FRAME_SKINS', 'NOTE_SKINS', 'connectedWallet',
    src + '\nreturn { shopSkin, applyResultFrame, noteColor };'
  )(
    id => els[id] || null,
    (k, fb) => store.has(k) ? store.get(k) : fb,
    (k, v) => { store.set(k, v); },
    localStorageStub,
    FRAME_SKINS, NOTE_SKINS, () => '0x88538a82143065664232422e2dec4309038fcf9a'
  );
  return { api, els, store };
}
function hasNoFrame(el) { return FRAME_SKINS.every(f => !el.classList.contains(f)); }
function hasOnlyFrame(el, f) { return el.classList.contains(f) && FRAME_SKINS.filter(x => x !== f).every(x => !el.classList.contains(x)); }

(async () => {
  // ===== Part A — applyResultFrame behaviour (real functions, mock DOM) =====
  // A1: frame Keju equipped -> BOTH panels carry it during play.
  {
    const h = mkFrameHarness({ 'sqk41:skin-keju': { note: 'note-mint', frame: 'frame-neon' } });
    h.api.applyResultFrame();
    t('v43.5 A1: frame-neon equipped -> #gamePanel carries frame-neon', h.els.gamePanel.classList.contains('frame-neon'));
    t('v43.5 A1: frame-neon equipped -> #resultPanel keeps frame-neon', h.els.resultPanel.classList.contains('frame-neon'));
  }
  // A2: frame SQK equipped (Bingkai Animasi, item 3) -> BOTH panels carry frame-sqk.
  {
    const h = mkFrameHarness({ 'sqk41:skin-sqk': { note: 'note-sqk-rare', frame: 'frame-sqk' } });
    h.api.applyResultFrame();
    t('v43.5 A2: frame-sqk (Bingkai Animasi) equipped -> #gamePanel carries frame-sqk', h.els.gamePanel.classList.contains('frame-sqk'));
    t('v43.5 A2: frame-sqk equipped -> #resultPanel keeps frame-sqk', h.els.resultPanel.classList.contains('frame-sqk'));
  }
  // A3: no frame equipped -> NEITHER panel carries any frame class.
  {
    const h = mkFrameHarness({ 'sqk41:skin-keju': { note: 'note-mint', frame: null } });
    h.api.applyResultFrame();
    t('v43.5 A3: no frame equipped -> #gamePanel carries no frame class', hasNoFrame(h.els.gamePanel));
    t('v43.5 A3: no frame equipped -> #resultPanel carries no frame class', hasNoFrame(h.els.resultPanel));
    const h2 = mkFrameHarness({});
    h2.api.applyResultFrame();
    t('v43.5 A3: empty skin store -> neither panel carries a frame class', hasNoFrame(h2.els.gamePanel) && hasNoFrame(h2.els.resultPanel));
  }
  // A4: switching frames replaces the old one on BOTH panels (no leftovers).
  {
    const h = mkFrameHarness({ 'sqk41:skin-keju': { note: 'note-mint', frame: 'frame-neon' } });
    h.api.applyResultFrame();
    h.store.set('sqk41:skin-keju', { note: 'note-mint', frame: 'frame-gold' });
    h.api.applyResultFrame();
    t('v43.5 A4: switch neon -> gold -> #gamePanel has ONLY frame-gold', hasOnlyFrame(h.els.gamePanel, 'frame-gold'));
    t('v43.5 A4: switch neon -> gold -> #resultPanel has ONLY frame-gold', hasOnlyFrame(h.els.resultPanel, 'frame-gold'));
  }
  // A5: unequip (no reload) removes the frame from BOTH panels.
  {
    const h = mkFrameHarness({ 'sqk41:skin-keju': { note: 'note-mint', frame: 'frame-royal' } });
    h.api.applyResultFrame();
    const hadIt = h.els.gamePanel.classList.contains('frame-royal');
    h.store.set('sqk41:skin-keju', { note: 'note-mint', frame: null });
    h.api.applyResultFrame();
    t('v43.5 A5: unequip without reload -> #gamePanel loses the frame', hadIt && hasNoFrame(h.els.gamePanel));
    t('v43.5 A5: unequip without reload -> #resultPanel loses the frame', hasNoFrame(h.els.resultPanel));
  }
  // A6: an invalid frame value in storage adds NO class anywhere.
  {
    const h = mkFrameHarness({ 'sqk41:skin-keju': { note: 'note-mint', frame: 'frame-bogus' } });
    h.api.applyResultFrame();
    t('v43.5 A6: invalid frame value -> neither panel gets a frame class', hasNoFrame(h.els.gamePanel) && hasNoFrame(h.els.resultPanel));
  }
  // A7: every registered frame applies to BOTH panels.
  {
    let ok = true;
    for (const f of FRAME_SKINS) {
      const h = mkFrameHarness({ 'sqk41:skin-keju': { note: null, frame: f } });
      h.api.applyResultFrame();
      if (!hasOnlyFrame(h.els.gamePanel, f) || !hasOnlyFrame(h.els.resultPanel, f)) { ok = false; console.log('  frame failed:', f); }
    }
    t('v43.5 A7: all 5 frames (neon/gold/royal/rainbow/sqk) wrap BOTH panels', ok && FRAME_SKINS.length === 5);
  }
  // A8: missing #gamePanel element -> no crash, #resultPanel still styled.
  {
    const h = mkFrameHarness({ 'sqk41:skin-keju': { note: null, frame: 'frame-neon' } }, { noGamePanel: true });
    let threw = false;
    try { h.api.applyResultFrame(); } catch (_) { threw = true; }
    t('v43.5 A8: missing #gamePanel -> no crash, #resultPanel still gets the frame', !threw && h.els.resultPanel.classList.contains('frame-neon'));
  }

  // ===== Part B — note skins still recolor notes in-game (regression) =====
  {
    const h = mkFrameHarness({});
    const theme = ['#111111', '#222222', '#333333', '#444444'];
    t('v43.5 B1: noteColor SQK rare recolors notes sapphire blue (lane 0/1/4)',
      h.api.noteColor(0, theme, 'note-sqk-rare') === '#3b82f6' && h.api.noteColor(1, theme, 'note-sqk-rare') === '#60a5fa' && h.api.noteColor(4, theme, 'note-sqk-rare') === '#3b82f6');
    t('v43.5 B2: noteColor Keju mint recolors notes (lane 2)', h.api.noteColor(2, theme, 'note-mint') === '#a8ffce');
    t('v43.5 B3: noteColor without/unknown skin falls back to theme notes',
      h.api.noteColor(1, theme, null) === '#222222' && h.api.noteColor(0, theme, 'note-bogus') === '#111111');
  }

  // ===== Part C — static checks =====
  const DECL = {
    'frame-neon': 'border: 3px solid #00ffff; box-shadow: 0 0 24px rgba(0, 255, 255, .45);',
    'frame-gold': 'border: 3px solid #ffd700; box-shadow: 0 0 24px rgba(255, 215, 0, .5);',
    'frame-royal': 'border: 3px solid #a050ff; box-shadow: 0 0 24px rgba(160, 80, 255, .5);',
    'frame-rainbow': 'border: 3px solid transparent; background: linear-gradient(rgba(5, 6, 7, .94), rgba(5, 6, 7, .94)) padding-box, linear-gradient(135deg, #ff5ce1, #ffd700, #00e5ff, #7dffc8) border-box; box-shadow: 0 0 24px rgba(255, 92, 225, .4);',
    'frame-sqk': 'border: 3px solid transparent; background: linear-gradient(rgba(5, 6, 7, .94), rgba(5, 6, 7, .94)) padding-box, linear-gradient(90deg, #3b82f6, #f43f5e, #a3e635, #3b82f6) border-box; background-size: 100% 100%, 300% 100%; animation: sqkFrameShift 3s linear infinite; box-shadow: 0 0 24px rgba(59, 130, 246, .4);',
  };
  // C1+C2+C3: one shared rule per frame covers both panels + beats the theme glow.
  {
    let okAll = true;
    for (const f of Object.keys(DECL)) {
      const shared = `#resultPanel.${f}, #gamePanel.${f}, body[data-theme] #gamePanel.${f} { ${DECL[f]} }`;
      if (!css.includes(shared)) { okAll = false; console.log('  shared rule missing:', f); }
      if (css.includes(`#resultPanel.${f} {`)) { okAll = false; console.log('  old result-only rule still present:', f); }
    }
    t('v43.5 C1: CSS has one shared frame rule per frame covering #resultPanel + #gamePanel (same border/glow/gradient)', okAll);
    t('v43.5 C2: CSS gamePanel frame rules include the body[data-theme] variant (beats the mode-theme glow while playing)', FRAME_SKINS.every(f => css.includes(`body[data-theme] #gamePanel.${f}`)));
  }
  // C4: play() applies the frame the moment the game panel shows.
  t('v43.5 C4: play() calls applyResultFrame() right after show(\'gamePanel\')', js.includes("show('gamePanel'); applyResultFrame();"));
  // C5: applyResultFrame is called from every equip/unequip path + result + play
  // + setConnected (v43.6: connect/disconnect re-applies the frame at once)
  // (7 call sites + 1 definition = 8 occurrences of the name).
  {
    const calls = jsCode.split('applyResultFrame()').length - 1;
    t('v43.5 C5: applyResultFrame() called from play + result + equip/unequip paths + setConnected (7 calls + definition)', calls === 8);
  }
  // C6: version strings are v43.6.
  t('v43.5 C6: version v43.6 (title + header + footer + meta + gameVersion + README)',
    html.includes('<title>SQUEEKCHAIN // v43.6</title>') && html.includes('PIXEL ID // v43.6') && html.includes('• v43.6 •') && html.includes('SQUEEKCHAIN v43.6 —') &&
    js.includes("gameVersion: 'v43.6'") && fs.readFileSync('README.md', 'utf8').startsWith('# Squeekchain v43.6'));
  // C7: v43.4 gating untouched (connected-only profile/shop/rank).
  t('v43.5 C7: gating v43.4 intact (connectedWallet() helper + profile gate)',
    js.includes('function connectedWallet()') && js.includes('if (!wrap || !c || !connectedWallet() || !isAddr(w))'));
  // C8: structure intact (game panel + canvas + result panel present).
  t('v43.5 C8: structure intact (#gamePanel + #game-canvas + #resultPanel in index.html)',
    html.includes('id="gamePanel"') && html.includes('id="game-canvas"') && html.includes('id="resultPanel"'));
  // C9: engine + worker byte-identical to v43.5 (client UI only).
  {
    const eq = (a, b) => fs.readFileSync(a).equals(fs.readFileSync(b));
    t('v43.5 C9: engine.js + worker.js byte-identical to v43.5', eq('engine.js', '../squeekchain-v43.5/engine.js') && eq('worker.js', '../squeekchain-v43.5/worker.js'));
  }
  // C10: engine regression — golden charts + judgement windows unchanged.
  {
    let goldenOk = true;
    for (const g of golden) {
      if (JSON.stringify(SqueekEngine.buildChart(g.header)) !== JSON.stringify(g.anthem)) { goldenOk = false; console.log('  golden mismatch:', g.header && g.header.seedKey); break; }
    }
    t('v43.5 C10: 14 chart golden identik (buildChart == fixture v40)', goldenOk);
    const engineSrc = fs.readFileSync('engine.js', 'utf8');
    t('v43.5 C10: judgement windows TIDAK berubah (0.045/0.09/0.135, BREAK 0.185)',
      /perfect: 0\.045, great: 0\.09, good: 0\.135/.test(engineSrc) && /BREAK = W\.good \+ 0\.05/.test(engineSrc));
  }
  // C11: 3 bukti Genesis utuh.
  t('v43.5 C11: bukti Genesis — meta tag di index.html', html.includes('<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">'));
  t('v43.5 C11: bukti Genesis — baris README', fs.readFileSync('README.md', 'utf8').includes('squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7'));

  console.log(`\nTEST-v43.5: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
