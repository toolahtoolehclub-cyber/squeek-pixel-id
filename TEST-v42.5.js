// v42.5 functional tests — run: node TEST-v42.5.js  (cwd = the v42.5 folder)
// Covers: GHOST pace + engine ghost branch, poll cross-check, ghost
// validation (worker), rate-limit v10, dreamReward, shop previews,
// wallet UX harness (status card + disconnect + txWallet), Dream Seeds,
// Lullaby seedKey, v42.5.1 two-source skins (BUG 1), Lullaby submit button
// (BUG 2), Lullaby mode color (BUG 3). Static v42.5 checks live in TEST-v34-neo.js.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const worker = fs.readFileSync('worker.js', 'utf8');
const jsLines = js.split('\n');
const workerLines = worker.split('\n');
const SqueekEngine = require('./engine.js');
let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }
function fnSrc(lines, name) {
  const start = lines.findIndex(l => l.startsWith('function ' + name + '(') || l.startsWith('async function ' + name + '('));
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) { for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return lines.slice(start, end + 1).join('\n');
}
function fnSrcW(name) { return fnSrc(workerLines, name); }
function fnSrcJ(name) { return fnSrc(jsLines, name); }
function mockClassList() {
  const set = new Set();
  return {
    toggle(cls, force) { if (force === undefined) { if (set.has(cls)) set.delete(cls); else set.add(cls); } else if (force) set.add(cls); else set.delete(cls); },
    add(cls) { set.add(cls); },
    remove(cls) { set.delete(cls); },
    contains(cls) { return set.has(cls); },
  };
}
function mockEl() { return { textContent: '', classList: mockClassList() }; }

// --- 1. GHOST pace from real 7-day stats ---
(function () {
  const constStart = js.indexOf('const GHOST_WHEEL_M_PER_PASSAGE');
  const constEnd = js.indexOf('\n', js.indexOf('const GHOST_PACE_CACHE_KEY'));
  const consts = js.slice(constStart, constEnd); // only the 4 GHOST const lines
  const ghostPaceFromStats = new Function(consts + '\n' + fnSrcJ('ghostPaceFromStats') + '\nreturn ghostPaceFromStats;')();
  const stats = { days: [
    { date: '2026-11-05', buckets: [
      { startMinuteUtc: 180, coverage: 'complete', workUnits: '1075' },
      { startMinuteUtc: 210, coverage: 'complete', workUnits: '1075' },
      { startMinuteUtc: 240, coverage: 'complete', workUnits: '1075' },
      { startMinuteUtc: 0, coverage: 'complete', workUnits: '9999' }, // night bucket — must be IGNORED
      { startMinuteUtc: 420, coverage: 'complete', workUnits: '9999' }, // 07:00 UTC = 14:00 WIB — outside the window
      { startMinuteUtc: 270, coverage: 'partial', workUnits: '9999' }, // partial — must be IGNORED
    ] },
  ] };
  t('ghostPaceFromStats: 1075 work/30min -> 0.524 m/s (daytime only)', ghostPaceFromStats(stats) === 0.524);
  t('ghostPaceFromStats: all-zero daytime buckets -> null (no pace)', ghostPaceFromStats({ days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 180, coverage: 'complete', workUnits: '0' }] }] }) === null);
  t('ghostPaceFromStats: no days -> null', ghostPaceFromStats({ days: [] }) === null);
  t('ghostPaceFromStats: only partial buckets -> null', ghostPaceFromStats({ days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 180, coverage: 'partial', workUnits: '1075' }] }] }) === null);
  t('ghostPaceFromStats: null stats -> null', ghostPaceFromStats(null) === null);
})();

// --- 2. Engine ghost branch (deriveOppDistM) ---
(function () {
  const header = { mode: 'race', genre: 'synth', diff: 'easy', seedKey: 'RACE-2026-11-09-128', seed: 12345, lanes: 3, mirror: false, practice: false, offsetMs: 0, wallStartMs: Date.now() - 120000, duration: 60, initialZoomies: false, initialDistKm: 0, ghost: true, ghostPaceMs: 0.5 };
  const chart = SqueekEngine.buildChart(header);
  const replay = { header, events: { inputs: [], polls: [], golden: [], finish: { t: 61, oppDistM: 30.5 } }, claim: { score: 0, acc: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 } } };
  const sim = SqueekEngine.simulate(chart, replay);
  t('engine ghost: oppDistMDerived = pace x finish.t (0.5 x 61 = 30.5)', sim.oppDistMDerived === 30.5);
  t('engine ghost: oppDistMMatch true', sim.oppDistMMatch === true);
  // Non-ghost path unchanged: derived from the poll log.
  const header2 = { ...header, ghost: false, ghostPaceMs: 0 };
  const replay2 = { header: header2, events: { inputs: [], polls: [{ t: 0, ok: true, rpm: 0, dist: 0 }, { t: 60, ok: true, rpm: 0, dist: 0.03 }], golden: [], finish: { t: 61, oppDistM: 30 } }, claim: replay.claim };
  const sim2 = SqueekEngine.simulate(SqueekEngine.buildChart(header2), replay2);
  t('engine live: oppDistMDerived from polls (0.03 km = 30 m)', sim2.oppDistMDerived === 30);
  t('engine live: oppDistMMatch true', sim2.oppDistMMatch === true);
})();

// --- 3. Worker poll cross-check ---
(function () {
  const pollsContradictWheel = new Function(fnSrcW('pollsContradictWheel') + '\nreturn pollsContradictWheel;')();
  const wallStart = Date.UTC(2026, 10, 5, 5, 0, 0); // 2026-11-05 05:00 UTC = 12:00 WIB
  const zoomiesPolls = [{ t: 0, ok: true, rpm: 80, dist: 0.001 }];
  const stillStats = { days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 300, coverage: 'complete', workUnits: '0' }] }] };
  const movingStats = { days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 300, coverage: 'complete', workUnits: '500' }] }] };
  const partialStats = { days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 300, coverage: 'partial', workUnits: '0' }] }] };
  const nullStats = { days: [{ date: '2026-11-05', buckets: [{ startMinuteUtc: 300, coverage: 'complete', workUnits: null }] }] };
  t('poll cross-check: fake ZOOMIES during a provably-still window -> CONTRADICTION', pollsContradictWheel(stillStats, wallStart, 120000, zoomiesPolls) === true);
  t('poll cross-check: genuine movement (workUnits 500) -> no contradiction', pollsContradictWheel(movingStats, wallStart, 120000, zoomiesPolls) === false);
  t('poll cross-check: partial coverage -> fail open (no contradiction)', pollsContradictWheel(partialStats, wallStart, 120000, zoomiesPolls) === false);
  t('poll cross-check: null workUnits -> fail open (no contradiction)', pollsContradictWheel(nullStats, wallStart, 120000, zoomiesPolls) === false);
  t('poll cross-check: no rpm>0 polls -> no contradiction', pollsContradictWheel(stillStats, wallStart, 120000, [{ t: 0, ok: true, rpm: 0, dist: 0 }]) === false);
  t('poll cross-check: null stats -> no contradiction', pollsContradictWheel(null, wallStart, 120000, zoomiesPolls) === false);
  t('poll cross-check: window spanning a missing bucket -> fail open', pollsContradictWheel(stillStats, wallStart, 2400000, zoomiesPolls) === false);
})();

// --- 4. Worker ghost validation (checkOppDist + validateReplay) ---
(function () {
  const checkOppDist = new Function('const GHOST_PACE_MAX_MS = 1.0;\n' + fnSrcW('isFiniteNumber') + '\n' + fnSrcW('checkOppDist') + '\nreturn checkOppDist;')();
  const ghostOk = { header: { mode: 'race', ghost: true, ghostPaceMs: 0.5, initialDistKm: 0 }, events: { finish: { t: 61, oppDistM: 30.5 }, polls: [] } };
  t('checkOppDist ghost: pace x finish.t matches -> null', checkOppDist(ghostOk) === null);
  t('checkOppDist ghost: oppDistM 100 vs pace 0.5 x 61 -> error', checkOppDist({ header: ghostOk.header, events: { finish: { t: 61, oppDistM: 100 }, polls: [] } }) === 'finish.oppDistM inconsistent with ghost pace');
  t('checkOppDist ghost: pace 2.0 (above cap) -> error', checkOppDist({ header: { mode: 'race', ghost: true, ghostPaceMs: 2.0, initialDistKm: 0 }, events: { finish: { t: 61, oppDistM: 122 }, polls: [] } }) === 'ghost pace is not valid');
  t('checkOppDist live: consistent polls -> null', checkOppDist({ header: { mode: 'race', initialDistKm: 0 }, events: { finish: { t: 61, oppDistM: 30 }, polls: [{ t: 0, ok: true, rpm: 0, dist: 0 }, { t: 60, ok: true, rpm: 0, dist: 0.03 }] } }) === null);

  const validateReplay = new Function(
    "const GENRES = ['cyber','synth','chip','void'];\nconst DIFFS = ['easy','normal','hard'];\nconst MAX_POLLS = 600;\nconst MAX_EXTRA_TAPS = 50;\nconst GOLDEN_MAX = 2;\nconst GHOST_PACE_MAX_MS = 1.0;\n" +
    fnSrcW('isNonEmptyString') + '\n' + fnSrcW('isInt') + '\n' + fnSrcW('isFiniteNumber') + '\n' + fnSrcW('checkOppDist') + '\n' + fnSrcW('validateReplay') +
    '\nreturn validateReplay;')();
  const ghostReplay = {
    v: 1,
    header: { mode: 'race', genre: 'synth', diff: 'easy', seedKey: 'RACE-2026-11-09-128', seed: 12345, lanes: 3, mirror: false, practice: false, offsetMs: 0, wallStartMs: Date.now() - 120000, duration: 60, initialZoomies: false, initialDistKm: 0, ghost: true, ghostPaceMs: 0.5 },
    events: { inputs: [], polls: [{ t: 0, ok: false, rpm: null, dist: null }], golden: [], finish: { t: 61, oppDistM: 30.5 } },
    claim: { score: 100, acc: 50, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 } },
  };
  t('validateReplay: minimal ghost race replay VALID', validateReplay(ghostReplay, {}, 'race', 100, 50).ok === true);
  const freeGhost = JSON.parse(JSON.stringify(ghostReplay));
  freeGhost.header.mode = 'free';
  t('validateReplay: ghost outside race mode REJECTED', validateReplay(freeGhost, {}, 'free', 100, 50).error === 'replay ghost is only valid in race mode');
  const fastGhost = JSON.parse(JSON.stringify(ghostReplay));
  fastGhost.header.ghostPaceMs = 2.0;
  t('validateReplay: ghost pace 2.0 REJECTED', validateReplay(fastGhost, {}, 'race', 100, 50).error === 'replay header ghostPaceMs out of range');
  const noPaceGhost = JSON.parse(JSON.stringify(ghostReplay));
  delete noPaceGhost.header.ghostPaceMs;
  t('validateReplay: ghost without pace REJECTED', validateReplay(noPaceGhost, {}, 'race', 100, 50).error === 'replay header ghostPaceMs is missing');
  const noGhost = JSON.parse(JSON.stringify(ghostReplay));
  delete noGhost.header.ghost; delete noGhost.header.ghostPaceMs;
  noGhost.events.finish.oppDistM = 0; // live race, wheel still, last poll failed -> opp must be 0
  t('validateReplay: v42.4-style replay without ghost fields still VALID', validateReplay(noGhost, {}, 'race', 100, 50).ok === true);
})();

// --- 5. Worker rate-limit v10 (mock D1) ---
function mockEnv() {
  const tables = { submit_log: [], resolve_log: [] };
  return {
    tables,
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async run() {
                let m = sql.match(/^DELETE FROM (\w+) WHERE ts < \?/);
                if (m) {
                  const before = tables[m[1]].length;
                  tables[m[1]] = tables[m[1]].filter(r => r.ts >= params[0]);
                  return { meta: { changes: before - tables[m[1]].length } };
                }
                m = sql.match(/^INSERT INTO (\w+) \(wallet, ip, ts\) VALUES/);
                if (m) {
                  tables[m[1]].push({ wallet: params[0], ip: params[1], ts: params[2] });
                  return { meta: { changes: 1 } };
                }
                throw new Error('mock DB: unhandled run sql: ' + sql);
              },
              async first() {
                let m = sql.match(/SELECT COUNT\(\*\) AS n, MIN\(ts\) AS oldest FROM (\w+) WHERE wallet = \?/);
                if (m) {
                  const rows = tables[m[1]].filter(r => r.wallet === params[0] && r.ts >= params[1]);
                  return { n: rows.length, oldest: rows.length ? Math.min(...rows.map(r => r.ts)) : null };
                }
                m = sql.match(/SELECT COUNT\(\*\) AS n, MIN\(ts\) AS oldest FROM (\w+) WHERE ip = \?/);
                if (m) {
                  const rows = tables[m[1]].filter(r => r.ip === params[0] && r.ts >= params[1]);
                  return { n: rows.length, oldest: rows.length ? Math.min(...rows.map(r => r.ts)) : null };
                }
                throw new Error('mock DB: unhandled first sql: ' + sql);
              },
            };
          },
        };
      },
    },
  };
}
async function runRateLimitTests() {
  const rateLimitAllowed = new Function(
    'const RATE_WINDOW_MS = 3600000;\nconst RATE_MAX_WALLET = 10;\nconst RATE_MAX_IP = 30;\n' +
    fnSrcW('rateLimitAllowed') + '\nreturn rateLimitAllowed;')();
  const WALLET = '0x88538a82143065664232422e2dec4309038fcf9a';
  const IP = '114.10.27.233';
  // 10 score submits allowed, 11th rejected, rejected adds NO row.
  {
    const env = mockEnv();
    let allowed = 0;
    for (let i = 0; i < 10; i++) if ((await rateLimitAllowed(env, 'submit_log', WALLET, IP, 10, 30)).allowed) allowed++;
    t('rate-limit v10: 10 submits allowed', allowed === 10);
    const r11 = await rateLimitAllowed(env, 'submit_log', WALLET, IP, 10, 30);
    t('rate-limit v10: 11th submit REJECTED with retryAfterSec', r11.allowed === false && r11.retryAfterSec > 0 && r11.retryAfterSec <= 3600);
    t('rate-limit v10: rejected attempt adds NO row (count stays 10)', env.tables.submit_log.length === 10);
    const r12 = await rateLimitAllowed(env, 'submit_log', WALLET, IP, 10, 30);
    t('rate-limit v10: still rejected after the 11th (no self-extension)', r12.allowed === false && env.tables.submit_log.length === 10);
  }
  // Resolve has its OWN counter: 10 submits do NOT block a resolve.
  {
    const env = mockEnv();
    for (let i = 0; i < 10; i++) await rateLimitAllowed(env, 'submit_log', WALLET, IP, 10, 30);
    const r = await rateLimitAllowed(env, 'resolve_log', WALLET, IP, 10, 30);
    t('rate-limit v10: 10 score submits do NOT block capsule resolve (separate table)', r.allowed === true);
  }
  // IP limit: 30 different wallets from one IP, 31st rejected.
  {
    const env = mockEnv();
    let allowed = 0;
    for (let i = 0; i < 30; i++) if ((await rateLimitAllowed(env, 'submit_log', '0x' + String(i).padStart(40, '0'), IP, 10, 30)).allowed) allowed++;
    const r31 = await rateLimitAllowed(env, 'submit_log', '0x' + 'f'.repeat(40), IP, 10, 30);
    t('rate-limit v10: IP limit 30 (31st wallet from same IP rejected)', allowed === 30 && r31.allowed === false);
  }
}

// --- 6. dreamReward ---
(function () {
  const dreamReward = new Function(fnSrcW('dreamReward') + '\nreturn dreamReward;')();
  t('dreamReward 0 -> 25', dreamReward(0) === 25);
  t('dreamReward 1 -> 50', dreamReward(1) === 50);
  t('dreamReward 2 -> 75', dreamReward(2) === 75);
  t('dreamReward 3 (capped) -> 75', dreamReward(3) === 75);
  t('dreamReward -1 (clamped) -> 25', dreamReward(-1) === 25);
})();

// --- 7. Shop previews ---
(function () {
  const skinsSrc = js.slice(js.indexOf('const NOTE_SKINS'), js.indexOf('function shopSkin'));
  const previewSrc = fnSrcJ('skinPreviewHtml') + '\n' + fnSrcJ('capsulePreviewHtml');
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const api = new Function('escHtml', skinsSrc + '\n' + previewSrc + '\nreturn { skinPreviewHtml, capsulePreviewHtml };')(escHtml);
  const rare = api.skinPreviewHtml('note-sqk-rare', 'note');
  t('shop preview: SQK rare skin shows 4 dots in its palette (#3b82f6)', rare.includes('#3b82f6') && (rare.match(/pv-dot/g) || []).length === 4);
  const mint = api.skinPreviewHtml('note-mint', 'note');
  t('shop preview: Keju mint skin shows its palette (#7dffc8)', mint.includes('#7dffc8') && (mint.match(/pv-dot/g) || []).length === 4);
  const frame = api.skinPreviewHtml('frame-sqk', 'frame');
  t('shop preview: frame shows a mini framed panel with its class', frame.includes('pv-frame frame-sqk') && frame.includes('◆'));
  t('shop preview: unknown skin -> empty', api.skinPreviewHtml('nope', 'note') === '');
  const cap = api.capsulePreviewHtml();
  t('shop preview: capsule shows all 4 rarity chips', ['common', 'rare', 'epic', 'legendary'].every(r => cap.includes('pv-cap ' + r)));
})();

// --- 8. Wallet UX harness (v42.5): status card + disconnect + readonly field ---
function mkWalletHarness42(opts) {
  const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
  const btn = { textContent: '[ CONNECT WALLET ]', disabled: false };
  const walletInput = { value: '', readOnly: false, addEventListener() {} };
  const walletStatus = mockEl();
  const disconnectBtn = mockEl();
  const walletManualNote = mockEl();
  const handlers = {};
  const said = [];
  const store = {};
  const fakeLocalStorage = {
    length: 0,
    key(i) { return Object.keys(store)[i] || null; },
    getItem(k) { return store[k] === undefined ? null : store[k]; },
    setItem(k, v) { store[k] = String(v); this.length = Object.keys(store).length; },
    removeItem(k) { delete store[k]; this.length = Object.keys(store).length; },
  };
  if (opts && opts.wcKeys) { store['wc@2:client:0.3:xyz'] = '{}'; fakeLocalStorage.length = 1; }
  const mockEth = opts && opts.injected ? {
    request: async ({ method }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [ADDR];
      return null;
    },
    on: (ev, fn) => { handlers[ev] = fn; },
  } : undefined;
  const mockWcProvider = {
    accounts: [ADDR],
    connected: true,
    request: async ({ method }) => (method === 'eth_requestAccounts' || method === 'eth_accounts' ? [ADDR] : []),
    connect: async () => {},
    disconnect: async () => {},
    on: (ev, fn) => { handlers[ev] = fn; },
  };
  const fakeWindow = {
    ethereum: mockEth,
    EthereumProvider: (opts && opts.wc) ? { init: async () => mockWcProvider } : undefined,
  };
  const I18Nstub = { en: { connect: '[ CONNECT WALLET ]', connectedTpl: '[ CONNECTED: {addr} ]' }, id: { connect: '[ HUBUNGKAN WALLET ]', connectedTpl: '[ TERHUBUNG: {addr} ]' } };
  const MSGstub = {
    walletConnected: 'WALLET CONNECTED: {addr} — ADDRESS ONLY, NO SIGNATURE REQUESTED.',
    walletConnectedTpl: 'WALLET CONNECTED: {addr} • Transactions use THIS address.',
    walletSwitched: 'WALLET SWITCHED TO {addr}.', walletDisconnected: 'WALLET DISCONNECTED.', walletInvalid: 'WALLET RETURNED NO VALID ADDRESS.',
  };
  const msgStub = k => MSGstub[k] || I18Nstub.en[k] || k;
  const msgfStub = (k, vars) => { let s = msgStub(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const isAddrStub = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
  const els = { connectBtn: btn, walletInput, walletStatus, disconnectBtn, walletManualNote };
  const $stub = id => els[id] || null;
  const api = new Function('window', 'localStorage', 'document', '$', 'msg', 'msgf', 'isAddr', 'walletEl', 'saveWallet38', 'preview', 'say', 'CONFIG', 'I18N', 'lang',
    js.slice(js.indexOf('let wcProvider = null; // active WalletConnect provider'), js.indexOf("bindClick('connectBtn'")) +
    '\nreturn { connectWallet, disconnectWallet, setConnected, updateConnectBtn, restoreWalletConnectSession, restoreInjectedSession };')(
    fakeWindow, fakeLocalStorage, { createElement: () => { throw new Error('no DOM in harness'); }, head: { appendChild() {} } },
    $stub, msgStub, msgfStub, isAddrStub, walletInput, () => {}, () => {}, (m) => said.push(m),
    { WC_PROJECT_ID: 'x', WC_CHAINS: [11155111], SEPOLIA_RPC: 'https://rpc.test', SHOP_ADDRESS: '0x0000000000000000000000000000000000000000' },
    I18Nstub, 'en');
  return { api, btn, walletInput, walletStatus, disconnectBtn, walletManualNote, handlers, said, ADDR, store };
}
async function runWalletTests42() {
  // Not connected: status card + disconnect hidden, manual note visible, field editable.
  {
    const h = mkWalletHarness42({});
    t('v42.5 wallet UX: not connected -> status card hidden, disconnect hidden, MANUAL note visible, field editable',
      h.walletStatus.classList.contains('hidden') === true && h.disconnectBtn.classList.contains('hidden') === true &&
      h.walletManualNote.classList.contains('hidden') === false && h.walletInput.readOnly === false &&
      h.btn.textContent === '[ CONNECT WALLET ]' && h.btn.disabled === false);
  }
  // Connected (injected): card green + visible, disconnect visible, field readonly, manual note hidden.
  {
    const h = mkWalletHarness42({ injected: true });
    await h.api.connectWallet();
    t('v42.5 wallet UX: connected -> TERHUBUNG + status card visible with address',
      h.btn.textContent === '[ CONNECTED: 0x8853...cf9a ]' && h.btn.disabled === true &&
      h.walletStatus.classList.contains('hidden') === false && h.walletStatus.textContent.includes('0x8853...cf9a'));
    t('v42.5 wallet UX: connected -> disconnect visible, field readonly, MANUAL note hidden',
      h.disconnectBtn.classList.contains('hidden') === false && h.walletInput.readOnly === true &&
      h.walletManualNote.classList.contains('hidden') === true);
    await h.api.disconnectWallet();
    t('v42.5 wallet UX: disconnect -> back to CONNECT WALLET, card hidden, field editable again',
      h.btn.textContent === '[ CONNECT WALLET ]' && h.btn.disabled === false &&
      h.walletStatus.classList.contains('hidden') === true && h.disconnectBtn.classList.contains('hidden') === true &&
      h.walletInput.readOnly === false && h.walletManualNote.classList.contains('hidden') === false);
  }
  // Failed restore (no wc keys, no injected provider): stays NOT connected, never shows the old address.
  {
    const h = mkWalletHarness42({});
    await h.api.restoreWalletConnectSession();
    await h.api.restoreInjectedSession();
    t('v42.5 wallet UX: failed restore -> still NOT CONNECTED (no phantom address)',
      h.btn.textContent === '[ CONNECT WALLET ]' && h.walletStatus.classList.contains('hidden') === true);
  }
  // WC connect + disconnect via the page button.
  {
    const h = mkWalletHarness42({ wc: true });
    await h.api.connectWallet();
    t('v42.5 wallet UX: WC connect -> TERHUBUNG + card visible',
      h.btn.textContent === '[ CONNECTED: 0x8853...cf9a ]' && h.walletStatus.classList.contains('hidden') === false);
    await h.api.disconnectWallet();
    t('v42.5 wallet UX: WC disconnect -> CONNECT WALLET again',
      h.btn.textContent === '[ CONNECT WALLET ]' && h.walletStatus.classList.contains('hidden') === true);
  }
}

// --- 9. Dream Seeds + Lullaby ---
async function runDreamTests42() {
  const store = {};
  const loadJSON = (k, d) => { try { const v = store[k]; return v === undefined ? d : JSON.parse(v); } catch { return d; } };
  const saveJSON = (k, v) => { store[k] = JSON.stringify(v); };
  const squeekTodayStr = new Function(fnSrcJ('squeekTodayStr') + '\nreturn squeekTodayStr;')();
  const said = [];
  const dreamBox = mockEl(), dreamLine = mockEl(), dreamPlantBtn = mockEl(), dreamHarvestBtn = mockEl(), lullabyBox = mockEl(), lullabyInfo = mockEl();
  const els = { dreamBox, dreamLine, dreamPlantBtn, dreamHarvestBtn, lullabyBox, lullabyInfo };
  const $stub = id => els[id] || null;
  const MSGstub = {
    dreamNotNight: 'NOT NIGHT', dreamAlready: 'ALREADY', dreamPlanted: 'PLANTED', dreamWatered: 'WATERED {stage}/2',
    dreamNoSeed: 'NO SEED', dreamNotReady: 'NOT READY', dreamNeedWallet: 'NEED WALLET', dreamHarvestFail: 'HARVEST FAIL',
    dreamHarvested: 'HARVESTED +{n}', dreamLineNone: 'NONE', dreamLineDay: 'DAY', dreamLineStage: 'STAGE {stage} {night}',
    lullabyInfo: 'LULLABY NIGHT', lullabyInfoAwake: 'LULLABY AWAKE',
  };
  const msgStub = k => MSGstub[k] || k;
  const msgfStub = (k, vars) => { let s = msgStub(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; };
  const fetchCalls = [];
  let fetchResponse = { ok: true, json: async () => ({ ok: true, keju: 75 }) };
  const tfetchStub = async (url, opt) => { fetchCalls.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null }); return fetchResponse; };
  let walletValue = '0x88538a82143065664232422e2dec4309038fcf9a';
  const isAddrStub = s => /^0x[a-fA-F0-9]{40}$/.test(s || '');
  const dreamSlice = js.slice(js.indexOf('const DREAM_KEY'), js.indexOf('// --- Weekly Boss'));
  const api = new Function('loadJSON', 'saveJSON', 'squeekTodayStr', '$', 'msg', 'msgf', 'tfetch', 'CONFIG', 'fetchShop', 'currentWallet', 'isAddr', 'say',
    "let liveSnapshot = null;\nlet playMode = 'daily';\n" + dreamSlice +
    "\nreturn { plantDream, waterDream, harvestDream, renderDreamBox, dreamIsNight, dreamCanPlant, dreamState, dreamNightKeyFor, renderLullabyBox, setLiveSnapshot: v => { liveSnapshot = v; }, setPlayMode: v => { playMode = v; } };")(
    loadJSON, saveJSON, squeekTodayStr, $stub, msgStub, msgfStub, tfetchStub,
    { LB_URL: 'https://test.invalid' }, () => {}, () => walletValue, isAddrStub, (m) => said.push(m));
  // Hamster asleep (rpm 0) -> planting is allowed even in daytime.
  api.setLiveSnapshot({ ok: true, rpm: 0 });
  api.plantDream();
  const d1 = api.dreamState();
  t('dream: plant while hamster sleeps -> seed planted, stage 0', d1 && typeof d1.plantedAt === 'number' && d1.stage === 0 && d1.harvested === false);
  api.plantDream();
  t('dream: plant twice the same night -> ALREADY (no second seed)', said.includes('ALREADY') && api.dreamState().plantedAt === d1.plantedAt);
  t('dream: water 1 -> stage 1', api.waterDream() === 1);
  t('dream: water 2 -> stage 2 (ready)', api.waterDream() === 2);
  t('dream: water 3 -> 0 (max stage)', api.waterDream() === 0);
  await api.harvestDream();
  t('dream: harvest at stage 2 -> POST /dream/harvest with plantedAt + stage 2', fetchCalls.length === 1 && fetchCalls[0].url.endsWith('/dream/harvest') && fetchCalls[0].body.stage === 2 && typeof fetchCalls[0].body.plantedAt === 'number');
  t('dream: harvest success -> harvested=true + message +75', api.dreamState().harvested === true && said.some(m => m.includes('+75')));
  await api.harvestDream();
  t('dream: harvest twice -> NO SEED (already harvested, no second fetch)', fetchCalls.length === 1 && said.includes('NO SEED'));
  // Fresh seed, stage < 2 -> harvest refused client-side.
  delete store['sqk42:dream'];
  api.setLiveSnapshot({ ok: true, rpm: 0 });
  api.plantDream();
  await api.harvestDream();
  t('dream: harvest at stage 0 -> NOT READY, no fetch', fetchCalls.length === 1 && said.includes('NOT READY'));
  // Lullaby box: hamster awake -> awake info; asleep -> night info.
  api.setPlayMode('lullaby');
  api.setLiveSnapshot({ ok: true, rpm: 80 });
  api.renderLullabyBox();
  t('lullaby: box visible in lullaby mode + awake info when hamster is up', lullabyBox.classList.contains('hidden') === false && lullabyInfo.textContent === 'LULLABY AWAKE');
  api.setLiveSnapshot({ ok: true, rpm: 0 });
  api.renderLullabyBox();
  t('lullaby: asleep info when hamster sleeps', lullabyInfo.textContent === 'LULLABY NIGHT');
  api.setPlayMode('free');
  api.renderLullabyBox();
  t('lullaby: box hidden outside lullaby mode', lullabyBox.classList.contains('hidden') === true);
  // Lullaby seedKey.
  const seedKeyFor = new Function('squeekTodayStr', 'liveSnapshot', 'liveBpm', 'weeklyKey', 'challengeCode',
    fnSrcJ('seedKeyFor') + '\nreturn seedKeyFor;')(squeekTodayStr, null, () => 128, () => '2026-11-02', null);
  t('lullaby: seedKey is LULLABY-<squeek day>', seedKeyFor('lullaby') === 'LULLABY-' + squeekTodayStr());
}

// --- 10. v42.5.1 app icon + OG image (Worker-served, no binary in repo) ---
(function () {
  const W = 'https://squeekchain-leaderboard.pancigoreng.workers.dev';
  t('v42.5.1 WC metadata icons -> Worker /icon.png', js.includes("icons: ['" + W + "/icon.png']"));
  t('v42.5.1 og:image -> Worker /og.png', html.includes('<meta property="og:image" content="' + W + '/og.png">'));
  t('v42.5.1 twitter:image -> Worker /og.png', html.includes('<meta name="twitter:image" content="' + W + '/og.png">'));
  t('v42.5.1 favicon + apple-touch-icon -> Worker /icon.png', html.includes('<link rel="icon" type="image/png" href="' + W + '/icon.png">') && html.includes('<link rel="apple-touch-icon" href="' + W + '/icon.png">'));
  t('v42.5.1 gameVersion v42.5.1', js.includes("gameVersion: 'v42.5.1'"));
  t('v42.5.1 worker routes /icon.png + /og.png exist', worker.includes('"/icon.png"') && worker.includes('"/og.png"') && worker.includes('function pngResponse('));
  t('v42.5.1 worker version 11', worker.includes('version: 11'));
  t('v42.5.1 no stale headline-simple.png URL in client', !html.includes('squeekchain-headline-simple.png') && !js.includes('squeekchain-headline-simple.png'));
})();

// --- 11. v42.5.1: dua sumber skin (BUG 1) + tombol submit Lullaby (BUG 2) + warna Lullaby (BUG 3) ---
async function runBugFixTests4251() {
  const ADDR = '0x88538a82143065664232422e2dec4309038fcf9a';
  const store = {};
  const loadJSON = (k, d) => { try { const v = store[k]; return v === undefined ? d : JSON.parse(v); } catch { return d; } };
  const saveJSON = (k, v) => { store[k] = JSON.stringify(v); };
  const skinFns = new Function('loadJSON', 'saveJSON',
    fnSrcJ('shopSkin') + '\n' + fnSrcJ('saveKejuSkin') + '\n' + fnSrcJ('saveSqkSkin') + '\n' + fnSrcJ('saveSkinLast') +
    '\nreturn { shopSkin, saveKejuSkin, saveSqkSkin, saveSkinLast };')(loadJSON, saveJSON);
  const { shopSkin, saveKejuSkin, saveSqkSkin, saveSkinLast } = skinFns;
  // BUG 1 — skenario persis laporan user: equip SQK -> fetchShop -> tetap terpasang.
  saveSqkSkin({ note: 'note-sqk-rare', frame: null }); saveSkinLast('note', 'sqk');
  t('v42.5.1 BUG 1: equip SQK -> shopSkin.note = note-sqk-rare', shopSkin().note === 'note-sqk-rare');
  saveKejuSkin({ note: null, frame: null }); // simulasi fetchShop: server tanpa Keju terpasang
  t('v42.5.1 BUG 1: fetchShop tanpa Keju terpasang TIDAK menghapus skin SQK', shopSkin().note === 'note-sqk-rare');
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju'); // equip Keju
  t('v42.5.1 BUG 1: equip Keju lalu -> Keju menang di slot note', shopSkin().note === 'note-mint');
  saveKejuSkin({ note: 'note-mint', frame: null }); // fetchShop lagi (server: Keju terpasang)
  t('v42.5.1 BUG 1: equip Keju -> fetchShop -> Keju tetap terpasang', shopSkin().note === 'note-mint');
  saveSqkSkin({ note: 'note-sqk-lime', frame: null }); saveSkinLast('note', 'sqk'); // equip SQK lagi
  t('v42.5.1 BUG 1: equip SQK lalu -> SQK menang di slot note', shopSkin().note === 'note-sqk-lime');
  saveKejuSkin({ note: 'note-mint', frame: null }); // fetchShop lagi (server: Keju terpasang)
  t('v42.5.1 BUG 1: equip SQK -> fetchShop -> SQK tetap terpasang', shopSkin().note === 'note-sqk-lime');
  // Slot independen: note Keju + frame SQK hidup berdampingan.
  saveSqkSkin({ note: 'note-sqk-lime', frame: 'frame-sqk' }); saveSkinLast('frame', 'sqk');
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju');
  t('v42.5.1 BUG 1: slot independen (note Keju + frame SQK)', shopSkin().note === 'note-mint' && shopSkin().frame === 'frame-sqk');
  // Statis: fetchShop HANYA menulis kunci Keju; penulis tunggal lama sudah tidak ada.
  t('v42.5.1 BUG 1: fetchShop hanya menulis saveKejuSkin, bukan kunci gabungan', js.includes('saveKejuSkin({ note: note ? note.id : null, frame: frame ? frame.id : null })') && !js.includes('saveShopSkin('));
  t('v42.5.1 BUG 1: equipSqkItem punya fallback owned dari sqkState', js.includes('sqkState.owned[itemId] > 0'));
  // BUG 1 — fetchShop ASLI (bukan simulasi tulis kunci): mock tfetch + renderShop.
  let cheeseResp = { catalog: [{ id: 'note-mint', slot: 'note' }], items: [], balance: 0 };
  const tfetchMock = async () => ({ ok: true, json: async () => cheeseResp });
  let renderCalls = 0;
  const fetchShopH = new Function('currentWallet', 'isAddr', 'tfetch', 'CONFIG', 'renderShop', 'loadJSON', 'saveJSON',
    'let shopState = { balance: 0, items: [], catalog: [] };\n' +
    fnSrcJ('saveKejuSkin') + '\n' + fnSrcJ('fetchShop') +
    '\nreturn { fetchShop, getState: () => shopState };')(
    () => ADDR, s => /^0x[a-fA-F0-9]{40}$/.test(s || ''), tfetchMock, { LB_URL: 'https://lb.test' },
    () => { renderCalls++; }, loadJSON, saveJSON);
  saveSqkSkin({ note: 'note-sqk-rare', frame: null }); saveSkinLast('note', 'sqk');
  await fetchShopH.fetchShop();
  t('v42.5.1 BUG 1 (fetchShop asli): equip SQK bertahan melewati fetchShop()', shopSkin().note === 'note-sqk-rare' && renderCalls === 1);
  cheeseResp = { catalog: [{ id: 'note-mint', slot: 'note' }], items: [{ id: 'note-mint', slot: 'note', equipped: true }], balance: 50 };
  await fetchShopH.fetchShop();
  t('v42.5.1 BUG 1 (fetchShop asli): sync server tidak menimpa marker SQK terakhir', shopSkin().note === 'note-sqk-rare' && fetchShopH.getState().items.length === 1);
  saveKejuSkin({ note: 'note-mint', frame: null }); saveSkinLast('note', 'keju');
  await fetchShopH.fetchShop();
  t('v42.5.1 BUG 1 (fetchShop asli): equip Keju -> fetchShop -> Keju tetap terpasang', shopSkin().note === 'note-mint');
  // BUG 2 — resetLbSubmit menyembunyikan tombol untuk Lullaby/Practice saja.
  const btnEl = { disabled: false, classList: mockClassList() };
  const msgEl = { textContent: '', classList: mockClassList() };
  const $h = id => (id === 'lbSubmitBtn' ? btnEl : id === 'lbSubmitMsg' ? msgEl : null);
  const mkReset = lastResult => new Function('$', 'stopVerifyPoll', 'lastResult',
    fnSrcJ('resetLbSubmit') + '\nreturn resetLbSubmit;')($h, () => {}, lastResult);
  mkReset({ lullaby: true, practice: false })();
  t('v42.5.1 BUG 2: panel hasil Lullaby -> tombol SUBMIT disembunyikan', btnEl.classList.contains('hidden') === true);
  mkReset({ lullaby: false, practice: true })();
  t('v42.5.1 BUG 2: panel hasil Practice -> tombol SUBMIT disembunyikan', btnEl.classList.contains('hidden') === true);
  mkReset({ lullaby: false, practice: false })();
  t('v42.5.1 BUG 2: lagu biasa -> tombol SUBMIT tetap tampil', btnEl.classList.contains('hidden') === false);
  t('v42.5.1 BUG 2: submitLb tetap berjaga untuk Lullaby + Practice (lapis kedua)', js.includes("if (lastResult.lullaby) return show(msg('lbLullaby'));") && js.includes("if (lastResult.practice) return show(msg('lbPractice'));"));
  t('v42.5.1 BUG 2: catatan Lullaby tetap ada di panel hasil (lullabyTag)', js.includes("G.lullaby ? rl('lullabyTag')"));
  // BUG 3 — tombol mode LULLABY punya warna sendiri (lavender), seperti 4 mode lain.
  t('v42.5.1 BUG 3: tombol LULLABY punya --mode-accent lavender #b388ff', css.includes('#modeRow [data-mode="lullaby"] { --mode-accent: #b388ff; }'));
  t('v42.5.1 BUG 3: kelima mode punya --mode-accent', ['free', 'daily', 'live', 'race', 'lullaby'].every(m => css.includes('#modeRow [data-mode="' + m + '"]')));
  t('v42.5.1 BUG 3: tombol LULLABY ada di modeRow', html.includes('data-mode="lullaby"'));
  // BUG 4 — pesan 409 resolve kapsul: settlement hanya terjadi saat hamster lari (siang).
  t('v42.5.1 BUG 4: sqkNotSettled EN+ID menjelaskan settlement butuh hamster lari (siang)',
    js.includes('SETTLEMENTS ONLY HAPPEN WHEN THE HAMSTER RUNS (DAYTIME). TRY AGAIN AFTER THE MORNING RUN.') &&
    js.includes('SETTLEMENT HANYA TERJADI SAAT HAMSTER LARI (SIANG HARI). COBA LAGI SETELAH LARI PAGI.') &&
    !js.includes('HAS NOT SETTLED YET — TRY AGAIN IN A FEW MINUTES.') && !js.includes('BELUM SETTLED — COBA LAGI BEBERAPA MENIT LAGI.'));
}

(async () => {
  await runRateLimitTests();
  await runWalletTests42();
  await runDreamTests42();
  await runBugFixTests4251();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
